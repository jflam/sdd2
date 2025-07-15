import pytest
import asyncio
import tempfile
import os
import json
import time
import threading
import subprocess
import requests
from unittest.mock import patch

from src.config import ConfigManager
from src.models import LoggingConfig


class TestEndToEnd:
    """End-to-end tests that test the complete system integration"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_log_file = os.path.join(self.temp_dir, "e2e_test.log")
        
        # Create test configuration
        self.test_config = LoggingConfig(
            log_file_path=self.test_log_file,
            max_file_size_mb=10,
            rotation_count=3,
            flush_immediately=True,
            api_port=8001,  # Use different port for E2E tests
            log_level="debug"
        )
        
        # Create config file for the server
        self.config_file = os.path.join(self.temp_dir, "test_config.json")
        with open(self.config_file, 'w') as f:
            json.dump(self.test_config.dict(), f)
        
        # Start the server in a separate process
        self.server_process = None
        self.start_server()
        
        # Wait for server to start
        self.wait_for_server()
    
    def teardown_method(self):
        """Clean up test fixtures"""
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
        
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def start_server(self):
        """Start the API server in a separate process"""
        import sys
        import os
        
        # Patch the config to use our test log file
        with patch('src.api.config') as mock_config:
            mock_config.log_file_path = self.test_log_file
            mock_config.flush_immediately = True
            
            # Also patch the log writer config
            with patch('src.api.log_writer.config') as mock_log_writer_config:
                mock_log_writer_config.log_file_path = self.test_log_file
                mock_log_writer_config.flush_immediately = True
        
        # Start server process
        self.server_process = subprocess.Popen([
            sys.executable, '-c', f'''
import sys
sys.path.insert(0, "backend")
from src.api import app
from src.config import ConfigManager
from src.models import LoggingConfig

# Override config for testing
test_config = LoggingConfig(
    log_file_path="{self.test_log_file}",
    max_file_size_mb=10,
    rotation_count=3,
    flush_immediately=True,
    api_port=8001,
    log_level="debug"
)

# Patch the global config
import src.api
src.api.config = test_config
src.api.log_writer.config = test_config

# Start server
import uvicorn
uvicorn.run(app, host="0.0.0.0", port=8001, log_level="error")
'''], 
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
        )
    
    def wait_for_server(self, timeout=10):
        """Wait for the server to be ready"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get('http://localhost:8001/health', timeout=1)
                if response.status_code == 200:
                    return
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        
        raise Exception("Server failed to start within timeout")
    
    def test_complete_frontend_to_backend_flow(self):
        """Test complete flow from frontend logging to backend file writing"""
        # Simulate frontend log entries
        frontend_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "E2E test: Frontend initialization",
                    "source": "frontend",
                    "component": "safari-extension",
                    "context": {"test": "e2e", "version": "1.0.1"}
                },
                {
                    "timestamp": "2025-01-14T10:30:01.000Z",
                    "level": "error",
                    "message": "E2E test: Simulated error",
                    "source": "frontend",
                    "component": "popup",
                    "stackTrace": "Error: Simulated error\n    at popup.js:42:15",
                    "context": {"errorType": "simulation"}
                }
            ]
        }
        
        # Send logs to backend
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=frontend_logs,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["processed_count"] == 2
        
        # Wait a moment for file write
        time.sleep(0.1)
        
        # Verify logs were written to unified log file
        assert os.path.exists(self.test_log_file)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Check that all frontend logs are present
        assert "E2E test: Frontend initialization" in content
        assert "E2E test: Simulated error" in content
        assert "[INFO] [FRONTEND] [SAFARI-EXTENSION]" in content
        assert "[ERROR] [FRONTEND] [POPUP]" in content
        assert '"test":"e2e"' in content
        assert "Error: Simulated error" in content
    
    def test_mixed_frontend_backend_logging(self):
        """Test that both frontend and backend logs appear in the same file"""
        # First, send frontend logs
        frontend_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "E2E: Frontend message",
                    "source": "frontend",
                    "component": "test"
                }
            ]
        }
        
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=frontend_logs,
            timeout=5
        )
        assert response.status_code == 200
        
        # The backend should also log the processing
        time.sleep(0.1)
        
        # Check log file contains both frontend and backend entries
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Should have frontend log
        assert "E2E: Frontend message" in content
        assert "[INFO] [FRONTEND] [TEST]" in content
        
        # Should have backend processing log
        assert "Successfully processed 1 log entries" in content
        assert "[INFO] [BACKEND]" in content
    
    def test_high_volume_logging(self):
        """Test system performance with high volume of logs"""
        # Create a large batch of logs
        large_batch = {
            "entries": [
                {
                    "timestamp": f"2025-01-14T10:30:{i:02d}.000Z",
                    "level": "info",
                    "message": f"E2E bulk test message {i}",
                    "source": "frontend",
                    "component": "bulk-test",
                    "context": {"index": i, "batch": "large"}
                }
                for i in range(100)  # 100 log entries
            ]
        }
        
        # Measure response time
        start_time = time.time()
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=large_batch,
            timeout=10
        )
        end_time = time.time()
        
        # Verify successful processing
        assert response.status_code == 200
        data = response.json()
        assert data["processed_count"] == 100
        
        # Response should be reasonably fast (under 2 seconds for 100 entries)
        response_time = end_time - start_time
        assert response_time < 2.0, f"Response took too long: {response_time}s"
        
        # Wait for file write
        time.sleep(0.2)
        
        # Verify all logs were written
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Count log entries in file
        bulk_lines = [line for line in content.split('\n') if 'E2E bulk test message' in line]
        assert len(bulk_lines) == 100
    
    def test_error_handling_and_recovery(self):
        """Test error scenarios and system recovery"""
        # Test 1: Invalid log format
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
        
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=invalid_logs,
            timeout=5
        )
        assert response.status_code == 422  # Validation error
        
        # Test 2: Empty batch
        empty_batch = {"entries": []}
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=empty_batch,
            timeout=5
        )
        assert response.status_code == 400
        
        # Test 3: System should still work after errors
        valid_logs = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "E2E: Recovery test",
                    "source": "frontend",
                    "component": "recovery"
                }
            ]
        }
        
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=valid_logs,
            timeout=5
        )
        assert response.status_code == 200
        
        # Verify recovery message was logged
        time.sleep(0.1)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        assert "E2E: Recovery test" in content
    
    def test_real_time_log_monitoring(self):
        """Test that logs are immediately available for monitoring"""
        # Send a log entry
        test_log = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "E2E: Real-time monitoring test",
                    "source": "frontend",
                    "component": "monitor"
                }
            ]
        }
        
        response = requests.post(
            'http://localhost:8001/api/logs',
            json=test_log,
            timeout=5
        )
        assert response.status_code == 200
        
        # Immediately check if the log is available (simulating tail -f)
        # Should be available within 100ms
        max_wait = 0.1
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            if os.path.exists(self.test_log_file):
                with open(self.test_log_file, 'r') as f:
                    content = f.read()
                if "E2E: Real-time monitoring test" in content:
                    break
            time.sleep(0.01)
        else:
            pytest.fail("Log not available for real-time monitoring within expected time")
        
        # Verify the log is properly formatted
        assert "[INFO] [FRONTEND] [MONITOR]" in content
    
    def test_concurrent_requests(self):
        """Test system behavior under concurrent load"""
        import concurrent.futures
        
        def send_log_batch(batch_id):
            """Send a batch of logs"""
            logs = {
                "entries": [
                    {
                        "timestamp": f"2025-01-14T10:30:{batch_id:02d}.000Z",
                        "level": "info",
                        "message": f"E2E concurrent test batch {batch_id}",
                        "source": "frontend",
                        "component": f"concurrent-{batch_id}",
                        "context": {"batchId": batch_id}
                    }
                ]
            }
            
            response = requests.post(
                'http://localhost:8001/api/logs',
                json=logs,
                timeout=5
            )
            return batch_id, response.status_code, response.json()
        
        # Send 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(send_log_batch, i) for i in range(10)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # Verify all requests succeeded
        for batch_id, status_code, response_data in results:
            assert status_code == 200, f"Batch {batch_id} failed with status {status_code}"
            assert response_data["status"] == "success"
        
        # Wait for all writes to complete
        time.sleep(0.2)
        
        # Verify all logs were written
        with open(self.test_log_file, 'r') as f:
            content = f.read()
        
        # Check that logs from all batches are present
        for i in range(10):
            assert f"E2E concurrent test batch {i}" in content
            assert f"[CONCURRENT-{i}]" in content.upper()
    
    def test_startup_and_version_logging(self):
        """Test that startup messages are properly logged"""
        # The server should have logged its startup when it started
        # Wait a moment to ensure startup logging is complete
        time.sleep(0.1)
        
        # Check if startup message is in the log file
        if os.path.exists(self.test_log_file):
            with open(self.test_log_file, 'r') as f:
                content = f.read()
            
            # Look for startup-related messages
            startup_indicators = [
                "Loading Safari Extension Unified Logging API",
                "1.0.1",
                "[BACKEND]"
            ]
            
            # At least some startup indicators should be present
            found_indicators = sum(1 for indicator in startup_indicators if indicator in content)
            assert found_indicators > 0, "No startup indicators found in log file"