import { ExceptionHandler } from './types/logging';
import { getLogger } from './logger';

export class SafariExceptionHandler implements ExceptionHandler {
    private logger = getLogger();
    private isSetup = false;

    constructor() {
        this.setupGlobalHandlers();
    }

    captureException(error: Error, context?: object): void {
        this.logger.logException(error, undefined, {
            ...context,
            capturedManually: true,
            timestamp: Date.now()
        });
    }

    setupGlobalHandlers(): void {
        if (this.isSetup) return;

        // Handle unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            const error = event.error || new Error(event.message);
            
            this.logger.logException(error, 'Unhandled JavaScript error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                type: 'javascript-error',
                url: window.location.href
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error 
                ? event.reason 
                : new Error(String(event.reason));

            this.logger.logException(error, 'Unhandled promise rejection', {
                type: 'promise-rejection',
                reason: event.reason,
                url: window.location.href
            });

            // Prevent the default browser behavior (logging to console)
            event.preventDefault();
        });

        // Handle Safari extension specific errors
        if (typeof safari !== 'undefined' && safari.extension) {
            // Safari extension message handling errors
            safari.application.addEventListener('message', (event) => {
                try {
                    // This is just a placeholder for message handling
                    // In a real extension, you'd handle messages here
                } catch (error) {
                    this.captureException(error as Error, {
                        type: 'safari-message-error',
                        messageName: event.name,
                        messageData: event.message
                    });
                }
            });
        }

        // Handle fetch errors globally
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Log failed HTTP requests
                if (!response.ok) {
                    this.logger.warn('HTTP request failed', {
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText,
                        type: 'http-error'
                    });
                }
                
                return response;
            } catch (error) {
                this.captureException(error as Error, {
                    type: 'fetch-error',
                    url: args[0],
                    requestOptions: args[1]
                });
                throw error;
            }
        };

        // Handle console errors (for debugging)
        const originalConsoleError = console.error;
        console.error = (...args) => {
            // Call original console.error
            originalConsoleError.apply(console, args);
            
            // Log to unified system if it's an Error object
            const firstArg = args[0];
            if (firstArg instanceof Error) {
                this.captureException(firstArg, {
                    type: 'console-error',
                    arguments: args.slice(1)
                });
            } else if (typeof firstArg === 'string') {
                this.logger.error(firstArg, {
                    type: 'console-error',
                    arguments: args.slice(1)
                });
            }
        };

        this.isSetup = true;
        this.logger.debug('Global exception handlers set up');
    }

    // Method to manually capture and log exceptions with additional context
    captureExceptionWithContext(
        error: Error, 
        component: string, 
        action: string, 
        additionalContext?: object
    ): void {
        this.logger.logException(error, `Error in ${component} during ${action}`, {
            component,
            action,
            ...additionalContext,
            capturedWithContext: true
        });
    }

    // Method to capture exceptions from async operations
    async captureAsyncException<T>(
        asyncOperation: () => Promise<T>,
        context: { component: string; action: string; [key: string]: any }
    ): Promise<T | null> {
        try {
            return await asyncOperation();
        } catch (error) {
            this.captureExceptionWithContext(
                error as Error,
                context.component,
                context.action,
                context
            );
            return null;
        }
    }

    // Method to wrap functions with exception handling
    wrapFunction<T extends (...args: any[]) => any>(
        fn: T,
        context: { component: string; functionName: string }
    ): T {
        return ((...args: any[]) => {
            try {
                const result = fn(...args);
                
                // Handle async functions
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        this.captureExceptionWithContext(
                            error,
                            context.component,
                            context.functionName,
                            { arguments: args }
                        );
                        throw error;
                    });
                }
                
                return result;
            } catch (error) {
                this.captureExceptionWithContext(
                    error as Error,
                    context.component,
                    context.functionName,
                    { arguments: args }
                );
                throw error;
            }
        }) as T;
    }
}

// Global exception handler instance
let globalExceptionHandler: SafariExceptionHandler | null = null;

export function initializeExceptionHandler(): SafariExceptionHandler {
    if (!globalExceptionHandler) {
        globalExceptionHandler = new SafariExceptionHandler();
    }
    return globalExceptionHandler;
}

export function getExceptionHandler(): SafariExceptionHandler {
    if (!globalExceptionHandler) {
        globalExceptionHandler = initializeExceptionHandler();
    }
    return globalExceptionHandler;
}

// Utility function to safely execute code with exception handling
export async function safeExecute<T>(
    operation: () => T | Promise<T>,
    context: { component: string; action: string },
    fallbackValue?: T
): Promise<T | undefined> {
    const handler = getExceptionHandler();
    
    try {
        const result = await operation();
        return result;
    } catch (error) {
        handler.captureExceptionWithContext(
            error as Error,
            context.component,
            context.action
        );
        return fallbackValue;
    }
}