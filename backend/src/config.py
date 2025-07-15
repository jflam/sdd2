import os
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class LogFormatConfig:
    include_timestamp: bool = True
    timestamp_format: str = 'iso'  # 'iso', 'local', 'unix'
    include_source: bool = True
    include_context: bool = True
    max_message_length: Optional[int] = 1000

@dataclass
class LoggingConfig:
    log_file_path: str = 'logs/unified.log'
    max_file_size_mb: int = 10
    rotation_count: int = 5
    flush_immediately: bool = True
    api_port: int = 8000
    api_host: str = '127.0.0.1'
    log_level: str = 'INFO'
    enabled: bool = True
    format_config: LogFormatConfig = None

    def __post_init__(self):
        if self.format_config is None:
            self.format_config = LogFormatConfig()

class ConfigManager:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._get_default_config_path()
        self.config = self._load_config()
        self._validate_config()

    def _get_default_config_path(self) -> str:
        return os.path.join(os.path.dirname(__file__), '..', 'config', 'logging.json')

    def _load_config(self) -> LoggingConfig:
        """Load configuration from file or use defaults, with environment variable overrides"""
        config_data = {}
        
        # First, try to load from file if it exists
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    config_data = json.load(f)
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                print(f"Warning: Failed to load config from {self.config_path}: {e}")
                print("Using default configuration")
        
        # Apply environment variable overrides
        env_overrides = self._get_env_overrides()
        config_data.update(env_overrides)
        
        if config_data:
            return self._dict_to_config(config_data)
        else:
            return LoggingConfig()

    def _get_env_overrides(self) -> Dict[str, Any]:
        """Get configuration overrides from environment variables"""
        overrides = {}
        
        # Map environment variable names to config fields
        env_mapping = {
            'LOG_FILE_PATH': 'log_file_path',
            'MAX_FILE_SIZE_MB': 'max_file_size_mb',
            'ROTATION_COUNT': 'rotation_count',
            'FLUSH_IMMEDIATELY': 'flush_immediately',
            'API_PORT': 'api_port',
            'API_HOST': 'api_host',
            'LOG_LEVEL': 'log_level',
            'ENABLED': 'enabled',
        }
        
        for env_var, config_field in env_mapping.items():
            value = os.environ.get(env_var)
            if value is not None:
                # Convert string values to appropriate types
                if config_field in ['max_file_size_mb', 'rotation_count', 'api_port']:
                    try:
                        overrides[config_field] = int(value)
                    except ValueError:
                        print(f"Warning: Invalid integer value for {env_var}: {value}")
                elif config_field in ['flush_immediately', 'enabled']:
                    overrides[config_field] = value.lower() in ('true', '1', 'yes', 'on')
                else:
                    overrides[config_field] = value
        
        return overrides

    def _dict_to_config(self, data: Dict[str, Any]) -> LoggingConfig:
        """Convert dictionary to LoggingConfig object"""
        format_data = data.pop('format_config', {})
        format_config = LogFormatConfig(**format_data)
        
        return LoggingConfig(
            format_config=format_config,
            **data
        )

    def _validate_config(self) -> None:
        """Validate configuration values"""
        if self.config.max_file_size_mb <= 0:
            raise ValueError("max_file_size_mb must be greater than 0")
        
        if self.config.rotation_count < 0:
            raise ValueError("rotation_count must be non-negative")
        
        if self.config.api_port <= 0 or self.config.api_port > 65535:
            raise ValueError("api_port must be between 1 and 65535")
        
        valid_log_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if self.config.log_level not in valid_log_levels:
            raise ValueError(f"log_level must be one of: {valid_log_levels}")
        
        valid_timestamp_formats = ['iso', 'local', 'unix']
        if self.config.format_config.timestamp_format not in valid_timestamp_formats:
            raise ValueError(f"timestamp_format must be one of: {valid_timestamp_formats}")

    def get_config(self) -> LoggingConfig:
        """Get a copy of the current configuration"""
        return LoggingConfig(
            log_file_path=self.config.log_file_path,
            max_file_size_mb=self.config.max_file_size_mb,
            rotation_count=self.config.rotation_count,
            flush_immediately=self.config.flush_immediately,
            api_port=self.config.api_port,
            api_host=self.config.api_host,
            log_level=self.config.log_level,
            enabled=self.config.enabled,
            format_config=LogFormatConfig(
                include_timestamp=self.config.format_config.include_timestamp,
                timestamp_format=self.config.format_config.timestamp_format,
                include_source=self.config.format_config.include_source,
                include_context=self.config.format_config.include_context,
                max_message_length=self.config.format_config.max_message_length
            )
        )

    def update_config(self, **kwargs) -> None:
        """Update configuration values"""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
            else:
                raise ValueError(f"Unknown configuration key: {key}")
        
        self._validate_config()

    def save_config(self, path: Optional[str] = None) -> None:
        """Save current configuration to file"""
        save_path = path or self.config_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        config_dict = asdict(self.config)
        
        with open(save_path, 'w') as f:
            json.dump(config_dict, f, indent=2)

    def is_log_level_enabled(self, level: str) -> bool:
        """Check if a log level should be processed"""
        if not self.config.enabled:
            return False
        
        level_hierarchy = {
            'DEBUG': 0,
            'INFO': 1,
            'WARNING': 2,
            'ERROR': 3,
            'CRITICAL': 4
        }
        
        current_level = level_hierarchy.get(self.config.log_level, 1)
        check_level = level_hierarchy.get(level.upper(), 0)
        
        return check_level >= current_level