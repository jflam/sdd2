import pytest
import asyncio
import tempfile
import os
import json
import time
import threading
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from src.api import app
from src.config import ConfigManager
from src.unified_logger import setup_unified_logging
from src.log_writer import LogWriter
from src.models import LogEntry, LoggingConfig


class TestIntegration:
    """Integration tests for the unified logging system"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.client = TestClient(app)
        self.temp_dir = tempfile.mkdtemp()
        self.test_log_file = os.path.join(self.temp_dir, "integration_test.log")
        
        # Create test configuration
        self.test_config = LoggingConfig(
            log_file_path=self.test_log_file,
            max_file_size_mb=10,
            rotation_count=3,
            flush_immediately=True,
            api_port=8000,
            log_level="debug"
        )
        
        # Set up unified logging with test config
        self.config_manager = ConfigManager()
        self.config_manager.config = self.test_config
        self.unified_logger = setup_unified_logging(self.config_manager)
        
        # Update the app's log writer to use test config
        from src.api import log_writer
        log_writer.config = self.test_config
        log_writer.config_manager = self.config_manager
    
    def teardown_method(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_frontend_to_backend_log_flow(self):
        """Test complete frontend-to-backend log flow"""
        # Simulate frontend log entries
        frontend_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Frontend initialization complete",
                    "source": "frontend",
                    "component": "safari-extension",
                    "context": {"version": "1.0.1"}
                },
                {
                    "timestamp": "2025-01-14T10:30:01.000Z",
                    "level": "debug",
                    "message": "User clicked button",
                    "source": "frontend",
                    "component": "popup",
                    "context": {"buttonId": "submit"}
                },
                {
                    "timestamp": "2025-01-14T10:30:02.000Z",
                    "level": "warn",
                    "message": "API response delayed",
                    "source": "frontend",
                    "component": "api-client",
                    "context": {"responseTime": 2500}
                }
            ]
        }
        
        # Send logs to backend
        response = self.client.post("/api/logs", json=frontend_logs)
        assert response.status_code == 200
        
        # Verify response
        data = response.json()
        assert data["status"] == "success"
        assert data["processed_count"] == 3
        
        # Verify logs were written to unified log file
        assert os.path.exists(self.test_log_file)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            
        # Check that all frontend logs are present with correct formatting
        assert "[INFO] [FRONTEND] [SAFARI-EXTENSION]" in content
        assert "Frontend initialization complete" in content
        assert "[DEBUG] [FRONTEND] [POPUP]" in content
        assert "User clicked button" in content
        assert "[WARN] [FRONTEND] [API-CLIENT]" in content
        assert "API response delayed" in content
        
        # Verify context data is included
        assert '"version":"1.0.1"' in content
        assert '"buttonId":"submit"' in content
        assert '"responseTime":2500' in content
    
    def test_backend_logging_integration(self):
        """Test that backend logs are written to the same unified file"""
        # Generate backend log
        logger = self.unified_logger.get_logger("test_backend")
        logger.info("Backend service started", extra={"service": "api", "port": 8000})
        logger.error("Database connection failed", extra={"error_code": "DB001"})
        
        # Also send frontend logs
        frontend_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Frontend connected to backend",
                    "source": "frontend",
                    "component": "api-client"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=frontend_logs)
        assert response.status_code == 200
        
        # Verify both frontend and backend logs are in the same file
        assert os.path.exists(self.test_log_file)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Check backend logs
        assert "[INFO] [BACKEND]" in content
        assert "Backend service started" in content
        assert "[ERROR] [BACKEND]" in content
        assert "Database connection failed" in content
        
        # Check frontend logs
        assert "[INFO] [FRONTEND]" in content
        assert "Frontend connected to backend" in content
        
        # Verify they're in the same file (both sources present)
        backend_lines = [line for line in content.split('\n') if '[BACKEND]' in line]
        frontend_lines = [line for line in content.split('\n') if '[FRONTEND]' in line]
        
        assert len(backend_lines) >= 2  # At least 2 backend log entries
        assert len(frontend_lines) >= 1  # At least 1 frontend log entry
    
    def test_exception_handling_across_stack(self):
        """Test exception handling from both frontend and backend"""
        # Test frontend exception
        frontend_exception = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "error",
                    "message": "Unhandled exception in popup",
                    "source": "frontend",
                    "component": "popup",
                    "stackTrace": "Error: Cannot read property 'value' of null\n    at handleClick (popup.js:42:15)\n    at HTMLButtonElement.<anonymous> (popup.js:10:9)",
                    "context": {
                        "errorName": "TypeError",
                        "errorMessage": "Cannot read property 'value' of null",
                        "userId": "user123"
                    }
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=frontend_exception)
        assert response.status_code == 200
        
        # Test backend exception
        logger = self.unified_logger.get_logger("test_backend")
        try:
            # Simulate an exception
            raise ValueError("Invalid configuration parameter")
        except ValueError as e:
            logger.error("Configuration error occurred", exc_info=True, extra={"config_key": "api_endpoint"})
        
        # Verify both exceptions are logged
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Check frontend exception
        assert "[ERROR] [FRONTEND] [POPUP]" in content
        assert "Unhandled exception in popup" in content
        assert "Cannot read property 'value' of null" in content
        assert "popup.js:42:15" in content
        
        # Check backend exception
        assert "[ERROR] [BACKEND]" in content
        assert "Configuration error occurred" in content
        assert "ValueError: Invalid configuration parameter" in content
        assert "Traceback" in content
    
    def test_async_behavior_non_blocking(self):
        """Test that async log operations don't block frontend operations"""
        # This test simulates the async nature by testing response times
        import time
        
        # Create a large batch of logs to test async processing
        large_batch = {
            "entries": [
                {
                    "timestamp": f"2025-01-14T10:30:{i:02d}.000Z",
                    "level": "info",
                    "message": f"Log entry {i}",
                    "source": "frontend",
                    "component": "test",
                    "context": {"index": i}
                }
                for i in range(50)  # 50 log entries
            ]
        }
        
        # Measure response time
        start_time = time.time()
        response = self.client.post("/api/logs", json=large_batch)
        end_time = time.time()
        
        # Response should be fast (under 1 second for 50 entries)
        response_time = end_time - start_time
        assert response_time < 1.0, f"Response took too long: {response_time}s"
        
        # Verify successful processing
        assert response.status_code == 200
        data = response.json()
        assert data["processed_count"] == 50
        
        # Verify all logs were written
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Count log entries in file
        log_lines = [line for line in content.split('\n') if '[INFO] [FRONTEND] [TEST]' in line]
        assert len(log_lines) == 50
    
    def test_error_scenarios_and_fallbacks(self):
        """Test various error scenarios and fallback mechanisms"""
        
        # Test 1: Empty log batch
        response = self.client.post("/api/logs", json={"entries": []})
        assert response.status_code == 400
        assert "No log entries provided" in response.json()["detail"]
        
        # Test 2: Invalid log entry format
        invalid_logs = {
            "entries": [
                {
                    "level": "info",
                    "message": "Missing timestamp",
                    "source": "frontend"
                    # Missing required timestamp field
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=invalid_logs)
        assert response.status_code == 422  # Validation error
        
        # Test 3: Invalid log level
        invalid_level_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "invalid_level",
                    "message": "Test message",
                    "source": "frontend"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=invalid_level_logs)
        assert response.status_code == 422  # Validation error
        
        # Test 4: File write error simulation
        with patch('src.log_writer.LogWriter.write_batch') as mock_write:
            mock_write.side_effect = IOError("Disk full")
            
            valid_logs = {
                "entries": [
                    {
                        "timestamp": "2025-01-14T10:30:00.000Z",
                        "level": "info",
                        "message": "Test message",
                        "source": "frontend"
                    }
                ]
            }
            
            response = self.client.post("/api/logs", json=valid_logs)
            assert response.status_code == 500  # Internal server error
    
    def test_concurrent_logging_operations(self):
        """Test concurrent logging from multiple sources"""
        import threading
        import queue
        
        results = queue.Queue()
        
        def send_logs(thread_id):
            """Function to send logs from a thread"""
            logs = {
                "entries": [
                    {
                        "timestamp": f"2025-01-14T10:30:{thread_id:02d}.000Z",
                        "level": "info",
                        "message": f"Message from thread {thread_id}",
                        "source": "frontend",
                        "component": f"thread-{thread_id}",
                        "context": {"threadId": thread_id}
                    }
                ]
            }
            
            try:
                response = self.client.post("/api/logs", json=logs)
                results.put((thread_id, response.status_code, response.json()))
            except Exception as e:
                results.put((thread_id, None, str(e)))
        
        # Create and start multiple threads
        threads = []
        num_threads = 10
        
        for i in range(num_threads):
            thread = threading.Thread(target=send_logs, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Collect results
        thread_results = []
        while not results.empty():
            thread_results.append(results.get())
        
        # Verify all threads succeeded
        assert len(thread_results) == num_threads
        for thread_id, status_code, response_data in thread_results:
            assert status_code == 200, f"Thread {thread_id} failed with status {status_code}"
            assert response_data["status"] == "success"
        
        # Verify all logs were written to file
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Check that logs from all threads are present
        for i in range(num_threads):
            assert f"Message from thread {i}" in content
            assert f"[THREAD-{i}]" in content.upper()
    
    def test_log_file_real_time_monitoring(self):
        """Test that logs are immediately available for tail -f monitoring"""
        # Send a log entry
        test_log = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Real-time monitoring test",
                    "source": "frontend",
                    "component": "monitor-test"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=test_log)
        assert response.status_code == 200
        
        # Immediately check if the log is available (simulating tail -f behavior)
        assert os.path.exists(self.test_log_file)
        
        # Read file content immediately after write
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Verify the log is immediately available
        assert "Real-time monitoring test" in content
        assert "[INFO] [FRONTEND] [MONITOR-TEST]" in content
        
        # Test multiple rapid writes
        for i in range(5):
            rapid_log = {
                "entries": [
                    {
                        "timestamp": f"2025-01-14T10:30:{i:02d}.000Z",
                        "level": "debug",
                        "message": f"Rapid log {i}",
                        "source": "frontend",
                        "component": "rapid-test"
                    }
                ]
            }
            
            response = self.client.post("/api/logs", json=rapid_log)
            assert response.status_code == 200
            
            # Verify immediate availability
            with open(self.test_log_file, 'r') as f:
                content = f.read()
            assert f"Rapid log {i}" in content
    
    def test_version_tracking_and_startup_logging(self):
        """Test version tracking and startup logging functionality"""
        # Trigger a startup log to test the functionality
        self.unified_logger.log_startup("Safari Extension Unified Logging API", "1.0.1")
        
        # Check if startup message is in the log file
        assert os.path.exists(self.test_log_file)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        assert "Loading Safari Extension Unified Logging API 1.0.1" in content
        
        # Test frontend startup logging
        frontend_startup = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Loading Safari Extension Unified Logging 1.0.1",
                    "source": "frontend",
                    "component": "safari-extension",
                    "context": {"version": "1.0.1", "build": 1}
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=frontend_startup)
        assert response.status_code == 200
        
        # Verify frontend startup is logged
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        assert "Loading Safari Extension Unified Logging 1.0.1" in content
        assert "[INFO] [FRONTEND] [SAFARI-EXTENSION]" in content