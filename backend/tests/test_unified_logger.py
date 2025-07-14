import os
import tempfile
import logging
import pytest
from src.unified_logger import UnifiedLogger, setup_unified_logging, get_unified_logger
from src.models import LoggingConfig
from src.config import ConfigManager

class TestUnifiedLogger:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = os.path.join(self.temp_dir, "test_unified.log")
        self.config = LoggingConfig(
            log_file_path=self.log_file,
            flush_immediately=True
        )
        # Create a temporary config file for the ConfigManager
        import json
        config_file = os.path.join(self.temp_dir, "config.json")
        with open(config_file, 'w') as f:
            json.dump(self.config.model_dump(), f)
        
        self.config_manager = ConfigManager(config_file)
        self.unified_logger = UnifiedLogger(self.config_manager)
    
    def teardown_method(self):
        """Clean up test fixtures"""
        import shutil
        # Reset logging to avoid interference between tests
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_backend_logging_to_unified_file(self):
        """Test that backend logs are written to the unified log file"""
        logger = self.unified_logger.get_logger("test_module")
        
        logger.info("Test info message")
        logger.error("Test error message")
        logger.debug("Test debug message")
        
        # Verify logs were written to the unified file
        assert os.path.exists(self.log_file)
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            assert "[INFO] [BACKEND]" in content
            assert "[ERROR] [BACKEND]" in content
            assert "[DEBUG] [BACKEND]" in content
            assert "Test info message" in content
            assert "Test error message" in content
            assert "Test debug message" in content
    
    def test_exception_logging(self):
        """Test that exceptions are properly logged with stack traces"""
        logger = self.unified_logger.get_logger("test_exception")
        
        try:
            raise ValueError("Test exception")
        except ValueError:
            logger.error("An error occurred", exc_info=True)
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            assert "An error occurred" in content
            assert "ValueError: Test exception" in content
            assert "Traceback" in content
    
    def test_log_startup_message(self):
        """Test the startup logging functionality"""
        self.unified_logger.log_startup("Test Service", "1.2.3")
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            assert "Loading Test Service 1.2.3" in content
            assert "[INFO] [BACKEND]" in content
    
    def test_log_context_information(self):
        """Test that context information is included in logs"""
        logger = self.unified_logger.get_logger("test_context")
        
        logger.info("Message with context")
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            # Should include module, function, and line information
            assert '"module":"test_unified_logger"' in content  # The actual module name
            assert '"function":"test_log_context_information"' in content
            assert '"line":' in content
    
    def test_different_log_levels(self):
        """Test different log levels are handled correctly"""
        logger = self.unified_logger.get_logger("test_levels")
        
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")
        logger.critical("Critical message")
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            lines = content.strip().split('\n')
            
            # Check that all levels are converted correctly
            assert any("[DEBUG]" in line for line in lines)
            assert any("[INFO]" in line for line in lines)
            assert any("[WARN]" in line for line in lines)  # WARNING -> WARN
            assert any("[ERROR]" in line for line in lines)
            # CRITICAL should be converted to ERROR
            assert content.count("[ERROR]") >= 2  # error + critical
    
    def test_global_setup_functions(self):
        """Test the global setup and getter functions"""
        config = LoggingConfig(log_file_path=self.log_file)
        
        # Create a temporary config file for the ConfigManager
        import json
        config_file = os.path.join(self.temp_dir, "global_config.json")
        with open(config_file, 'w') as f:
            json.dump(config.model_dump(), f)
        
        config_manager = ConfigManager(config_file)
        
        # Test setup
        unified_logger = setup_unified_logging(config_manager)
        assert unified_logger is not None
        
        # Test getter
        retrieved_logger = get_unified_logger()
        assert retrieved_logger is unified_logger
    
    def test_handler_fallback_on_error(self):
        """Test that the handler falls back gracefully on errors"""
        # Create a logger with an invalid log file path to trigger errors
        invalid_config = LoggingConfig(log_file_path="/invalid/path/test.log")
        
        # Create a temporary config file for the ConfigManager
        import json
        config_file = os.path.join(self.temp_dir, "invalid_config.json")
        with open(config_file, 'w') as f:
            json.dump(invalid_config.model_dump(), f)
        
        config_manager = ConfigManager(config_file)
        unified_logger = UnifiedLogger(config_manager)
        
        logger = unified_logger.get_logger("test_fallback")
        
        # This should not raise an exception, even though file writing will fail
        logger.info("This should not crash")
        logger.error("This should also not crash")
    
    def test_consistent_formatting_with_frontend(self):
        """Test that backend logs use consistent formatting with frontend logs"""
        logger = self.unified_logger.get_logger("api")
        
        logger.info("Backend processing request", extra={"requestId": "123"})
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            
            # Should follow the same format as frontend logs
            assert "[INFO] [BACKEND]" in content
            assert "Backend processing request" in content
            assert '"requestId":"123"' in content
            # Should have timestamp in ISO format
            assert "T" in content and "Z" in content