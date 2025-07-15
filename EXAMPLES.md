# Safari Extension Unified Logging - Examples

This document provides practical examples of how to use the unified logging system in different scenarios.

## 📝 Basic Logging Examples

### Frontend Logging (Safari Extension)

```typescript
// Import the logger service
import { LoggerService } from './logger';

const logger = new LoggerService();

// Basic logging levels
logger.debug('Debug information for development');
logger.info('User performed an action');
logger.warn('Something unexpected happened');
logger.error('An error occurred');

// Logging with context
logger.info('User login attempt', {
  userId: '12345',
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent
});

// Logging form interactions
logger.debug('Form field changed', {
  fieldName: 'email',
  fieldValue: 'user@example.com',
  formId: 'contact-form'
});
```

### Backend Logging (Python)

```python
# Import the unified logger
from src.unified_logger import get_logger

logger = get_logger(__name__)

# Basic logging levels
logger.debug('Debug information for development')
logger.info('Processing user request')
logger.warning('Deprecated API endpoint used')
logger.error('Database connection failed')

# Logging with extra context
logger.info('User authenticated', extra={
    'user_id': '12345',
    'ip_address': '192.168.1.1',
    'session_id': 'abc123'
})

# Logging API requests
logger.info('API request received', extra={
    'method': 'POST',
    'endpoint': '/api/logs',
    'content_length': len(request_body)
})
```

## 🔧 Configuration Examples

### Frontend Configuration (frontend/config/logging.json)

#### Development Configuration
```json
{
  "apiEndpoint": "http://localhost:8000/api/logs",
  "batchSize": 5,
  "flushInterval": 500,
  "maxQueueSize": 50,
  "logLevel": "debug",
  "retryAttempts": 3,
  "retryDelay": 1000,
  "enableConsoleLogging": true
}
```

#### Production Configuration
```json
{
  "apiEndpoint": "https://api.yourapp.com/api/logs",
  "batchSize": 20,
  "flushInterval": 5000,
  "maxQueueSize": 200,
  "logLevel": "info",
  "retryAttempts": 5,
  "retryDelay": 2000,
  "enableConsoleLogging": false
}
```

### Backend Configuration (backend/config/logging.json)

#### Development Configuration
```json
{
  "logFilePath": "logs/unified.log",
  "maxFileSizeMB": 5,
  "rotationCount": 3,
  "flushImmediately": true,
  "apiPort": 8000,
  "logLevel": "DEBUG",
  "dateFormat": "%Y-%m-%d %H:%M:%S",
  "enableFileLogging": true,
  "enableConsoleLogging": true
}
```

#### Production Configuration
```json
{
  "logFilePath": "/var/log/safari-extension/unified.log",
  "maxFileSizeMB": 50,
  "rotationCount": 10,
  "flushImmediately": false,
  "apiPort": 8000,
  "logLevel": "INFO",
  "dateFormat": "%Y-%m-%d %H:%M:%S",
  "enableFileLogging": true,
  "enableConsoleLogging": false
}
```

## 🎯 Real-World Usage Scenarios

### Scenario 1: User Authentication Flow

```typescript
// Frontend - User clicks login button
logger.info('Login attempt started', {
  email: 'user@example.com',
  timestamp: new Date().toISOString()
});

try {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  
  if (response.ok) {
    logger.info('Login successful', {
      userId: response.userId,
      sessionId: response.sessionId
    });
  } else {
    logger.warn('Login failed', {
      statusCode: response.status,
      error: response.statusText
    });
  }
} catch (error) {
  logger.error('Login request failed', {
    error: error.message,
    stack: error.stack
  });
}
```

```python
# Backend - Processing login request
@app.post("/api/auth/login")
async def login(credentials: LoginCredentials):
    logger.info('Login request received', extra={
        'email': credentials.email,
        'ip_address': request.client.host
    })
    
    try:
        user = authenticate_user(credentials)
        logger.info('User authenticated successfully', extra={
            'user_id': user.id,
            'email': user.email
        })
        return {"status": "success", "userId": user.id}
    except AuthenticationError as e:
        logger.warning('Authentication failed', extra={
            'email': credentials.email,
            'reason': str(e)
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
```

### Scenario 2: Form Validation and Submission

```typescript
// Frontend - Form validation
function validateForm(formData) {
  logger.debug('Starting form validation', {
    formId: 'contact-form',
    fieldCount: Object.keys(formData).length
  });
  
  const errors = [];
  
  if (!formData.email || !isValidEmail(formData.email)) {
    errors.push('Invalid email format');
    logger.warn('Email validation failed', {
      email: formData.email,
      pattern: EMAIL_REGEX.toString()
    });
  }
  
  if (errors.length > 0) {
    logger.error('Form validation failed', {
      errors: errors,
      formData: sanitizeFormData(formData)
    });
    return { valid: false, errors };
  }
  
  logger.info('Form validation passed', {
    formId: 'contact-form'
  });
  return { valid: true };
}
```

