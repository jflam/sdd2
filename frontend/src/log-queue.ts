import { LogEntry, LogQueue, LoggingConfig } from './types/logging';

export class AsyncLogQueue implements LogQueue {
    private queue: LogEntry[] = [];
    private config: LoggingConfig;
    private isFlushInProgress = false;
    private autoFlushTimer: NodeJS.Timeout | null = null;
    constructor(config: LoggingConfig) {
        this.config = config;
    }

    enqueue(logEntry: LogEntry): void {
        // Check if queue is at maximum capacity before adding
        if (this.queue.length >= this.config.maxQueueSize) {
            this.handleQueueOverflow();
        }

        this.queue.push(logEntry);

        // Auto-flush if batch size is reached
        if (this.queue.length >= this.config.batchSize) {
            this.flush().catch(error => {
                console.error('Auto-flush failed:', error);
            });
        }
    }

    private handleQueueOverflow(): void {
        // Priority-based dropping: keep errors, drop debug messages first
        const priorityOrder = ['debug', 'info', 'warn', 'error'];
        
        for (const level of priorityOrder) {
            const indexToRemove = this.queue.findIndex(entry => entry.level === level);
            if (indexToRemove !== -1) {
                this.queue.splice(indexToRemove, 1);
                console.warn(`Log queue overflow: dropped ${level} message`);
                return;
            }
        }

        // If no debug/info/warn messages, drop the oldest entry
        if (this.queue.length > 0) {
            const dropped = this.queue.shift();
            console.warn(`Log queue overflow: dropped oldest message (${dropped?.level})`);
        }
    }

    async flush(): Promise<void> {
        if (this.isFlushInProgress || this.queue.length === 0) {
            return;
        }

        this.isFlushInProgress = true;

        try {
            // Create a batch from current queue
            const batch = this.queue.splice(0, this.config.batchSize);
            
            if (batch.length > 0) {
                await this.sendBatchWithRetry(batch);
            }
        } finally {
            this.isFlushInProgress = false;
        }
    }

    private async sendBatchWithRetry(batch: LogEntry[], attemptNumber = 0): Promise<void> {
        try {
            await this.sendBatch(batch);
        } catch (error) {
            if (attemptNumber < this.config.retryAttempts) {
                // Use exponential backoff based on the configured retry delay
                const delay = this.config.retryDelayMs * Math.pow(2, attemptNumber);
                console.warn(`Log transmission failed (attempt ${attemptNumber + 1}/${this.config.retryAttempts + 1}), retrying in ${delay}ms:`, error);
                
                await this.sleep(delay);
                return this.sendBatchWithRetry(batch, attemptNumber + 1);
            } else {
                console.error('Log transmission failed after all retry attempts:', error);
                // Fallback to console logging
                this.fallbackToConsole(batch);
                throw error;
            }
        }
    }

    private async sendBatch(batch: LogEntry[]): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            const response = await fetch(`${this.config.apiEndpoint}/api/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entries: batch
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private fallbackToConsole(batch: LogEntry[]): void {
        console.warn('Falling back to console logging due to backend unavailability');
        batch.forEach(entry => this.logToConsole(entry));
    }

    private logToConsole(entry: LogEntry): void {
        const timestamp = entry.timestamp;
        const level = entry.level.toUpperCase();
        const source = entry.source.toUpperCase();
        const component = entry.component ? `[${entry.component.toUpperCase()}]` : '';
        const context = entry.context ? JSON.stringify(entry.context) : '';
        const stackTrace = entry.stackTrace ? `\n${entry.stackTrace}` : '';

        const logMessage = `[${timestamp}] [${level}] [${source}] ${component} ${entry.message} ${context}${stackTrace}`;

        switch (entry.level) {
            case 'debug':
                console.debug(logMessage);
                break;
            case 'info':
                console.info(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    startAutoFlush(intervalMs: number): void {
        if (this.autoFlushTimer) {
            clearInterval(this.autoFlushTimer);
        }

        this.autoFlushTimer = setInterval(() => {
            this.flush().catch(error => {
                console.error('Auto-flush interval failed:', error);
            });
        }, intervalMs);
    }

    stopAutoFlush(): void {
        if (this.autoFlushTimer) {
            clearInterval(this.autoFlushTimer);
            this.autoFlushTimer = null;
        }
    }

    // Get current queue status for debugging
    getQueueStatus(): { size: number; isFlushInProgress: boolean } {
        return {
            size: this.queue.length,
            isFlushInProgress: this.isFlushInProgress
        };
    }

    // Force flush all remaining entries (useful for cleanup)
    async flushAll(): Promise<void> {
        while (this.queue.length > 0) {
            await this.flush();
            // Small delay to ensure flush completes
            await this.sleep(1);
        }
    }
}