import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import List
from .models import LogEntry, LoggingConfig
from .config import ConfigManager

class LogWriter:
    def __init__(self, config: LoggingConfig, config_manager: ConfigManager = None):
        self.config = config
        self.config_manager = config_manager
        self.lock = threading.Lock()
        self._ensure_log_directory()
    
    def _ensure_log_directory(self):
        """Ensure the log directory exists"""
        try:
            log_path = Path(self.config.log_file_path)
            log_path.parent.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError) as e:
            # If we can't create the directory, log the error but don't crash
            print(f"Warning: Could not create log directory: {e}", file=__import__('sys').stderr)
    
    def _format_log_entry(self, entry: LogEntry) -> str:
        """Format a log entry for writing to file"""
        format_config = self.config.format_config
        parts = []
        
        # Add timestamp if enabled
        if format_config.include_timestamp:
            timestamp = self._format_timestamp(entry.timestamp, format_config.timestamp_format)
            parts.append(f"[{timestamp}]")
        
        # Add log level
        parts.append(f"[{entry.level.upper()}]")
        
        # Add source if enabled
        if format_config.include_source:
            parts.append(f"[{entry.source.upper()}]")
        
        # Add component if present
        if entry.component:
            parts.append(f"[{entry.component.upper()}]")
        
        # Add message (with length limit if configured)
        message = entry.message
        if format_config.max_message_length and len(message) > format_config.max_message_length:
            message = message[:format_config.max_message_length] + "..."
        parts.append(message)
        
        # Add context if enabled and present
        if format_config.include_context and entry.context:
            context_str = json.dumps(entry.context, separators=(',', ':'))
            parts.append(context_str)
        
        # Join main parts
        formatted_entry = " ".join(parts)
        
        # Add stack trace if present (always on new line)
        if entry.stackTrace:
            formatted_entry += f"\n{entry.stackTrace}"
        
        return formatted_entry
    
    def _format_timestamp(self, timestamp_str: str, format_type: str) -> str:
        """Format timestamp according to the specified format"""
        try:
            # Parse ISO timestamp
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            
            if format_type == 'iso':
                return timestamp_str
            elif format_type == 'local':
                return dt.strftime('%Y-%m-%d %H:%M:%S')
            elif format_type == 'unix':
                return str(int(dt.timestamp()))
            else:
                return timestamp_str
        except Exception:
            # Fallback to original timestamp if parsing fails
            return timestamp_str
    
    def write_entry(self, entry: LogEntry) -> None:
        """Write a single log entry to the unified log file"""
        with self.lock:
            try:
                formatted_entry = self._format_log_entry(entry)
                
                with open(self.config.log_file_path, 'a', encoding='utf-8') as f:
                    f.write(formatted_entry + '\n')
                    if self.config.flush_immediately:
                        f.flush()
                        os.fsync(f.fileno())
                
                # Check if rotation is needed
                self._check_rotation()
                
            except Exception as e:
                # Fallback to stderr if file writing fails
                print(f"Failed to write to log file: {e}", file=__import__('sys').stderr)
    
    def write_batch(self, entries: List[LogEntry]) -> None:
        """Write multiple log entries in a batch"""
        with self.lock:
            try:
                formatted_entries = [self._format_log_entry(entry) for entry in entries]
                
                with open(self.config.log_file_path, 'a', encoding='utf-8') as f:
                    for formatted_entry in formatted_entries:
                        f.write(formatted_entry + '\n')
                    
                    if self.config.flush_immediately:
                        f.flush()
                        os.fsync(f.fileno())
                
                # Check if rotation is needed
                self._check_rotation()
                
            except Exception as e:
                # Fallback to stderr if file writing fails
                print(f"Failed to write batch to log file: {e}", file=__import__('sys').stderr)
    
    def _check_rotation(self) -> None:
        """Check if log rotation is needed and perform it"""
        try:
            if not os.path.exists(self.config.log_file_path):
                return
            
            file_size_mb = os.path.getsize(self.config.log_file_path) / (1024 * 1024)
            
            if file_size_mb > self.config.max_file_size_mb:
                self._rotate_logs()
        
        except Exception as e:
            print(f"Failed to check log rotation: {e}", file=__import__('sys').stderr)
    
    def _rotate_logs(self) -> None:
        """Rotate log files when they exceed the maximum size"""
        try:
            base_path = Path(self.config.log_file_path)
            
            # Remove the oldest log file if it exists
            oldest_log = base_path.with_suffix(f'.{self.config.rotation_count}')
            if oldest_log.exists():
                oldest_log.unlink()
            
            # Rotate existing log files
            for i in range(self.config.rotation_count - 1, 0, -1):
                current_log = base_path.with_suffix(f'.{i}')
                next_log = base_path.with_suffix(f'.{i + 1}')
                
                if current_log.exists():
                    current_log.rename(next_log)
            
            # Move current log to .1
            if base_path.exists():
                rotated_log = base_path.with_suffix('.1')
                base_path.rename(rotated_log)
            
        except Exception as e:
            print(f"Failed to rotate logs: {e}", file=__import__('sys').stderr)
    
    def setup_rotation(self, max_size_mb: int) -> None:
        """Update the maximum file size for rotation"""
        self.config.max_file_size_mb = max_size_mb