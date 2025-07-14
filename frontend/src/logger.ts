import { LogEntry, LoggerService, LoggingConfig } from './types/logging';
import { getVersionString, EXTENSION_NAME } from './version';
import { AsyncLogQueue } from './log-queue';
import { ConfigManager } from './config-manager';

export class Logger implements LoggerService {
    private configManager: ConfigManager;
    private logQueue: AsyncLogQueue;
    private isInitialized = false;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
        this.logQueue = new AsyncLogQueue(configManager.getConfig());
        this.initialize();
    }

    private initialize(): void {
        if (this.isInitialized) return;
        
        // Start auto-flush for the queue
        this.logQueue.startAutoFlush(this.configManager.getFlushInterval());
        
        // Log the initial loading message
        this.info(`Loading ${EXTENSION_NAME} ${getVersionString()}`);
        this.isInitialized = true;
    }

    private createLogEntry(
        level: 'debug' | 'info' | 'warn' | 'error',
        message: string,
        context?: object,
        stackTrace?: string,
        component?: string
    ): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            source: 'frontend',
            context,
            stackTrace,
            component: component || 'safari-extension'
        };
    }

    private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
        return this.configManager.shouldLog(level);
    }



    debug(message: string, context?: object): void {
        if (!this.shouldLog('debug')) return;

        const entry = this.createLogEntry('debug', message, context);
        this.logQueue.enqueue(entry);
    }

    info(message: string, context?: object): void {
        if (!this.shouldLog('info')) return;

        const entry = this.createLogEntry('info', message, context);
        this.logQueue.enqueue(entry);
    }

    warn(message: string, context?: object): void {
        if (!this.shouldLog('warn')) return;

        const entry = this.createLogEntry('warn', message, context);
        this.logQueue.enqueue(entry);
    }

    error(message: string, context?: object): void {
        if (!this.shouldLog('error')) return;

        const entry = this.createLogEntry('error', message, context);
        this.logQueue.enqueue(entry);
    }

    // Special method for logging exceptions with stack traces
    logException(error: Error, message?: string, context?: object): void {
        const errorMessage = message || error.message || 'An error occurred';
        const stackTrace = error.stack || 'No stack trace available';
        
        const entry = this.createLogEntry(
            'error',
            errorMessage,
            {
                ...context,
                errorName: error.name,
                errorMessage: error.message
            },
            stackTrace
        );

        this.logQueue.enqueue(entry);
    }

    // Method to log with custom component
    logWithComponent(
        level: 'debug' | 'info' | 'warn' | 'error',
        component: string,
        message: string,
        context?: object
    ): void {
        if (!this.shouldLog(level)) return;

        const entry = this.createLogEntry(level, message, context, undefined, component);
        this.logQueue.enqueue(entry);
    }

    // Method to manually flush the queue
    async flushLogs(): Promise<void> {
        await this.logQueue.flush();
    }

    // Method to flush all logs (useful for cleanup)
    async flushAllLogs(): Promise<void> {
        await this.logQueue.flushAll();
    }

    // Method to get queue status for debugging
    getQueueStatus(): { size: number; isFlushInProgress: boolean } {
        return this.logQueue.getQueueStatus();
    }

    // Method to stop auto-flush (useful for cleanup)
    stopAutoFlush(): void {
        this.logQueue.stopAutoFlush();
    }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function initializeLogger(config?: Partial<LoggingConfig>): Logger {
    const configManager = new ConfigManager(config);
    globalLogger = new Logger(configManager);
    return globalLogger;
}

export function getLogger(): Logger {
    if (!globalLogger) {
        globalLogger = initializeLogger();
    }
    return globalLogger;
}

export function initializeLoggerFromFile(configPath?: string): Promise<Logger> {
    return new Promise((resolve, reject) => {
        if (configPath) {
            // In a browser environment, we'd need to fetch the config file
            fetch(configPath)
                .then(response => response.json())
                .then(config => {
                    const configManager = new ConfigManager(config);
                    globalLogger = new Logger(configManager);
                    resolve(globalLogger);
                })
                .catch(error => {
                    console.warn(`Failed to load config from ${configPath}:`, error);
                    // Fall back to default config
                    const configManager = new ConfigManager();
                    globalLogger = new Logger(configManager);
                    resolve(globalLogger);
                });
        } else {
            const configManager = new ConfigManager();
            globalLogger = new Logger(configManager);
            resolve(globalLogger);
        }
    });
}