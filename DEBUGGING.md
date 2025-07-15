# Safari Extension Unified Logging - Debugging Guide

This guide helps you troubleshoot common issues with the unified logging system.

## 🚨 Common Issues and Solutions

### 1. Backend Server Won't Start

#### Symptoms
- `./start-dev.sh` fails with Python errors
- Port 8000 already in use
- Module import errors

#### Solutions

**Check Python Version:**
```bash
python3 --version
# Should be 3.8 or higher
```

**Check if Port is in Use:**
```bash
lsof -i :8000
# Kill the process if needed
kill -9 <PID>
```

**Reinstall Dependencies:**
```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Check Virtual Environment:**
```bash
cd backend
source venv/bin/activate
which python
# Should point to backend/venv/bin/python
```

### 2. Frontend Development Server Issues

#### Symptoms
- `npm run dev` fails
- Port 5173 already in use
- TypeScript compilation errors

#### Solutions

**Check Node.js Version:**
```bash
node --version
npm --version
# Node should be 16+ and npm should be 8+
```

**Clear Node Modules:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Check Port Availability:**
```bash
lsof -i :5173
# Kill the process if needed
kill -9 <PID>
```

**Fix TypeScript Errors:**
```bash
cd frontend
npm run build
# Check for compilation errors
```

### 3. Logs Not Appearing in Unified File

#### Symptoms
- `tail -f logs/unified.log` shows no output
- Frontend logs not reaching backend
- Backend logs not being written

#### Diagnostic Steps

**Check Log File Exists:**
```bash
ls -la logs/unified.log
ls -la backend/logs/unified.log
```

**Check File Permissions:**
```bash
ls -la logs/
# Should be writable by current user
```

**Test Backend API Directly:**
```bash
curl -X POST http://localhost:8000/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [{
      "timestamp": "2025-01-14T10:30:00.000Z",
      "level": "info",
      "message": "Test log entry",
      "source": "test"
    }]
  }'
```

**Check Backend Health:**
```bash
curl http://localhost:8000/health
```

#### Solutions

**Create Log Directories:**
```bash
mkdir -p logs
mkdir -p backend/logs
touch logs/unified.log
```

**Check Backend Configuration:**
```bash
cat backend/config/logging.json
# Verify logFilePath is correct
```

**Restart Services:**
```bash
# Kill existing processes
pkill -f "python run_server.py"
pkill -f "npm run dev"

# Restart
./start-dev.sh
```

### 4. Frontend Logs Not Reaching Backend

#### Symptoms
- Frontend console shows logs
- Backend receives no log requests
- Network errors in browser console

#### Diagnostic Steps

**Check Network Requests:**
1. Open browser developer tools
2. Go to Network tab
3. Look for POST requests to `/api/logs`
4. Check for CORS errors or 404s

**Test API Endpoint:**
```bash
curl -X GET http://localhost:8000/docs
# Should show Swagger UI
```

**Check Frontend Configuration:**
```bash
cat frontend/config/logging.json
# Verify apiEndpoint is correct
```

#### Solutions

**Fix CORS Issues:**
```python
# In backend/src/api.py, ensure CORS is configured
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Update Frontend Config:**
```json
{
  "apiEndpoint": "http://localhost:8000/api/logs",
  "retryAttempts": 3,
  "retryDelay": 1000
}
```

**Check Browser Console:**
```javascript
// In browser console, test the logger
import('./src/logger.js').then(module => {
  const logger = new module.LoggerService();
  logger.info('Test log from console');
});
```

### 5. Log File Rotation Issues

#### Symptoms
- Log file grows too large
- Old log files not being rotated
- Disk space warnings

#### Solutions

**Check Current Log Size:**
```bash
ls -lh logs/unified.log
du -h logs/
```

**Manual Log Rotation:**
```bash
# Backup current log
cp logs/unified.log logs/unified.log.backup

# Truncate current log
> logs/unified.log

# Or rotate with timestamp
mv logs/unified.log logs/unified.log.$(date +%Y%m%d_%H%M%S)
touch logs/unified.log
```

**Configure Automatic Rotation:**
```json
// In backend/config/logging.json
{
  "maxFileSizeMB": 10,
  "rotationCount": 5,
  "flushImmediately": true
}
```

### 6. Performance Issues

