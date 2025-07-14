#!/usr/bin/env python3
"""
Startup script for the Safari Extension Unified Logging API server
"""

import uvicorn
from src.api import app

if __name__ == "__main__":
    print("Starting Safari Extension Unified Logging API...")
    print("API will be available at: http://localhost:8000")
    print("API documentation at: http://localhost:8000/docs")
    print("Health check at: http://localhost:8000/health")
    print("\nPress Ctrl+C to stop the server")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload during development
        log_level="info"
    )