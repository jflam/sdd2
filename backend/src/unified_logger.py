import logging
import sys
from datetime import datetime, timezone
from typing import Optional
from .models import LogEntry, LoggingConfig
from .log_writer import LogWriter
from .config import ConfigManager

class UnifiedLogHandler(logging.Handler):
    """Custom logging handler that writes to the unified log file"""
    
    def __init__(self, log_writer: LogWriter, config_manager: ConfigManager):
        super().__init__()
        self.log_writer = log_writer
        self.config_manager = config_manager
    
    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record to the unified log file"""
        try:
            # Convert Python log level to our standard levels
            level_mapping = {
                logging.DEBUG: 'debug',
                logging.INFO: 'info',
                logging.WARNING: 'warn',
                logging.ERROR: 'error',
                logging.CRITICAL: 'error'
            }
            
            level = level_mapping.get(record.levelno, 'info')
            
            # Format the message
            message = self.format(record)
            
            # Extract stack trace if present
            stack_trace = None
            if record.exc_info:
                import traceback
                stack_trace = ''.join(traceback.format_exception(*record.exc_info))
            
            # Create context from record attributes
            context = {
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno
            }
            
            # Add any extra attributes
            for key, value in record.__dict__.items():
                if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 
                              'pathname', 'filename', 'module', 'lineno', 
                              'funcName', 'created', 'msecs', 'relativeCreated',
                              'thread', 'threadName', 'processName', 'process',
                              'getMessage', 'exc_info', 'exc_text', 'stack_info']:
                    context[key] = value
            
            # Create log entry
            log_entry = LogEntry(
                timestamp=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                level=level,
                message=message,
                source='backend',
                context=context,
                stackTrace=stack_trace,
                component=record.name
            )
            
            # Write to unified log
            self.log_writer.write_entry(log_entry)
            
        except Exception as e:
            # Fallback to stderr if unified logging fails
            print(f"Failed to write to unified log: {e}", file=sys.stderr)
            # Still try to emit to console
            try:
                print(f"[{datetime.now(timezone.utc).isoformat()}] [{record.levelname}] [BACKEND] {self.format(record)}", 
                      file=sys.stderr)
            except:
                pass

class UnifiedLogger:
    """Unified logging system for the backend"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.config = config_manager.get_config()
        self.log_writer = LogWriter(self.config, config_manager)
        self.handler = UnifiedLogHandler(self.log_writer, config_manager)
        self._setup_logging()
    
    def _setup_logging(self):
        """Set up Python logging to use the unified log handler"""
        # Create formatter
        formatter = logging.Formatter(
            '%(name)s - %(message)s'
        )
        self.handler.setFormatter(formatter)
        
        # Get root logger and configure it
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers to avoid duplicate logs
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Add our unified handler
        root_logger.addHandler(self.handler)
        
        # Also add a console handler for development
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        root_logger.addHandler(console_handler)
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get a logger instance"""
        return logging.getLogger(name)
    
    def log_startup(self, service_name: str, version: str):
        """Log service startup message"""
        logger = self.get_logger('startup')
        logger.info(f"Loading {service_name} {version}")
    
    def log_exception(self, logger_name: str, message: str, exc_info=None):
        """Log an exception with full details"""
        logger = self.get_logger(logger_name)
        logger.error(message, exc_info=exc_info or sys.exc_info())

# Global unified logger instance
_unified_logger: Optional[UnifiedLogger] = None

def setup_unified_logging(config_manager: ConfigManager) -> UnifiedLogger:
    """Set up the global unified logging system"""
    global _unified_logger
    _unified_logger = UnifiedLogger(config_manager)
    return _unified_logger

def setup_unified_logging_from_config(config: LoggingConfig) -> UnifiedLogger:
    """Set up the global unified logging system from a config object"""
    # Create a temporary config manager from the config
    import tempfile
    import json
    import os
    
    # Create a temporary config file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(config.model_dump(), f)
        temp_config_path = f.name
    
    try:
        config_manager = ConfigManager(temp_config_path)
        return setup_unified_logging(config_manager)
    finally:
        # Clean up the temporary file
        os.unlink(temp_config_path)

def get_unified_logger() -> Optional[UnifiedLogger]:
    """Get the global unified logger instance"""
    return _unified_logger