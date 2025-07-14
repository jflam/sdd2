// Background script for Safari extension
import { initializeLogger, getLogger } from './logger';
import { initializeExceptionHandler, getExceptionHandler, safeExecute } from './exception-handler';

// Initialize the logger and exception handler
const logger = initializeLogger({
    logLevel: 'debug',
    apiEndpoint: 'http://localhost:8000'
});

const exceptionHandler = initializeExceptionHandler();

// Log extension startup
logger.info('Safari extension background script loaded');

// Example of logging with context
logger.debug('Background script initialized', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent
});

// Example of safe execution with exception handling
safeExecute(
    async () => {
        // Simulate some background work
        logger.info('Starting background tasks');
        
        // Example of component-specific logging
        logger.logWithComponent('info', 'background-worker', 'Background worker started');
        
        // Simulate an async operation that might fail
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logger.debug('Background tasks completed successfully');
    },
    { component: 'background-script', action: 'initialize' }
);

// Example of wrapping a function with exception handling
const wrappedFunction = exceptionHandler.wrapFunction(
    (data: any) => {
        logger.debug('Processing data in background', { dataType: typeof data });
        // Simulate processing
        return { processed: true, timestamp: Date.now() };
    },
    { component: 'background-script', functionName: 'processData' }
);

// Export logger and exception handler for use by other parts of the extension
export { getLogger, getExceptionHandler };