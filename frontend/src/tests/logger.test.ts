import { Logger, initializeLogger, getLogger } from '../logger';
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

describe('Logger', () => {
    let logger: Logger;
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;
        mockFetch.mockClear();
        
        // Clear console mocks
        Object.values(mockConsole).forEach(mock => mock.mockClear());

        const config: LoggingConfig = {
            apiEndpoint: 'http://localhost:8000',
            batchSize: 10,
            flushInterval: 5000,
            maxQueueSize: 100,
            logLevel: 'debug',
            retryAttempts: 3
        };

        logger = new Logger(config);
    });

    describe('Log Level Filtering', () => {
        test('should respect log level configuration', () => {
            const config: LoggingConfig = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 10,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'warn',
                retryAttempts: 3
            };

            const warnLogger = new Logger(config);
            
            // Mock successful response
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            warnLogger.debug('Debug message');
            warnLogger.info('Info message');
            warnLogger.warn('Warn message');
            warnLogger.error('Error message');

            // Only warn and error should be sent
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Log Entry Creation', () => {
        test('should create properly formatted log entries', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            logger.info('Test message', { userId: '123' });

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
        test('should log exceptions with stack traces', () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            const error = new Error('Test error');
            logger.logException(error, 'Custom error message', { component: 'test' });

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
        test('should support component-specific logging', () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            logger.logWithComponent('info', 'popup', 'Popup opened', { userId: '123' });

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body as string);
            const entry = body.entries[0];

            expect(entry.component).toBe('popup');
            expect(entry.message).toBe('Popup opened');
        });
    });

    describe('Fallback Behavior', () => {
        test('should fallback to console logging when backend fails', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            logger.error('Test error message');

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [FRONTEND]')
            );
            expect(mockConsole.error).toHaveBeenCalledWith(
                expect.stringContaining('Test error message')
            );
        });

        test('should fallback to console when HTTP error occurs', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            logger.warn('Test warning');

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 0));

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
        test('should log initial loading message on initialization', () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Create new logger to test initialization
            const config: LoggingConfig = {
                apiEndpoint: 'http://localhost:8000',
                batchSize: 10,
                flushInterval: 5000,
                maxQueueSize: 100,
                logLevel: 'info',
                retryAttempts: 3
            };

            new Logger(config);

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    body: expect.stringContaining('Loading Safari Extension Unified Logging')
                })
            );
        });
    });
});