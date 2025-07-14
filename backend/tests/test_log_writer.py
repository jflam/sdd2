import os
import tempfile
import pytest
from pathlib import Path
from backend.src.log_writer import LogWriter
from backend.src.models import LogEntry, LoggingConfig

class TestLogWriter:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.log_file = os.path.join(self.temp_dir, "test.log")
        self.config = LoggingConfig(
            log_file_path=self.log_file,
            max_file_size_mb=1,
            rotation_count=3,
            flush_immediately=True
        )
        self.log_writer = LogWriter(self.config)
    
    def teardown_method(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_write_single_entry(self):
        """Test writing a single log entry"""
        entry = LogEntry(
            timestamp="2025-01-14T10:30:00.000Z",
            level="info",
            message="Test message",
            source="frontend",
            context={"userId": "123"}
        )
        
        self.log_writer.write_entry(entry)
        
        # Verify file was created and contains expected content
        assert os.path.exists(self.log_file)
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            assert "[2025-01-14T10:30:00.000Z]" in content
            assert "[INFO]" in content
            assert "[FRONTEND]" in content
            assert "Test message" in content
            assert '{"userId":"123"}' in content
    
    def test_write_entry_with_stack_trace(self):
        """Test writing an entry with stack trace"""
        entry = LogEntry(
            timestamp="2025-01-14T10:30:00.000Z",
            level="error",
            message="Exception occurred",
            source="backend",
            stackTrace="Traceback (most recent call last):\n  File test.py, line 1"
        )
        
        self.log_writer.write_entry(entry)
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            assert "Exception occurred" in content
            assert "Traceback (most recent call last):" in content
    
    def test_write_batch_entries(self):
        """Test writing multiple entries in a batch"""
        entries = [
            LogEntry(
                timestamp="2025-01-14T10:30:00.000Z",
                level="info",
                message="First message",
                source="frontend"
            ),
            LogEntry(
                timestamp="2025-01-14T10:30:01.000Z",
                level="warn",
                message="Second message",
                source="backend"
            )
        ]
        
        self.log_writer.write_batch(entries)
        
        with open(self.log_file, 'r') as f:
            content = f.read()
            lines = content.strip().split('\n')
            assert len(lines) == 2
            assert "First message" in lines[0]
            assert "Second message" in lines[1]
    
    def test_log_rotation(self):
        """Test log rotation when file exceeds max size"""
        # Create a config with very small max size to trigger rotation
        small_config = LoggingConfig(
            log_file_path=self.log_file,
            max_file_size_mb=0.001,  # Very small to trigger rotation
            rotation_count=2
        )
        writer = LogWriter(small_config)
        
        # Write enough entries to trigger rotation
        for i in range(100):
            entry = LogEntry(
                timestamp="2025-01-14T10:30:00.000Z",
                level="info",
                message=f"Message {i} with lots of content to make the file large enough for rotation testing",
                source="frontend"
            )
            writer.write_entry(entry)
        
        # Check that rotation occurred
        rotated_file = Path(self.log_file).with_suffix('.1')
        assert rotated_file.exists()
    
    def test_format_log_entry(self):
        """Test log entry formatting"""
        entry = LogEntry(
            timestamp="2025-01-14T10:30:00.000Z",
            level="debug",
            message="Debug message",
            source="frontend",
            component="logger",
            context={"key": "value"}
        )
        
        formatted = self.log_writer._format_log_entry(entry)
        expected = '[2025-01-14T10:30:00.000Z] [DEBUG] [FRONTEND] [LOGGER] Debug message {"key":"value"}'
        assert formatted == expected
    
    def test_ensure_log_directory_creation(self):
        """Test that log directory is created if it doesn't exist"""
        nested_log_path = os.path.join(self.temp_dir, "logs", "nested", "test.log")
        config = LoggingConfig(log_file_path=nested_log_path)
        
        writer = LogWriter(config)
        
        # Directory should be created
        assert os.path.exists(os.path.dirname(nested_log_path))