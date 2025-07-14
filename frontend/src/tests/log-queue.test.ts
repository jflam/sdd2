import { AsyncLogQueue } from '../log-queue';
import { LogEntry, LoggingConfig } from '../types/logging';

// Mock fetch globally
global.fetch = jest.fn();

describe('AsyncLogQueue', () => {
    let logQueue: AsyncLogQueue;
    let mockConfig: LoggingConfig;
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        mockConfig = {
            apiEndpoint: 'http://localhost:8000',
            batchSize: 3,
            flushInterval: 1000,
            maxQueueSize: 5,
            logLevel: 'info',
            retryAttempts: 2
        };

        logQueue = new AsyncLogQueue(mockConfig);
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;
        mockFetch.mockClear();

        // Mock console methods to avoid noise in tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        logQueue.stopAutoFlush();
        jest.restoreAllMocks();
    });

    const createMockLogEntry = (level: 'debug' | 'info' | 'warn' | 'error' = 'info', message = 'test message'): LogEntry => ({
        timestamp: new Date().toISOString(),
        level,
        message,
        source: 'frontend',
        component: 'test'
    });

    describe('enqueue', () => {
        it('should add log entries to the queue', () => {
            const entry = createMockLogEntry();
            logQueue.enqueue(entry);

            const status = logQueue.getQueueStatus();
            expect(status.size).toBe(1);
        });

        it('should auto-flush when batch size is reached', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Add entries up to batch size
            for (let i = 0; i < mockConfig.batchSize; i++) {
                logQueue.enqueue(createMockLogEntry('info', `message ${i}`));
            }

            // Wait for async flush to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/logs',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining('"entries"')
                })
            );
        });

        it('should handle queue overflow by dropping debug messages first', async () => {
            // Create a config that prevents auto-flush during this test
            const overflowConfig = {
                ...mockConfig,
                batchSize: 10, // Higher than maxQueueSize to prevent auto-flush
                maxQueueSize: 3
            };
            const overflowQueue = new AsyncLogQueue(overflowConfig);

            // Fill queue to max capacity with debug messages
            for (let i = 0; i < overflowConfig.maxQueueSize; i++) {
                overflowQueue.enqueue(createMockLogEntry('debug', `debug ${i}`));
            }

            // Add one more entry to trigger overflow
            overflowQueue.enqueue(createMockLogEntry('error', 'important error'));

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Log queue overflow: dropped debug message'));
        });

        it('should prioritize error messages during overflow', async () => {
            // Create a config that prevents auto-flush during this test
            const overflowConfig = {
                ...mockConfig,
                batchSize: 10, // Higher than maxQueueSize to prevent auto-flush
                maxQueueSize: 5
            };
            const overflowQueue = new AsyncLogQueue(overflowConfig);

            // Fill queue with different priority messages
            overflowQueue.enqueue(createMockLogEntry('error', 'error 1'));
            overflowQueue.enqueue(createMockLogEntry('warn', 'warn 1'));
            overflowQueue.enqueue(createMockLogEntry('info', 'info 1'));
            overflowQueue.enqueue(createMockLogEntry('debug', 'debug 1'));
            overflowQueue.enqueue(createMockLogEntry('error', 'error 2'));

            // Add one more to trigger overflow
            overflowQueue.enqueue(createMockLogEntry('error', 'error 3'));

            // Should drop debug message first
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dropped debug message'));
        });
    });

    describe('flush', () => {
        it('should send batched log entries to backend', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            logQueue.enqueue(createMockLogEntry('info', 'message 1'));
            logQueue.enqueue(createMockLogEntry('warn', 'message 2'));

            await logQueue.flush();

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const call = mockFetch.mock.calls[0];
            const body = JSON.parse(call[1]?.body as string);
            expect(body.entries).toHaveLength(2);
            expect(body.entries[0].message).toBe('message 1');
            expect(body.entries[1].message).toBe('message 2');
        });

        it('should not flush if already in progress', async () => {
            mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response), 100)));

            logQueue.enqueue(createMockLogEntry());

            // Start two flushes simultaneously
            const flush1 = logQueue.flush();
            const flush2 = logQueue.flush();

            await Promise.all([flush1, flush2]);

            // Should only make one request
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should not flush empty queue', async () => {
            await logQueue.flush();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('retry logic', () => {
        it('should retry failed requests with exponential backoff', async () => {
            // Mock fetch to fail first two times, succeed on third
            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK'
                } as Response);

            logQueue.enqueue(createMockLogEntry());
            await logQueue.flush();

            // Should have made 3 attempts (initial + 2 retries)
            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Log transmission failed (attempt 1/3)'),
                expect.any(Error)
            );
        });

        it('should fallback to console after max retries', async () => {
            mockFetch.mockRejectedValue(new Error('Persistent network error'));

            logQueue.enqueue(createMockLogEntry('error', 'test error'));

            try {
                await logQueue.flush();
            } catch (error) {
                // Expected to throw after all retries
            }

            // Should have made initial attempt + configured retries
            expect(mockFetch).toHaveBeenCalledTimes(mockConfig.retryAttempts + 1);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to console logging'));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR] [FRONTEND]'));
        });

        it('should handle HTTP error responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            } as Response);

            logQueue.enqueue(createMockLogEntry());

            try {
                await logQueue.flush();
            } catch (error) {
                // Expected to throw after retries
            }

            expect(mockFetch).toHaveBeenCalledTimes(mockConfig.retryAttempts + 1);
        });
    });

    describe('auto-flush', () => {
        it('should start auto-flush with specified interval', (done) => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            logQueue.enqueue(createMockLogEntry());
            logQueue.startAutoFlush(50); // 50ms interval

            setTimeout(() => {
                expect(mockFetch).toHaveBeenCalled();
                done();
            }, 100);
        });

        it('should stop auto-flush when requested', (done) => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            logQueue.enqueue(createMockLogEntry());
            logQueue.startAutoFlush(50);
            logQueue.stopAutoFlush();

            setTimeout(() => {
                expect(mockFetch).not.toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    describe('queue status', () => {
        it('should return correct queue status', () => {
            logQueue.enqueue(createMockLogEntry());
            logQueue.enqueue(createMockLogEntry());

            const status = logQueue.getQueueStatus();
            expect(status.size).toBe(2);
            expect(status.isFlushInProgress).toBe(false);
        });
    });

    describe('flushAll', () => {
        it('should flush all entries in multiple batches', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            // Add more entries than batch size (but avoid auto-flush during enqueue)
            // We'll add 7 entries, but the first 3 will auto-flush, leaving 4
            for (let i = 0; i < 7; i++) {
                logQueue.enqueue(createMockLogEntry('info', `message ${i}`));
            }

            // Wait for auto-flush to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            // Clear the mock to count only flushAll calls
            mockFetch.mockClear();

            await logQueue.flushAll();

            // Should make at least one request to flush remaining entries
            expect(mockFetch).toHaveBeenCalledTimes(2); // 3 + 1 = 4 remaining entries
            
            const status = logQueue.getQueueStatus();
            expect(status.size).toBe(0);
        });
    });

    describe('timeout handling', () => {
        it('should timeout long requests', async () => {
            // Mock fetch to simulate timeout by rejecting with AbortError
            mockFetch.mockImplementation(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => {
                        const error = new Error('The operation was aborted');
                        error.name = 'AbortError';
                        reject(error);
                    }, 50);
                });
            });

            logQueue.enqueue(createMockLogEntry());

            await expect(logQueue.flush()).rejects.toThrow();
        }, 5000);
    });

    describe('console fallback formatting', () => {
        it('should format console logs correctly', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const entry = createMockLogEntry('warn', 'test warning');
            entry.context = { userId: '123' };
            entry.stackTrace = 'Error stack trace';

            logQueue.enqueue(entry);

            try {
                await logQueue.flush();
            } catch (error) {
                // Expected
            }

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('[WARN] [FRONTEND] [TEST] test warning {"userId":"123"}')
            );
        });
    });
});