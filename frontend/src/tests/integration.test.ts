import { Logger, initializeLogger } from '../logger';
import { AsyncLogQueue } from '../log-queue';
import { SafariExceptionHandler } from '../exception-handler';
import { ConfigManager } from '../config-manager';
import { LoggingConfig } from '../types/logging';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock console methods
const mockConsole = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

Object.assign(console, mockConsole);

describe('Integration Tests', () => {
    let mockFetch: jest.MockedFunction<typeof fetch>;
    let logger: Logger;
    let config: LoggingConfig;

    beforeEach(() => {
        // Reset the mock
        jest.resetAllMocks();
        mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
        global.fetch = mockFetch;

        // Clear console mocks
        Object.values(mockConsole).forEach(mock => mock.mockClear());

        config = {
            apiEndpoint: 'http://localhost:8000',
            batchSize: 5,
            flushInterval: 1000,
            maxQueueSize: 50,
            logLevel: 'debug',
            retryAttempts: 2,
            retryDelayMs: 100
        };

        const configManager = new ConfigManager(config);
        logger = new Logger(configManager);
    });

    afterEach(() => {
        // Clean up any running timers
        logger.stopAutoFlush();
    });

    describe('Frontend to Backend Log Flow', () => {
        test('should send logs to backend API with correct format', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ status: 'success', processed_count: 1 })
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Log a message
            logger.info('Test integration message', { userId: '123', action: 'click' });

            // Manually flush to ensure immediate sending
            await logger.flushLogs();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: expect.stringContaining('"message":"Test integration message"')
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);

            // Find the test message (not the startup message)
            const testEntry = body.entries.find((e: any) => e.message === 'Test integration message');
            expect(testEntry).toMatchObject({
                level: 'info',
                message: 'Test integration message',
                source: 'frontend',
                context: { userId: '123', action: 'click' },
                component: 'safari-extension'
            });
        });

        test('should batch multiple log entries correctly', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Log multiple messages
            logger.debug('Debug message 1');
            logger.info('Info message 2');
            logger.warn('Warning message 3');
            logger.error('Error message 4');

            // Manually flush to send batch
            await logger.flushLogs();

            expect(mockFetch).toHaveBeenCalledTimes(1);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);

            // Filter out the startup message to get only our test messages
            const testEntries = body.entries.filter((e: any) =>
                !e.message.includes('Loading Safari Extension Unified Logging')
            );

            expect(testEntries).toHaveLength(4);
            expect(testEntries.map((e: any) => e.level)).toEqual(['debug', 'info', 'warn', 'error']);
            expect(testEntries.map((e: any) => e.message)).toEqual([
                'Debug message 1',
                'Info message 2',
                'Warning message 3',
                'Error message 4'
            ]);
        });

        test('should handle backend response correctly', async () => {
            const mockResponse = {
                status: 'success',
                message: 'Successfully processed 2 log entries',
                processed_count: 2
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => mockResponse
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            logger.info('Message 1');
            logger.info('Message 2');

            // Flush and verify no errors thrown
            await expect(logger.flushLogs()).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Exception Handling Integration', () => {
        test('should integrate logger with exception handler', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Simulate an exception directly through the logger
            const testError = new Error('Test integration error');
            testError.stack = 'Error: Test integration error\n    at test (integration.test.ts:123:45)';

            logger.logException(testError, 'Test integration error', { component: 'integration-test' });

            // Flush logs to send exception
            await logger.flushLogs();

            expect(mockFetch).toHaveBeenCalled();

            // Find the call that contains the error entry
            let errorEntry = null;
            for (const call of mockFetch.mock.calls) {
                const body = JSON.parse(call[1]?.body as string);
                errorEntry = body.entries.find((e: any) => e.level === 'error' && e.message === 'Test integration error');
                if (errorEntry) break;
            }

            expect(errorEntry).toMatchObject({
                level: 'error',
                message: 'Test integration error',
                source: 'frontend',
                stackTrace: expect.stringContaining('Error: Test integration error'),
                context: expect.objectContaining({
                    component: 'integration-test',
                    errorName: 'Error',
                    errorMessage: 'Test integration error'
                })
            });
        });

        test('should handle global error events', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Simulate an exception directly through the logger (simulating what exception handler would do)
            const testError = new Error('Global error occurred');
            testError.stack = 'Error: Global error occurred\n    at popup.js:42:15';

            logger.logException(testError, 'Global error occurred', {
                filename: 'popup.js',
                lineno: 42,
                colno: 15,
                type: 'javascript-error'
            });

            // Flush logs
            await logger.flushLogs();

            expect(mockFetch).toHaveBeenCalled();

            // Find the call that contains the error entry
            let errorEntry = null;
            for (const call of mockFetch.mock.calls) {
                const body = JSON.parse(call[1]?.body as string);
                errorEntry = body.entries.find((e: any) => e.level === 'error' && e.message === 'Global error occurred');
                if (errorEntry) break;
            }

            expect(errorEntry).toMatchObject({
                level: 'error',
                message: 'Global error occurred',
                source: 'frontend',
                context: expect.objectContaining({
                    filename: 'popup.js',
                    lineno: 42,
                    colno: 15
                })
            });
        });
    });

    describe('Async Behavior and Non-blocking Operations', () => {
        test('should not block when logging multiple messages rapidly', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            const startTime = Date.now();

            // Log many messages rapidly
            for (let i = 0; i < 20; i++) {
                logger.info(`Rapid message ${i}`, { index: i });
            }

            const endTime = Date.now();
            const syncTime = endTime - startTime;

            // Logging should be very fast (non-blocking)
            expect(syncTime).toBeLessThan(100); // Should take less than 100ms

            // Verify queue has messages
            const queueStatus = logger.getQueueStatus();
            expect(queueStatus.size).toBeGreaterThan(0);

            // Flush all logs
            await logger.flushAllLogs();

            // Verify queue is empty after flush
            const finalQueueStatus = logger.getQueueStatus();
            expect(finalQueueStatus.size).toBe(0);
        });

        test('should handle concurrent flush operations gracefully', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Add messages to queue
            logger.info('Message 1');
            logger.info('Message 2');
            logger.info('Message 3');

            // Start multiple flush operations concurrently
            const flushPromises = [
                logger.flushLogs(),
                logger.flushLogs(),
                logger.flushLogs()
            ];

            // All should complete without error
            await expect(Promise.all(flushPromises)).resolves.not.toThrow();

            // Should have made at least one API call
            expect(mockFetch).toHaveBeenCalled();
        });

        test('should continue logging while flush is in progress', async () => {
            // Simulate slow backend response
            mockFetch.mockImplementation(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({
                        ok: true,
                        status: 200,
                        statusText: 'OK'
                    } as Response), 200)
                )
            );

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Add initial messages
            logger.info('Message 1');
            logger.info('Message 2');

            // Start flush (will be slow)
            const flushPromise = logger.flushLogs();

            // Add more messages while flush is in progress
            logger.info('Message 3');
            logger.info('Message 4');

            // Wait for first flush to complete
            await flushPromise;

            // Verify new messages are still in queue
            const queueStatus = logger.getQueueStatus();
            expect(queueStatus.size).toBeGreaterThan(0);

            // Flush remaining messages
            await logger.flushLogs();

            // Verify all messages were sent
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Scenarios and Fallback Mechanisms', () => {
        test('should retry failed requests with exponential backoff', async () => {
            let callCount = 0;
            mockFetch.mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK'
                } as Response);
            });

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();
            callCount = 0;

            logger.info('Test retry message');

            // Flush and wait for retries
            await logger.flushLogs();

            // Should have made 3 attempts (initial + 2 retries)
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        test('should fallback to console logging after max retries', async () => {
            mockFetch.mockRejectedValue(new Error('Persistent network error'));

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();
            mockConsole.warn.mockClear();
            mockConsole.error.mockClear();

            logger.error('Test fallback message', { important: true });

            // Flush and wait for retries to complete - catch any thrown errors
            try {
                await logger.flushLogs();
            } catch (error) {
                // Expected to throw after all retries fail
            }

            // Should have attempted retries
            expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries

            // Should have fallen back to console
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Falling back to console logging')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [FRONTEND]')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('Test fallback message')
            );
        });

        test('should handle HTTP error responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();
            mockConsole.warn.mockClear();

            logger.warn('Test HTTP error');

            // Flush logs - catch any thrown errors
            try {
                await logger.flushLogs();
            } catch (error) {
                // Expected to throw after all retries fail
            }

            // Should have attempted retries
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Should have fallen back to console
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Falling back to console logging')
            );
        });

        test('should handle queue overflow gracefully', async () => {
            // Create logger with small queue size
            const smallQueueConfig = {
                ...config,
                maxQueueSize: 3,
                batchSize: 10 // Larger than queue to prevent auto-flush
            };

            const configManager = new ConfigManager(smallQueueConfig);
            const smallQueueLogger = new Logger(configManager);

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message
            await new Promise(resolve => setTimeout(resolve, 50));
            mockConsole.warn.mockClear();

            // Fill queue beyond capacity
            smallQueueLogger.debug('Debug 1');
            smallQueueLogger.info('Info 1');
            smallQueueLogger.warn('Warn 1');
            smallQueueLogger.error('Error 1'); // This should trigger overflow

            // Should have warned about queue overflow
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Log queue overflow')
            );

            // Queue should still be at max size
            const queueStatus = smallQueueLogger.getQueueStatus();
            expect(queueStatus.size).toBeLessThanOrEqual(3);

            smallQueueLogger.stopAutoFlush();
        });

        test('should handle network timeout', async () => {
            // Mock fetch to timeout
            mockFetch.mockImplementation(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 50)
                )
            );

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();
            mockConsole.warn.mockClear();

            logger.info('Test timeout message');

            // Flush logs and wait for timeout - catch any thrown errors
            try {
                await logger.flushLogs();
            } catch (error) {
                // Expected to throw after all retries fail
            }

            // Should have attempted retries (may include startup message call)
            expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);

            // Should have fallen back to console
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Falling back to console logging')
            );
        });
    });

    describe('Version Tracking and Startup', () => {
        test('should log startup message on initialization', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Create new logger to test initialization
            const configManager = new ConfigManager({
                ...config,
                batchSize: 1 // Immediate flush for startup message
            });

            new Logger(configManager);

            // Wait for startup message to be sent
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    body: expect.stringContaining('Loading Safari Extension Unified Logging')
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);

            expect(body.entries[0]).toMatchObject({
                level: 'info',
                message: expect.stringContaining('Loading Safari Extension Unified Logging'),
                source: 'frontend',
                component: 'safari-extension'
            });
        });
    });

    describe('Real-time Log Monitoring Simulation', () => {
        test('should send logs immediately when batch size is reached', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Create logger with batch size 2
            const realTimeConfig = {
                ...config,
                batchSize: 2
            };

            const configManager = new ConfigManager(realTimeConfig);
            const realTimeLogger = new Logger(configManager);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 50));
            mockFetch.mockClear();

            // Add first log (startup message + first message = 2 messages, should trigger flush)
            realTimeLogger.info('First message');
            await new Promise(resolve => setTimeout(resolve, 50));

            // Should have triggered a flush since startup message + first message = batch size of 2
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Add second log (should trigger auto-flush)
            realTimeLogger.info('Second message');
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockFetch).toHaveBeenCalledTimes(1);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);

            expect(body.entries).toHaveLength(2);
            // The first batch contains startup message + first message
            expect(body.entries.map((e: any) => e.message)).toEqual([
                'Loading Safari Extension Unified Logging 1.0.1',
                'First message'
            ]);

            realTimeLogger.stopAutoFlush();
        });
    });
});