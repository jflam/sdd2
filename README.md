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

Monitor the unified log file in real-time:
```bash
tail -f unified.log
```

## Version: 1.0.1