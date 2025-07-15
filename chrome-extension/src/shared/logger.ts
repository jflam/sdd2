import { LogEntry, LogLevel, LoggerConfig, LogBatch, ApiResponse } from './types';

export class UnifiedLogger {
  private config: LoggerConfig;
  private queue: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private version: string;

  constructor(config: LoggerConfig, version: string) {
    this.config = config;
    this.version = version;
    this.startAutoFlush();
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  public logException(error: Error, context?: Record<string, any>): void {
    this.log('error', error.message, {
      ...context,
      stackTrace: error.stack,
      errorName: error.name
    });
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Check if log level is enabled
    if (!this.isLogLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'chrome-extension',
      context,
      version: this.version
    };

    // Add to queue
    this.enqueue(entry);

    // Console logging if enabled
    if (this.config.enableConsoleLogging) {
      this.logToConsole(entry);
    }
  }

  private enqueue(entry: LogEntry): void {
    this.queue.push(entry);

    // Check queue size limit
    if (this.queue.length > this.config.maxQueueSize) {
      // Remove oldest entries (FIFO)
      this.queue = this.queue.slice(-this.config.maxQueueSize);
    }

    // Flush immediately if queue is full
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch: LogBatch = {
      entries: [...this.queue]
    };

    // Clear queue immediately to prevent duplicates
    this.queue = [];

    try {
      await this.sendToBackend(batch);
    } catch (error) {
      console.error('Failed to send log batch:', error);
      
      // Re-queue failed entries (up to retry limit)
      if (batch.entries.length < this.config.maxQueueSize) {
        this.queue.unshift(...batch.entries);
      }
    }
  }

  private async sendToBackend(batch: LogBatch): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(batch)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: ApiResponse = await response.json();
        
        if (result.status === 'success') {
          return; // Success!
        } else {
          throw new Error(result.message || 'Unknown API error');
        }

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          // Wait before retry with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private isLogLevelEnabled(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [CHROME-EXT]`;
    
    const logMethod = entry.level === 'error' ? console.error :
                     entry.level === 'warn' ? console.warn :
                     entry.level === 'info' ? console.info :
                     console.debug;

    if (entry.context) {
      logMethod(`${prefix} ${entry.message}`, entry.context);
    } else {
      logMethod(`${prefix} ${entry.message}`);
    }
  }

  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.startAutoFlush(); // Restart timer with new interval
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public async forceFlush(): Promise<void> {
    await this.flush();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Final flush
  }
}