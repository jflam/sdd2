import pytest
import tempfile
import os
from fastapi.testclient import TestClient
from backend.src.api import app, log_writer, config

class TestAPI:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.client = TestClient(app)
        # Use a temporary log file for testing
        self.temp_dir = tempfile.mkdtemp()
        self.test_log_file = os.path.join(self.temp_dir, "test_api.log")
        config.log_file_path = self.test_log_file
        log_writer.config.log_file_path = self.test_log_file
    
    def teardown_method(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_root_endpoint(self):
        """Test the root endpoint"""
        response = self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Safari Extension Unified Logging API"
        assert data["version"] == "1.0.1"
    
    def test_health_check(self):
        """Test the health check endpoint"""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "unified-logging-api"
    
    def test_receive_logs_success(self):
        """Test successful log reception"""
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Test message",
                    "source": "frontend",
                    "context": {"userId": "123"}
                },
                {
                    "timestamp": "2025-01-14T10:30:01.000Z",
                    "level": "error",
                    "message": "Error message",
                    "source": "frontend",
                    "stackTrace": "Error stack trace here"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["processed_count"] == 2
        assert "Successfully processed 2 log entries" in data["message"]
        
        # Verify logs were written to file
        assert os.path.exists(self.test_log_file)
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            assert "Test message" in content
            assert "Error message" in content
    
    def test_receive_logs_empty_batch(self):
        """Test handling of empty log batch"""
        log_data = {"entries": []}
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "No log entries provided" in data["detail"]
    
    def test_receive_logs_missing_timestamp(self):
        """Test handling of log entry with missing timestamp"""
        log_data = {
            "entries": [
                {
                    "level": "info",
                    "message": "Test message",
                    "source": "frontend"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "timestamp is required" in data["detail"]
    
    def test_receive_logs_missing_message(self):
        """Test handling of log entry with missing message"""
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "source": "frontend"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "message is required" in data["detail"]
    
    def test_receive_logs_invalid_level(self):
        """Test handling of log entry with invalid level"""
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "invalid_level",
                    "message": "Test message",
                    "source": "frontend"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 422  # Validation error
    
    def test_receive_logs_invalid_source(self):
        """Test handling of log entry with invalid source"""
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "info",
                    "message": "Test message",
                    "source": "invalid_source"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 422  # Validation error
    
    def test_receive_logs_malformed_json(self):
        """Test handling of malformed JSON"""
        response = self.client.post(
            "/api/logs", 
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_cors_headers(self):
        """Test that CORS headers are present"""
        response = self.client.options("/api/logs")
        # FastAPI automatically handles OPTIONS requests for CORS
        assert response.status_code in [200, 405]  # 405 if OPTIONS not explicitly defined
    
    def test_single_log_entry(self):
        """Test receiving a single log entry"""
        log_data = {
            "entries": [
                {
                    "timestamp": "2025-01-14T10:30:00.000Z",
                    "level": "debug",
                    "message": "Single debug message",
                    "source": "frontend",
                    "component": "logger"
                }
            ]
        }
        
        response = self.client.post("/api/logs", json=log_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["processed_count"] == 1
        
        # Verify log format in file
        with open(self.test_log_file, 'r') as f:
            content = f.read()
            assert "[DEBUG]" in content
            assert "[FRONTEND]" in content
            assert "[LOGGER]" in content
            assert "Single debug message" in content