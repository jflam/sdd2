# Safari Extension Unified Logging System

A comprehensive logging solution that unifies frontend Safari extension logs and backend Python API logs into a single, real-time monitorable log file.

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **macOS** (for Safari extension development)

### Development Setup

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd safari-extension-unified-logging
   ```

2. **Start the development environment:**
   ```bash
   ./start-dev.sh
   ```
   
   This script will:
   - Set up Python virtual environment
   - Install all dependencies (Python + Node.js)
   - Start the backend API server (port 8000)
   - Start the frontend development server (port 5173)

3. **Monitor logs in real-time:**
   ```bash
   # In a separate terminal
   ./monitor-logs.sh
   ```
   
   Or manually:
   ```bash
   tail -f logs/unified.log
   ```

## 📊 Real-Time Log Monitoring

The unified logging system writes all frontend and backend events to a single log file that can be monitored in real-time using `tail -f`.

### Log Monitoring Commands

```bash
# Monitor the main unified log file
tail -f logs/unified.log

# Monitor with line numbers
tail -f logs/unified.log | nl

# Monitor and filter for errors only
tail -f logs/unified.log | grep ERROR

# Monitor and highlight different log levels
tail -f logs/unified.log | grep --color=always -E "(ERROR|WARN|INFO|DEBUG)"
```

### Log Format

Each log entry follows this format:
```
[2025-01-14T10:30:00.000Z] [LEVEL] [SOURCE] Message {"context": "data"}
```

- **Timestamp**: ISO 8601 format
- **Level**: DEBUG, INFO, WARN, ERROR
- **Source**: FRONTEND or BACKEND
- **Message**: Human-readable log message
- **Context**: JSON object with additional metadata (optional)

### Example Log Output

```
[2025-01-14T10:30:00.000Z] [INFO] [FRONTEND] Loading Safari Extension Unified Logging 1.0.1
[2025-01-14T10:30:00.100Z] [INFO] [BACKEND] API server started on port 8000
[2025-01-14T10:30:05.200Z] [DEBUG] [FRONTEND] User clicked submit button {"userId": "123"}
[2025-01-14T10:30:05.250Z] [INFO] [BACKEND] Processing log batch {"entries": 1}
[2025-01-14T10:30:05.300Z] [ERROR] [FRONTEND] Validation failed {"field": "email", "error": "Invalid format"}
```

## 🏗️ Architecture

```
┌─────────────────────┐    HTTP POST    ┌─────────────────────┐
│ Safari Extension    │ ──────────────► │ Python Backend API  │
│ (ViteJS Frontend)   │                 │ (FastAPI)           │
└─────────────────────┘                 └─────────────────────┘
           │                                        │
           │ Async Log Queue                        │ Direct Write
           │                                        │
           └────────────────────┬───────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │  Unified Log File   │
                    │   logs/unified.log  │
                    └─────────────────────┘
                                │
                                ▼ tail -f
                    ┌─────────────────────┐
                    │    Developer        │
                    │  Real-time Monitor  │
                    └─────────────────────┘
```

## 🔧 Configuration

### Frontend Configuration

Located in `frontend/config/logging.json`:

```json
{
  "apiEndpoint": "http://localhost:8000/api/logs",
  "batchSize": 10,
  "flushInterval": 1000,
  "maxQueueSize": 100,
  "logLevel": "debug",
  "retryAttempts": 3
}
```

### Backend Configuration

Located in `backend/config/logging.json`:

```json
{
  "logFilePath": "logs/unified.log",
  "maxFileSizeMB": 10,
  "rotationCount": 5,
  "flushImmediately": true,
  "apiPort": 8000
}
```

## 🧪 Testing

### Run All Tests

```bash
# Backend tests
cd backend
source venv/bin/activate
pytest

# Frontend tests
cd frontend
npm test
```

### Integration Testing

```bash
# Run end-to-end tests
cd backend
pytest tests/test_end_to_end.py -v
```

## 📱 Safari Extension Development

### Building the Extension

```bash
cd frontend
npm run build
```

The built extension will be in `frontend/dist/` and can be loaded into Safari for testing.

### Extension Features

- **Automatic Logging**: All console logs are captured and sent to the unified log
- **Exception Handling**: Unhandled exceptions are automatically logged with stack traces
- **Version Tracking**: Extension version is logged on startup
- **Async Operation**: Logging doesn't block the UI

## 🔍 API Endpoints

### POST /api/logs
Submit log entries from the frontend.

**Request Body:**
```json
{
  "entries": [
    {
      "timestamp": "2025-01-14T10:30:00.000Z",
      "level": "info",
      "message": "User action completed",
      "source": "frontend",
      "context": {"userId": "123"}
    }
  ]
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T10:30:00.000Z"
}
```

### GET /docs
Interactive API documentation (Swagger UI).

## 🛠️ Development Workflow

1. **Start the development environment:**
   ```bash
   ./start-dev.sh
   ```

2. **Open log monitoring in a separate terminal:**
   ```bash
   ./monitor-logs.sh
   ```

3. **Make changes to frontend or backend code**

4. **Watch logs in real-time** to see your changes take effect

5. **Run tests** to ensure everything works:
   ```bash
   # Backend tests
   cd backend && pytest
   
   # Frontend tests
   cd frontend && npm test
   ```

## 📂 Project Structure

```
safari-extension-unified-logging/
├── frontend/                 # Safari extension (ViteJS + TypeScript)
│   ├── src/
│   │   ├── logger.ts        # Main logging service
│   │   ├── log-queue.ts     # Async log queue
│   │   ├── exception-handler.ts
│   │   └── background.ts    # Extension background script
│   ├── config/
│   │   └── logging.json     # Frontend logging config
│   └── package.json
├── backend/                  # Python API server
│   ├── src/
│   │   ├── api.py          # FastAPI application
│   │   ├── log_writer.py   # Log file writer
│   │   └── unified_logger.py
│   ├── config/
│   │   └── logging.json    # Backend logging config
│   ├── logs/               # Backend log files
│   └── requirements.txt
├── logs/                   # Main unified log directory
│   └── unified.log        # The unified log file
├── start-dev.sh           # Development setup script
├── monitor-logs.sh        # Log monitoring script
└── README.md             # This file
```

## 🚨 Troubleshooting

See the [Debugging Guide](DEBUGGING.md) for common issues and solutions.

## 📄 License

[Add your license information here]