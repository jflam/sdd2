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

class LoggingConfig(BaseModel):
    log_file_path: str = "unified.log"
    max_file_size_mb: int = 10
    rotation_count: int = 5
    flush_immediately: bool = True
    api_port: int = 8000