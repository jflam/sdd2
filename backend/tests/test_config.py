import pytest
import json
import tempfile
import os
from unittest.mock import patch, mock_open

from src.config import ConfigManager, LoggingConfig, LogFormatConfig


class TestConfigManager:
    def test_default_config_creation(self):
        """Test that default configuration is created when no file exists"""
        with patch('os.path.exists', return_value=False):
            config_manager = ConfigManager()
            config = config_manager.get_config()
            
            assert isinstance(config, LoggingConfig)
            assert config.log_file_path == 'logs/unified.log'
            assert config.max_file_size_mb == 10
            assert config.api_port == 8000
            assert config.log_level == 'INFO'
            assert config.enabled is True

    def test_config_loading_from_file(self):
        """Test loading configuration from a JSON file"""
        config_data = {
            'log_file_path': 'custom/path.log',
            'max_file_size_mb': 20,
            'api_port': 9000,
            'log_level': 'DEBUG',
            'format_config': {
                'include_timestamp': False,
                'timestamp_format': 'unix'
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            config_manager = ConfigManager(config_path)
            config = config_manager.get_config()
            
            assert config.log_file_path == 'custom/path.log'
            assert config.max_file_size_mb == 20
            assert config.api_port == 9000
            assert config.log_level == 'DEBUG'
            assert config.format_config.include_timestamp is False
            assert config.format_config.timestamp_format == 'unix'
        finally:
            os.unlink(config_path)

    def test_invalid_json_fallback_to_default(self):
        """Test fallback to default config when JSON is invalid"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('invalid json content')
            config_path = f.name
        
        try:
            with patch('builtins.print'):  # Suppress warning output
                config_manager = ConfigManager(config_path)
                config = config_manager.get_config()
                
                # Should use default values
                assert config.log_file_path == 'logs/unified.log'
                assert config.api_port == 8000
        finally:
            os.unlink(config_path)

    def test_config_validation_max_file_size(self):
        """Test validation of max_file_size_mb"""
        config_data = {'max_file_size_mb': -1}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            with pytest.raises(ValueError, match="max_file_size_mb must be greater than 0"):
                ConfigManager(config_path)
        finally:
            os.unlink(config_path)

    def test_config_validation_rotation_count(self):
        """Test validation of rotation_count"""
        config_data = {'rotation_count': -1}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            with pytest.raises(ValueError, match="rotation_count must be non-negative"):
                ConfigManager(config_path)
        finally:
            os.unlink(config_path)

    def test_config_validation_api_port(self):
        """Test validation of api_port"""
        config_data = {'api_port': 70000}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            with pytest.raises(ValueError, match="api_port must be between 1 and 65535"):
                ConfigManager(config_path)
        finally:
            os.unlink(config_path)

    def test_config_validation_log_level(self):
        """Test validation of log_level"""
        config_data = {'log_level': 'INVALID'}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            with pytest.raises(ValueError, match="log_level must be one of"):
                ConfigManager(config_path)
        finally:
            os.unlink(config_path)

    def test_config_validation_timestamp_format(self):
        """Test validation of timestamp_format"""
        config_data = {
            'format_config': {
                'timestamp_format': 'invalid'
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = f.name
        
        try:
            with pytest.raises(ValueError, match="timestamp_format must be one of"):
                ConfigManager(config_path)
        finally:
            os.unlink(config_path)

    def test_update_config(self):
        """Test updating configuration values"""
        config_manager = ConfigManager()
        
        config_manager.update_config(log_level='ERROR', api_port=9001)
        config = config_manager.get_config()
        
        assert config.log_level == 'ERROR'
        assert config.api_port == 9001

    def test_update_config_invalid_key(self):
        """Test updating with invalid configuration key"""
        config_manager = ConfigManager()
        
        with pytest.raises(ValueError, match="Unknown configuration key"):
            config_manager.update_config(invalid_key='value')

    def test_save_config(self):
        """Test saving configuration to file"""
        config_manager = ConfigManager()
        config_manager.update_config(log_level='DEBUG', api_port=9002)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            save_path = f.name
        
        try:
            config_manager.save_config(save_path)
            
            # Load and verify saved config
            with open(save_path, 'r') as f:
                saved_data = json.load(f)
            
            assert saved_data['log_level'] == 'DEBUG'
            assert saved_data['api_port'] == 9002
        finally:
            os.unlink(save_path)

    def test_is_log_level_enabled(self):
        """Test log level checking"""
        config_manager = ConfigManager()
        config_manager.update_config(log_level='WARNING')
        
        assert config_manager.is_log_level_enabled('WARNING') is True
        assert config_manager.is_log_level_enabled('ERROR') is True
        assert config_manager.is_log_level_enabled('CRITICAL') is True
        assert config_manager.is_log_level_enabled('INFO') is False
        assert config_manager.is_log_level_enabled('DEBUG') is False

    def test_is_log_level_enabled_when_disabled(self):
        """Test log level checking when logging is disabled"""
        config_manager = ConfigManager()
        config_manager.update_config(enabled=False)
        
        assert config_manager.is_log_level_enabled('ERROR') is False
        assert config_manager.is_log_level_enabled('CRITICAL') is False

    def test_format_config_defaults(self):
        """Test that format config has proper defaults"""
        config_manager = ConfigManager()
        config = config_manager.get_config()
        
        assert config.format_config.include_timestamp is True
        assert config.format_config.timestamp_format == 'iso'
        assert config.format_config.include_source is True
        assert config.format_config.include_context is True
        assert config.format_config.max_message_length == 1000


class TestLogFormatConfig:
    def test_default_values(self):
        """Test default values for LogFormatConfig"""
        format_config = LogFormatConfig()
        
        assert format_config.include_timestamp is True
        assert format_config.timestamp_format == 'iso'
        assert format_config.include_source is True
        assert format_config.include_context is True
        assert format_config.max_message_length == 1000

    def test_custom_values(self):
        """Test custom values for LogFormatConfig"""
        format_config = LogFormatConfig(
            include_timestamp=False,
            timestamp_format='unix',
            include_source=False,
            include_context=False,
            max_message_length=500
        )
        
        assert format_config.include_timestamp is False
        assert format_config.timestamp_format == 'unix'
        assert format_config.include_source is False
        assert format_config.include_context is False
        assert format_config.max_message_length == 500


class TestLoggingConfig:
    def test_default_values(self):
        """Test default values for LoggingConfig"""
        config = LoggingConfig()
        
        assert config.log_file_path == 'logs/unified.log'
        assert config.max_file_size_mb == 10
        assert config.rotation_count == 5
        assert config.flush_immediately is True
        assert config.api_port == 8000
        assert config.api_host == '127.0.0.1'
        assert config.log_level == 'INFO'
        assert config.enabled is True
        assert isinstance(config.format_config, LogFormatConfig)

    def test_custom_values(self):
        """Test custom values for LoggingConfig"""
        format_config = LogFormatConfig(include_timestamp=False)
        config = LoggingConfig(
            log_file_path='custom.log',
            max_file_size_mb=20,
            api_port=9000,
            log_level='DEBUG',
            enabled=False,
            format_config=format_config
        )
        
        assert config.log_file_path == 'custom.log'
        assert config.max_file_size_mb == 20
        assert config.api_port == 9000
        assert config.log_level == 'DEBUG'
        assert config.enabled is False
        assert config.format_config.include_timestamp is False

    def test_environment_variable_overrides(self):
        """Test environment variable overrides for configuration"""
        import os
        
        # Store original environment
        original_env = {}
        env_vars = ['LOG_FILE_PATH', 'LOG_LEVEL', 'API_PORT', 'FLUSH_IMMEDIATELY']
        for var in env_vars:
            original_env[var] = os.environ.get(var)
        
        try:
            # Set environment variables
            os.environ['LOG_FILE_PATH'] = '/tmp/test_env.log'
            os.environ['LOG_LEVEL'] = 'DEBUG'
            os.environ['API_PORT'] = '9999'
            os.environ['FLUSH_IMMEDIATELY'] = 'false'
            
            # Create config manager (should pick up env vars)
            config_manager = ConfigManager()
            config = config_manager.get_config()
            
            # Check that environment variables were applied
            assert config.log_file_path == '/tmp/test_env.log'
            assert config.log_level == 'DEBUG'
            assert config.api_port == 9999
            assert config.flush_immediately is False
            
        finally:
            # Restore original environment
            for var in env_vars:
                if original_env[var] is not None:
                    os.environ[var] = original_env[var]
                elif var in os.environ:
                    del os.environ[var]