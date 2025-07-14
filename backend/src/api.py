from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import logging
from typing import Dict, Any

from .models import LogBatch, LogEntry, LoggingConfig
from .log_writer import LogWriter
from .unified_logger import setup_unified_logging, get_unified_logger

# Initialize logging configuration and writer
config = LoggingConfig()
log_writer = LogWriter(config)

# Set up unified logging system
unified_logger = setup_unified_logging(config)
logger = unified_logger.get_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Safari Extension Unified Logging API",
    description="API endpoint for receiving log data from Safari extension frontend",
    version="1.0.1"
)

# Configure CORS for Safari extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the extension's origin
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Log startup
unified_logger.log_startup("Safari Extension Unified Logging API", "1.0.1")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Safari Extension Unified Logging API", "version": "1.0.1"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "unified-logging-api"}

@app.post("/api/logs")
async def receive_logs(log_batch: LogBatch) -> Dict[str, Any]:
    """
    Receive log entries from the Safari extension frontend
    
    Args:
        log_batch: Batch of log entries to process
        
    Returns:
        Success response with processed count
        
    Raises:
        HTTPException: If validation fails or processing errors occur
    """
    try:
        # Validate that we have entries
        if not log_batch.entries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No log entries provided"
            )
        
        # Validate each entry
        for i, entry in enumerate(log_batch.entries):
            if not entry.timestamp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Entry {i}: timestamp is required"
                )
            if not entry.message:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Entry {i}: message is required"
                )
        
        # Write the batch to the unified log file
        log_writer.write_batch(log_batch.entries)
        
        # Log the successful processing
        logger.info(f"Successfully processed {len(log_batch.entries)} log entries")
        
        return {
            "status": "success",
            "message": f"Successfully processed {len(log_batch.entries)} log entries",
            "processed_count": len(log_batch.entries)
        }
        
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation error: {str(e)}"
        )
    
    except Exception as e:
        logger.error(f"Error processing log batch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while processing logs"
        )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    """Handle Pydantic validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "error",
            "message": "Validation error",
            "details": str(exc)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "Internal server error"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)