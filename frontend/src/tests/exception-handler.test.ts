import { SafariExceptionHandler, initializeExceptionHandler, getExceptionHandler, safeExecute } from '../exception-handler';
import { getLogger } from '../logger';

// Mock the logger
jest.mock('../logger');
const mockLogger = {
    logException: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

(getLogger as jest.Mock).mockReturnValue(mockLogger);

// Mock global objects
const mockAddEventListener = jest.fn();
const mockFetch = jest.fn();

Object.defineProperty(window, 'addEventListener', {
    value: mockAddEventListener,
    writable: true
});

Object.defineProperty(window, 'fetch', {
    value: mockFetch,
    writable: true
});

describe('SafariExceptionHandler', () => {
    let exceptionHandler: SafariExceptionHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAddEventListener.mockClear();
        exceptionHandler = new SafariExceptionHandler();
    });

    describe('Constructor and Setup', () => {
        test('should set up global handlers on construction', () => {
            expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
            expect(mockLogger.debug).toHaveBeenCalledWith('Global exception handlers set up');
        });
    });

    describe('Manual Exception Capture', () => {
        test('should capture exceptions manually', () => {
            const error = new Error('Test error');
            const context = { component: 'test', action: 'testing' };

            exceptionHandler.captureException(error, context);

            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                undefined,
                expect.objectContaining({
                    ...context,
                    capturedManually: true,
                    timestamp: expect.any(Number)
                })
            );
        });

        test('should capture exceptions with context', () => {
            const error = new Error('Context error');
            const component = 'popup';
            const action = 'button-click';
            const additionalContext = { userId: '123' };

            exceptionHandler.captureExceptionWithContext(error, component, action, additionalContext);

            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                `Error in ${component} during ${action}`,
                expect.objectContaining({
                    component,
                    action,
                    ...additionalContext,
                    capturedWithContext: true
                })
            );
        });
    });

    describe('Global Error Handling', () => {
        test('should handle window error events', () => {
            const errorEvent = {
                error: new Error('Window error'),
                message: 'Window error',
                filename: 'test.js',
                lineno: 10,
                colno: 5
            };

            // Get the error handler that was registered
            const errorHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'error'
            )[1];

            errorHandler(errorEvent);

            expect(mockLogger.logException).toHaveBeenCalledWith(
                errorEvent.error,
                'Unhandled JavaScript error',
                expect.objectContaining({
                    filename: 'test.js',
                    lineno: 10,
                    colno: 5,
                    type: 'javascript-error',
                    url: expect.any(String)
                })
            );
        });

        test('should handle unhandled promise rejections', () => {
            const rejectionEvent = {
                reason: new Error('Promise rejection'),
                preventDefault: jest.fn()
            };

            // Get the unhandledrejection handler that was registered
            const rejectionHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'unhandledrejection'
            )[1];

            rejectionHandler(rejectionEvent);

            expect(mockLogger.logException).toHaveBeenCalledWith(
                rejectionEvent.reason,
                'Unhandled promise rejection',
                expect.objectContaining({
                    type: 'promise-rejection',
                    reason: rejectionEvent.reason,
                    url: expect.any(String)
                })
            );

            expect(rejectionEvent.preventDefault).toHaveBeenCalled();
        });

        test('should handle non-Error promise rejections', () => {
            const rejectionEvent = {
                reason: 'String rejection',
                preventDefault: jest.fn()
            };

            const rejectionHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'unhandledrejection'
            )[1];

            rejectionHandler(rejectionEvent);

            expect(mockLogger.logException).toHaveBeenCalledWith(
                expect.any(Error),
                'Unhandled promise rejection',
                expect.objectContaining({
                    type: 'promise-rejection',
                    reason: 'String rejection'
                })
            );
        });
    });

    describe('Async Exception Handling', () => {
        test('should capture exceptions from async operations', async () => {
            const error = new Error('Async error');
            const asyncOperation = jest.fn().mockRejectedValue(error);
            const context = { component: 'test', action: 'async-test' };

            const result = await exceptionHandler.captureAsyncException(asyncOperation, context);

            expect(result).toBeNull();
            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                `Error in ${context.component} during ${context.action}`,
                expect.objectContaining(context)
            );
        });

        test('should return result from successful async operations', async () => {
            const expectedResult = { success: true };
            const asyncOperation = jest.fn().mockResolvedValue(expectedResult);
            const context = { component: 'test', action: 'async-success' };

            const result = await exceptionHandler.captureAsyncException(asyncOperation, context);

            expect(result).toBe(expectedResult);
            expect(mockLogger.logException).not.toHaveBeenCalled();
        });
    });

    describe('Function Wrapping', () => {
        test('should wrap synchronous functions with exception handling', () => {
            const error = new Error('Sync function error');
            const originalFunction = jest.fn().mockImplementation(() => {
                throw error;
            });

            const wrappedFunction = exceptionHandler.wrapFunction(
                originalFunction,
                { component: 'test', functionName: 'testFunction' }
            );

            expect(() => wrappedFunction('arg1', 'arg2')).toThrow(error);
            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                'Error in test during testFunction',
                expect.objectContaining({
                    component: 'test',
                    functionName: 'testFunction',
                    arguments: ['arg1', 'arg2']
                })
            );
        });

        test('should wrap asynchronous functions with exception handling', async () => {
            const error = new Error('Async function error');
            const originalFunction = jest.fn().mockRejectedValue(error);

            const wrappedFunction = exceptionHandler.wrapFunction(
                originalFunction,
                { component: 'test', functionName: 'asyncTestFunction' }
            );

            await expect(wrappedFunction('arg1')).rejects.toThrow(error);
            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                'Error in test during asyncTestFunction',
                expect.objectContaining({
                    component: 'test',
                    functionName: 'asyncTestFunction',
                    arguments: ['arg1']
                })
            );
        });

        test('should not interfere with successful function execution', () => {
            const expectedResult = 'success';
            const originalFunction = jest.fn().mockReturnValue(expectedResult);

            const wrappedFunction = exceptionHandler.wrapFunction(
                originalFunction,
                { component: 'test', functionName: 'successFunction' }
            );

            const result = wrappedFunction('arg1');

            expect(result).toBe(expectedResult);
            expect(originalFunction).toHaveBeenCalledWith('arg1');
            expect(mockLogger.logException).not.toHaveBeenCalled();
        });
    });

    describe('Global Functions', () => {
        test('should initialize and retrieve global exception handler', () => {
            const handler1 = initializeExceptionHandler();
            const handler2 = getExceptionHandler();

            expect(handler1).toBe(handler2);
            expect(handler1).toBeInstanceOf(SafariExceptionHandler);
        });
    });

    describe('Safe Execute Utility', () => {
        test('should execute operation successfully', async () => {
            const expectedResult = 'success';
            const operation = jest.fn().mockReturnValue(expectedResult);
            const context = { component: 'test', action: 'safe-execute' };

            const result = await safeExecute(operation, context);

            expect(result).toBe(expectedResult);
            expect(operation).toHaveBeenCalled();
        });

        test('should handle exceptions and return fallback value', async () => {
            const error = new Error('Safe execute error');
            const operation = jest.fn().mockImplementation(() => {
                throw error;
            });
            const context = { component: 'test', action: 'safe-execute-error' };
            const fallbackValue = 'fallback';

            const result = await safeExecute(operation, context, fallbackValue);

            expect(result).toBe(fallbackValue);
            expect(mockLogger.logException).toHaveBeenCalledWith(
                error,
                `Error in ${context.component} during ${context.action}`,
                expect.any(Object)
            );
        });

        test('should handle async operations', async () => {
            const expectedResult = 'async success';
            const operation = jest.fn().mockResolvedValue(expectedResult);
            const context = { component: 'test', action: 'async-safe-execute' };

            const result = await safeExecute(operation, context);

            expect(result).toBe(expectedResult);
        });

        test('should return undefined when no fallback provided and error occurs', async () => {
            const error = new Error('No fallback error');
            const operation = jest.fn().mockImplementation(() => {
                throw error;
            });
            const context = { component: 'test', action: 'no-fallback' };

            const result = await safeExecute(operation, context);

            expect(result).toBeUndefined();
        });
    });

    describe('Fetch Interception', () => {
        test('should intercept and log failed HTTP requests', async () => {
            const originalFetch = window.fetch;
            
            // Create a new handler to test fetch interception
            new SafariExceptionHandler();

            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found'
            };

            window.fetch = jest.fn().mockResolvedValue(mockResponse);

            await window.fetch('http://test.com/api');

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'HTTP request failed',
                expect.objectContaining({
                    url: 'http://test.com/api',
                    status: 404,
                    statusText: 'Not Found',
                    type: 'http-error'
                })
            );

            // Restore original fetch
            window.fetch = originalFetch;
        });
    });
});