### Scenario 3: Error Handling and Recovery

```typescript
// Frontend - Handling API failures with retry logic
class ApiClient {
  async sendLogs(logEntries) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        logger.debug('Sending log batch', {
          attempt: attempt + 1,
          entryCount: logEntries.length
        });
        
        const response = await fetch('/api/logs', {
          method: 'POST',
          body: JSON.stringify({ entries: logEntries })
        });
        
        if (response.ok) {
          logger.info('Log batch sent successfully', {
            entryCount: logEntries.length,
            attempt: attempt + 1
          });
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
      } catch (error) {
        attempt++;
        logger.warn('Log transmission failed', {
          attempt,
          maxRetries,
          error: error.message,
          willRetry: attempt < maxRetries
        });
        
        if (attempt >= maxRetries) {
          logger.error('Log transmission failed permanently', {
            attempts: maxRetries,
            error: error.message,
            fallbackAction: 'storing_locally'
          });
          // Fallback to local storage
          this.storeLogsLocally(logEntries);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }
}
```

## 📊 Log Monitoring Examples

### Basic Monitoring Commands

```bash
# Monitor all logs in real-time
tail -f logs/unified.log

# Monitor only error logs
tail -f logs/unified.log | grep ERROR

# Monitor with timestamps highlighted
tail -f logs/unified.log | grep --color=always -E "\[.*\]"

# Monitor and count log levels
tail -f logs/unified.log | grep -o -E "(DEBUG|INFO|WARN|ERROR)" | sort | uniq -c
```

### Advanced Monitoring with grep

```bash
# Monitor specific user activity
tail -f logs/unified.log | grep "userId.*12345"

# Monitor frontend vs backend logs
tail -f logs/unified.log | grep FRONTEND
tail -f logs/unified.log | grep BACKEND

# Monitor API requests
tail -f logs/unified.log | grep "API request"

# Monitor errors with context (show 2 lines before and after)
tail -f logs/unified.log | grep -A 2 -B 2 ERROR
```

### Log Analysis Examples

```bash
# Count log entries by level (last 1000 lines)
tail -n 1000 logs/unified.log | grep -o -E "(DEBUG|INFO|WARN|ERROR)" | sort | uniq -c

# Find most common error messages
grep ERROR logs/unified.log | cut -d']' -f4 | sort | uniq -c | sort -nr | head -10

# Monitor log file size growth
watch -n 5 'ls -lh logs/unified.log'

# Check log rotation status
ls -la logs/unified.log*
```

## 🔍 Debugging Examples

### Debug Frontend Issues

```typescript
// Enable verbose debugging
const logger = new LoggerService({
  logLevel: 'debug',
  enableConsoleLogging: true
});

// Debug extension lifecycle
logger.debug('Extension background script loaded');
logger.debug('Content script injected', { url: window.location.href });
logger.debug('Popup opened', { timestamp: Date.now() });

// Debug user interactions
document.addEventListener('click', (event) => {
  logger.debug('User clicked element', {
    tagName: event.target.tagName,
    className: event.target.className,
    id: event.target.id
  });
});
```

### Debug Backend Issues

```python
# Enable detailed request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logger.debug('Request started', extra={
        'method': request.method,
        'url': str(request.url),
        'headers': dict(request.headers)
    })
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.debug('Request completed', extra={
        'method': request.method,
        'url': str(request.url),
        'status_code': response.status_code,
        'process_time': f"{process_time:.4f}s"
    })
    
    return response
```

## 🎨 Custom Log Formatting

### Frontend Custom Formatter

```typescript
class CustomLogFormatter {
  format(level: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [FRONTEND] ${message}${contextStr}`;
  }
}

// Use custom formatter
const logger = new LoggerService({
  formatter: new CustomLogFormatter()
});
```

### Backend Custom Formatter

```python
import logging
from datetime import datetime

class CustomFormatter(logging.Formatter):
    def format(self, record):
        timestamp = datetime.utcnow().isoformat() + 'Z'
        level = record.levelname
        message = record.getMessage()
        
        # Add context if available
        context = getattr(record, 'context', {})
        context_str = f" {json.dumps(context)}" if context else ""
        
        return f"[{timestamp}] [{level}] [BACKEND] {message}{context_str}"

# Configure logger with custom formatter
handler = logging.FileHandler('logs/unified.log')
handler.setFormatter(CustomFormatter())
logger.addHandler(handler)
```

This examples document provides comprehensive usage patterns and configuration options for the unified logging system.