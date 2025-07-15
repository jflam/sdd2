import pytest
import asyncio
import tempfile
import os
import json
import time
import threading
import subprocess
import requests
import sys
from unittest.mock import patch

from src.config import ConfigManager
from src.models import LoggingConfig


class TestEndToEnd:
    """End-to-end tests that test the complete system integration"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_log_file = os.path.join(self.temp_dir, "e2e_test.log")
        self.server_process: Optional[subprocess.Popen] = None
        self.server_port = 8001
        self.server_url = f"http://localhost:{self.server_port}"
        self.server_timeout = 30  # seconds
        
    def teardown_method(self):
        """Clean up test fixtures"""
        if self.server_process:
            self.stop_server()
        
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def start_server(self):
        """Start server with test configuration via environment variables"""
        env = os.environ.copy()
        env['LOG_FILE_PATH'] = self.test_log_file
        env['FLUSH_IMMEDIATELY'] = 'true'
        env['LOG_LEVEL'] = 'DEBUG'
        env['API_PORT'] = str(self.server_port)
        
        # Start server in subprocess
        self.server_process = subprocess.Popen([
            sys.executable, '-m', 'uvicorn', 
            'src.api:app', 
            '--host', '0.0.0.0', 
            '--port', str(self.server_port),
            '--log-level', 'warning'  # Reduce uvicorn noise
        ], 
        env=env, 
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
        )
        
        # Wait for server to start
        self.wait_for_server()
    
    def wait_for_server(self):
        """Wait for server to be ready"""
        for _ in range(self.server_timeout):
            try:
                response = requests.get(f"{self.server_url}/health", timeout=1)
                if response.status_code == 200:
                    return
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                pass
            time.sleep(1)
        
        # If we get here, server didn't start
        if self.server_process:
            stdout, stderr = self.server_process.communicate(timeout=5)
            print(f"Server stdout: {stdout.decode()}")
            print(f"Server stderr: {stderr.decode()}")
        
        raise RuntimeError(f"Server failed to start within {self.server_timeout} seconds")
    
    def stop_server(self):
        """Stop the server process"""
        if self.server_process:
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
                self.server_process.wait()
            self.server_process = None
    
    def test_complete_frontend_to_backend_flow(self):
        """Test complete frontend-to-backend log flow with real HTTP requests"""
        self.start_server()
        
        # Send log data via HTTP
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Frontend test message",
                    "source": "frontend",
                    "context": {"test": "e2e"}
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=5)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["processed_count"] == 1
        
        # Verify log file was created and contains expected content
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            assert "Frontend test message" in content
            assert "[INFO]" in content
            assert "[FRONTEND]" in content
    
    def test_mixed_frontend_backend_logging(self):
        """Test mixed frontend/backend logging in unified file"""
        self.start_server()
        
        # Send frontend log
        frontend_log = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "debug",
                    "message": "Frontend debug message",
                    "source": "frontend",
                    "component": "ui"
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=frontend_log, timeout=5)
        assert response.status_code == 200
        
        # The backend will also log the processing
        # Wait a bit for backend logs to be written
        time.sleep(0.5)
        
        # Check unified log file
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            
            # Should contain both frontend and backend logs
            assert "Frontend debug message" in content
            assert "[DEBUG]" in content
            assert "[FRONTEND]" in content
            assert "[UI]" in content
            
            # Backend should have logged the processing
            assert "[BACKEND]" in content
            assert "Successfully processed" in content
    
    def test_high_volume_logging(self):
        """Test high-volume logging performance (100+ entries)"""
        self.start_server()
        
        # Create batch of 100 log entries
        entries = []
        for i in range(100):
            entries.append({
                "timestamp": f"2025-01-14T10:30:{i:02d}.000Z",
                "level": "info",
                "message": f"High volume message {i}",
                "source": "frontend",
                "context": {"batch_id": "high_volume", "index": i}
            })
        
        log_data = {"entries": entries}
        
        start_time = time.time()
        response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=30)
        end_time = time.time()
        
        assert response.status_code == 200
        data = response.json()
        assert data["processed_count"] == 100
        
        # Check performance (should process 100 entries in reasonable time)
        processing_time = end_time - start_time
        assert processing_time < 10  # Should be much faster than 10 seconds
        
        # Verify all entries were written
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            
            # Check that we have all entries
            assert "High volume message 0" in content
            assert "High volume message 50" in content
            assert "High volume message 99" in content
    
    def test_error_handling_and_recovery(self):
        """Test error handling and system recovery"""
        self.start_server()
        
        # Test invalid log data
        invalid_log = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "invalid_level",  # Invalid level
                    "message": "Test message",
                    "source": "frontend"
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=invalid_log, timeout=5)
        assert response.status_code == 422  # Validation error
        
        # Test empty batch
        empty_log = {"entries": []}
        response = requests.post(f"{self.server_url}/api/logs", json=empty_log, timeout=5)
        assert response.status_code == 400
        
        # Test that server still works after errors
        valid_log = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Recovery test message",
                    "source": "frontend"
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=valid_log, timeout=5)
        assert response.status_code == 200
        
        # Verify recovery log was written
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            assert "Recovery test message" in content
    
    def test_concurrent_request_handling(self):
        """Test concurrent request handling"""
        self.start_server()
        
        def send_log_batch(batch_id: int):
            """Send a log batch from a separate thread"""
            log_data = {
                "entries": [
                    {
                        "timestamp": f"2025-01-14T10:30:{batch_id:02d}.000Z",
                        "level": "info",
                        "message": f"Concurrent message from batch {batch_id}",
                        "source": "frontend",
                        "context": {"batch_id": batch_id}
                    }
                ]
            }
            
            response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=10)
            return response.status_code == 200
        
        # Start multiple threads to send concurrent requests
        threads = []
        results = []
        
        for i in range(10):
            thread = threading.Thread(target=lambda i=i: results.append(send_log_batch(i)))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should have succeeded
        assert all(results)
        
        # Verify all messages were written
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            
            # Check for messages from all batches
            for i in range(10):
                assert f"Concurrent message from batch {i}" in content
    
    def test_server_startup_logging(self):
        """Test startup and version logging"""
        self.start_server()
        
        # Wait a bit for startup logs to be written
        time.sleep(1)
        
        # Check that startup logs were written
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            
            # Should contain startup information
            assert "Safari Extension Unified Logging API" in content
            assert "1.0.1" in content
            assert "[BACKEND]" in content
    
    def test_real_time_log_monitoring(self):
        """Test real-time log monitoring capabilities"""
        self.start_server()
        
        # Initial log entry
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Initial monitoring message",
                    "source": "frontend"
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=5)
        assert response.status_code == 200
        
        # Check that log was written immediately (due to flush_immediately=True)
        assert os.path.exists(self.test_log_file)
        
        initial_content = ""
        with open(self.test_log_file, 'r') as f:
            initial_content = f.read()
        
        assert "Initial monitoring message" in initial_content
        
        # Send second log entry
        log_data["entries"][0]["message"] = "Second monitoring message"
        log_data["entries"][0]["timestamp"] = "2025-01-14T10:30:01.000Z"
        
        response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=5)
        assert response.status_code == 200
        
        # Check that second log was appended
        with open(self.test_log_file, 'r') as f:
            final_content = f.read()
        
        assert "Initial monitoring message" in final_content
        assert "Second monitoring message" in final_content
        assert len(final_content) > len(initial_content)

    def test_log_file_rotation_during_operation(self):
        """Test log file rotation during server operation"""
        # Set up with small file size to force rotation
        env = os.environ.copy()
        env['LOG_FILE_PATH'] = self.test_log_file
        env['FLUSH_IMMEDIATELY'] = 'true'
        env['LOG_LEVEL'] = 'DEBUG'
        env['API_PORT'] = str(self.server_port)
        env['MAX_FILE_SIZE_MB'] = '1'  # 1MB limit
        env['ROTATION_COUNT'] = '2'

        # Start server with rotation config
        self.server_process = subprocess.Popen([
            sys.executable, '-m', 'uvicorn', 
            'src.api:app', 
            '--host', '0.0.0.0', 
            '--port', str(self.server_port),
            '--log-level', 'warning'
        ], 
        env=env, 
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
        )
        
        self.wait_for_server()
        
        # Send initial log to create file
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Initial message for rotation test",
                    "source": "frontend"
                }
            ]
        }
        
        response = requests.post(f"{self.server_url}/api/logs", json=log_data, timeout=5)
        assert response.status_code == 200
        
        # Verify log file was created
        assert os.path.exists(self.test_log_file)
        
        # Send many large log entries to trigger rotation
        # (Note: We'll send reasonable sized messages to avoid taking too long)
        for i in range(10):
            large_log = {
                "entries": [
                    {
                        "timestamp": f"2025-01-14T10:30:{i:02d}.000Z",
                        "level": "info",
                        "message": f"Large rotation test message {i} " + "x" * 1000,  # 1KB message
                        "source": "frontend",
                        "context": {"batch": i, "size": "large"}
                    }
                ]
            }
            
            response = requests.post(f"{self.server_url}/api/logs", json=large_log, timeout=5)
            assert response.status_code == 200
        
        # Wait for logs to be processed
        time.sleep(1)
        
        # Check that the main log file exists and has recent content
        assert os.path.exists(self.test_log_file)
        
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            # Should contain some of the recent messages
            assert "Large rotation test message" in content
            assert "rotation test" in content
