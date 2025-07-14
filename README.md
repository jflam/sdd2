# Safari Extension Unified Logging

A Safari browser extension with ViteJS frontend and Python backend that implements unified logging system.

## Features

- Unified logging from both frontend and backend to a single log file
- Asynchronous log transmission to avoid blocking the UI
- Exception handling and stack trace capture
- Real-time log monitoring with `tail -f`
- Configurable log levels and formats
- Version tracking with automatic build increment

## Project Structure

```
├── frontend/           # Safari extension (ViteJS + TypeScript)
│   ├── src/
│   │   ├── types/     # TypeScript interfaces
│   │   ├── popup.html # Extension popup
│   │   └── version.ts # Version tracking
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/           # Python backend (FastAPI)
│   ├── src/
│   │   ├── models.py  # Data models
│   │   └── __init__.py
│   └── requirements.txt
└── .kiro/specs/       # Feature specifications
```

## Development Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Real-time Log Monitoring

The unified logging system is designed for real-time monitoring during development. All log entries are immediately flushed to disk to ensure compatibility with `tail -f`.

### Basic Usage

Monitor the unified log file in real-time:
```bash
# From the backend directory
tail -f logs/unified.log
```

### Development Workflow

1. **Start the backend server:**
   ```bash
   cd backend
   python3 run_server.py
   ```

2. **In a separate terminal, start log monitoring:**
   ```bash
   cd backend
   tail -f logs/unified.log
   ```

3. **Run the frontend extension** - all logs will appear in real-time in the tail terminal

### Log Format

Each log entry follows this format:
```
[TIMESTAMP] [LEVEL] [SOURCE] [COMPONENT] MESSAGE {CONTEXT}
```

Example:
```
[2025-07-14T23:34:33.000Z] [INFO] [FRONTEND] [LOGGER] User clicked submit button {"userId": "123"}
[2025-07-14T23:34:33.100Z] [INFO] [BACKEND] [API] Processing form submission {"formId": "contact"}
```

### Advanced Monitoring

Filter logs by level:
```bash
tail -f logs/unified.log | grep "\[ERROR\]"
```

Filter logs by source:
```bash
tail -f logs/unified.log | grep "\[FRONTEND\]"
tail -f logs/unified.log | grep "\[BACKEND\]"
```

Show only recent entries and follow:
```bash
tail -n 50 -f logs/unified.log
```

### Testing Real-time Functionality

Test that logs appear immediately:
```bash
cd backend
python3 test_tail_f.py
```

This script will guide you through verifying that log entries appear in real-time without buffering.

## Version: 1.0.1