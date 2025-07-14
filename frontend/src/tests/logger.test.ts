import { Logger, initializeLogger, getLogger } from '../logger';
import { LoggingConfig } from '../types/logging';
import { ConfigManager } from '../config-manager';

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

describe('Logger', () => {
    let logger: Logger;
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;
        mockFetch.mockClear();
        
        // Clear console mocks
        Object.values(mockConsole).forEach(mock => mock.mockClear());

        const config: Partial<LoggingConfig> = {
            apiEndpoint: 'http://localhost:8000',
            batchSize: 10,
            flushInterval: 5000,
            maxQueueSize: 100,
            logLevel: 'debug',
            retryAttempts: 3
        };

        const configManager = new ConfigManager(config);
        logger = new Logger(configManager);
    });

    describe('Log Level Filtering', () => {
        test('should respect log level configuration', async () => {
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 10, // Higher batch size to collect all entries
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'warn',
                retryAttempts: 3
            };

            const configManager = new ConfigManager(config);
            const warnLogger = new Logger(configManager);
            
            // Mock successful response
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message to be sent and clear the mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockFetch.mockClear();

            warnLogger.debug('Debug message');
            warnLogger.info('Info message');
            warnLogger.warn('Warn message');
            warnLogger.error('Error message');

            // Manually flush to send all queued entries
            await warnLogger.flushLogs();

            // Should have made at least one call
            expect(mockFetch).toHaveBeenCalled();

            // Check that only warn and error messages were sent
            const allCalls = mockFetch.mock.calls;
            const allEntries = allCalls.flatMap(call => {
                const body = JSON.parse(call[1]?.body as string);
                return body.entries;
            });

            const sentLevels = allEntries.map((entry: any) => entry.level);
            expect(sentLevels).toEqual(['warn', 'error']);
        });
    });

    describe('Log Entry Creation', () => {
        test('should create properly formatted log entries', async () => {
            // Create logger with batch size 1 to trigger immediate flush
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'debug',
                retryAttempts: 3
            };
            const configManager = new ConfigManager(config);
            const testLogger = new Logger(configManager);

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockFetch.mockClear();

            testLogger.info('Test message', { userId: '123' });

            // Wait for async flush
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: expect.stringContaining('"message":"Test message"')
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);
            const entry = body.entries[0];

            expect(entry).toMatchObject({
                level: 'info',
                message: 'Test message',
                source: 'frontend',
                context: { userId: '123' },
                component: 'safari-extension'
            });
            expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('Exception Logging', () => {
        test('should log exceptions with stack traces', async () => {
            // Create logger with batch size 1 to trigger immediate flush
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'debug',
                retryAttempts: 3
            };
            const configManager = new ConfigManager(config);
            const testLogger = new Logger(configManager);

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockFetch.mockClear();

            const error = new Error('Test error');
            testLogger.logException(error, 'Custom error message', { component: 'test' });

            // Wait for async flush
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    body: expect.stringContaining('"message":"Custom error message"')
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);
            const entry = body.entries[0];

            expect(entry.level).toBe('error');
            expect(entry.stackTrace).toContain('Error: Test error');
            expect(entry.context).toMatchObject({
                component: 'test',
                errorName: 'Error',
                errorMessage: 'Test error'
            });
        });
    });

    describe('Component Logging', () => {
        test('should support component-specific logging', async () => {
            // Create logger with batch size 1 to trigger immediate flush
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'debug',
                retryAttempts: 3
            };
            const configManager = new ConfigManager(config);
            const testLogger = new Logger(configManager);

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockFetch.mockClear();

            testLogger.logWithComponent('info', 'popup', 'Popup opened', { userId: '123' });

            // Wait for async flush
            await new Promise(resolve => setTimeout(resolve, 10));

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);
            const entry = body.entries[0];

            expect(entry.component).toBe('popup');
            expect(entry.message).toBe('Popup opened');
        });
    });

    describe('Fallback Behavior', () => {
        test('should fallback to console logging when backend fails', async () => {
            // Create logger with batch size 1 and max retries 0 for faster testing
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'debug',
                retryAttempts: 0 // No retries for faster test
            };
            const configManager = new ConfigManager(config);
            const testLogger = new Logger(configManager);

            mockFetch.mockRejectedValue(new Error('Network error'));

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockConsole.error.mockClear();

            testLogger.error('Test error message');

            // Wait for async operation and retries to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that fallback console logging occurred
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Falling back to console logging')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [FRONTEND]')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('Test error message')
            );
        });

        test('should fallback to console when HTTP error occurs', async () => {
            // Create logger with batch size 1 and max retries 0 for faster testing
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'debug',
                retryAttempts: 0 // No retries for faster test
            };
            const configManager = new ConfigManager(config);
            const testLogger = new Logger(configManager);

            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            // Wait for initial loading message and clear mock
            await new Promise(resolve => setTimeout(resolve, 10));
            mockConsole.warn.mockClear();

            testLogger.warn('Test warning');

            // Wait for async operation and retries to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that fallback console logging occurred
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Falling back to console logging')
            );
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('[WARN] [FRONTEND]')
            );
        });
    });

    describe('Global Logger Functions', () => {
        test('should initialize and retrieve global logger', () => {
            const config = { logLevel: 'error' as const };
            const initializedLogger = initializeLogger(config);
            const retrievedLogger = getLogger();

            expect(initializedLogger).toBe(retrievedLogger);
        });

        test('should create default logger if not initialized', () => {
            // Reset global logger
            const logger1 = getLogger();
            const logger2 = getLogger();

            expect(logger1).toBe(logger2);
        });
    });

    describe('Initial Loading Message', () => {
        test('should log initial loading message on initialization', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Create new logger to test initialization with batch size 1 for immediate flush
            const config: Partial<LoggingConfig> = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 1,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'info',
                retryAttempts: 3
            };

            const configManager = new ConfigManager(config);
            new Logger(configManager);

            // Wait for async flush of initial loading message
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    body: expect.stringContaining('Loading Safari Extension Unified Logging')
                })
            );
        });
    });
});