from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

class LogEntry(BaseModel):
    timestamp: str
    level: Literal['debug', 'info', 'warn', 'error']
    message: str
    source: Literal['frontend', 'backend']
    context: Optional[dict] = None
    stackTrace: Optional[str] = None
    component: Optional[str] = None

class LogBatch(BaseModel):
    entries: List[LogEntry]

class LogFormatConfig(BaseModel):
    include_timestamp: bool = True
    timestamp_format: Literal['iso', 'local', 'unix'] = 'iso'
    include_source: bool = True
    include_context: bool = True
    max_message_length: Optional[int] = 1000

class LoggingConfig(BaseModel):
    log_file_path: str = "logs/unified.log"
    max_file_size_mb: int = 10
    rotation_count: int = 5
    flush_immediately: bool = True
    api_port: int = 8000
    api_host: str = "127.0.0.1"
    log_level: str = "INFO"
    enabled: bool = True
    format_config: LogFormatConfig = LogFormatConfig()