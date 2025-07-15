#!/bin/bash

# Safari Extension Unified Logging - Log Monitor Script
# This script helps monitor the unified log file in real-time

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Safari Extension Unified Logging - Log Monitor${NC}"
echo "=============================================="

# Check if unified log file exists
UNIFIED_LOG="logs/unified.log"
BACKEND_LOG="backend/logs/unified.log"

if [ -f "$UNIFIED_LOG" ]; then
    LOG_FILE="$UNIFIED_LOG"
elif [ -f "$BACKEND_LOG" ]; then
    LOG_FILE="$BACKEND_LOG"
else
    echo -e "${YELLOW}⚠️  No unified log file found. Creating directory structure...${NC}"
    mkdir -p logs
    mkdir -p backend/logs
    touch logs/unified.log
    LOG_FILE="logs/unified.log"
    echo -e "${GREEN}✅ Created log file: $LOG_FILE${NC}"
fi

echo -e "${GREEN}📋 Monitoring log file: $LOG_FILE${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
echo "=============================================="

# Start monitoring with tail -f
tail -f "$LOG_FILE"