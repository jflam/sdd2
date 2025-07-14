// Background script for Safari extension
import { initializeLogger, getLogger } from './logger';

// Initialize the logger
const logger = initializeLogger({
    logLevel: 'debug',
    apiEndpoint: 'http://localhost:8000'
});

// Log extension startup
logger.info('Safari extension background script loaded');

// Example of logging with context
logger.debug('Background script initialized', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent
});

// Example error handling
try {
    // Simulate some background work
    logger.info('Starting background tasks');
    
    // Example of component-specific logging
    logger.logWithComponent('info', 'background-worker', 'Background worker started');
    
} catch (error) {
    logger.logException(error as Error, 'Failed to start background tasks', {
        component: 'background-script'
    });
}

// Export logger for use by other parts of the extension
export { getLogger };