#### Symptoms
- Frontend becomes slow
- High CPU usage
- Memory leaks

#### Diagnostic Steps

**Check Log Queue Size:**
```typescript
// Add to frontend logger
console.log('Queue size:', logQueue.size());
console.log('Queue stats:', logQueue.getStats());
```

**Monitor Memory Usage:**
```bash
# Check process memory
ps aux | grep -E "(python|node)"

# Monitor in real-time
top -p $(pgrep -f "python run_server.py")
```

#### Solutions

**Optimize Frontend Configuration:**
```json
{
  "batchSize": 20,
  "flushInterval": 5000,
  "maxQueueSize": 100,
  "logLevel": "info"
}
```

**Reduce Log Verbosity:**
```typescript
// Only log important events in production
if (process.env.NODE_ENV === 'development') {
  logger.debug('Detailed debug info');
} else {
  logger.info('Important info only');
}
```

**Backend Optimization:**
```python
# Use async logging
import asyncio
import aiofiles

async def write_log_async(entry):
    async with aiofiles.open('logs/unified.log', 'a') as f:
        await f.write(f"{entry}\n")
```

### 7. Safari Extension Specific Issues

#### Symptoms
- Extension not loading
- Content script errors
- Background script failures

#### Solutions

**Check Extension Manifest:**
```json
// Ensure permissions are correct
{
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "http://localhost:8000/*"
  ]
}
```

**Debug Extension Loading:**
```typescript
// In background.ts
console.log('Background script loaded');
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
```

**Check Safari Developer Tools:**
1. Open Safari
2. Develop menu → Web Extension Background Pages
3. Select your extension
4. Check console for errors

### 8. Testing and Validation Issues

#### Symptoms
- Tests failing
- Integration tests timeout
- Mock services not working

#### Solutions

**Run Tests with Verbose Output:**
```bash
# Backend tests
cd backend
pytest -v -s

# Frontend tests
cd frontend
npm test -- --verbose
```

**Check Test Configuration:**
```bash
# Verify test environment
cd backend
python -m pytest --collect-only
```

**Debug Integration Tests:**
```python
# Add debugging to tests
import logging
logging.basicConfig(level=logging.DEBUG)

def test_log_integration():
    logger.debug("Starting integration test")
    # ... test code
```

## 🔧 Debugging Tools and Commands

### Log Analysis Commands

```bash
# Find errors in the last hour
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" logs/unified.log | grep ERROR

# Count log entries by source
grep -o -E "(FRONTEND|BACKEND)" logs/unified.log | sort | uniq -c

# Find slow operations (if timing is logged)
grep "process_time" logs/unified.log | sort -k5 -nr | head -10

# Monitor log file in real-time with filtering
tail -f logs/unified.log | grep --line-buffered -E "(ERROR|WARN)"
```

### System Monitoring

```bash
# Check disk space
df -h

# Monitor file descriptors
lsof | grep unified.log

# Check network connections
netstat -an | grep :8000

# Monitor process resources
htop -p $(pgrep -f "python run_server.py")
```

### Development Debugging

```bash
# Enable debug mode for backend
export FASTAPI_DEBUG=1
cd backend && python run_server.py

# Enable verbose npm logging
cd frontend && npm run dev --verbose

# Check environment variables
env | grep -E "(NODE_ENV|PYTHON|PATH)"
```

## 📞 Getting Help

### Before Asking for Help

1. **Check this debugging guide** for your specific issue
2. **Review the logs** for error messages
3. **Test with minimal configuration** to isolate the problem
4. **Verify prerequisites** (Python, Node.js versions)

### Information to Include

When reporting issues, include:

- **Operating System and version**
- **Python and Node.js versions**
- **Complete error messages**
- **Steps to reproduce**
- **Configuration files** (sanitized)
- **Log file excerpts** (relevant portions)

### Useful Debug Commands

```bash
# System information
uname -a
python3 --version
node --version
npm --version

# Process information
ps aux | grep -E "(python|node)"
lsof -i :8000
lsof -i :5173

# Log file status
ls -la logs/
tail -20 logs/unified.log

# Configuration check
cat backend/config/logging.json
cat frontend/config/logging.json
```

This debugging guide should help you resolve most common issues with the unified logging system. If you encounter issues not covered here, use the debugging tools and commands provided to gather more information.