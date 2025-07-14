import { LogEntry, LoggerService, LoggingConfig } from './types/logging';
import { getVersionString, EXTENSION_NAME } from './version';

export class Logger implements LoggerService {
    private config: LoggingConfig;
    private logQueue: LogEntry[] = [];
    private isInitialized = false;

    constructor(config: LoggingConfig) {
        this.config = config;
        this.initialize();
    }

    private initialize(): void {
        if (this.isInitialized) return;
        
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
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    private async sendToBackend(entry: LogEntry): Promise<void> {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/api/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entries: [entry]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            // Fallback to console logging if backend is unavailable
            console.error('Failed to send log to backend:', error);
            this.logToConsole(entry);
        }
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

    debug(message: string, context?: object): void {
        if (!this.shouldLog('debug')) return;

        const entry = this.createLogEntry('debug', message, context);
        this.sendToBackend(entry);
    }

    info(message: string, context?: object): void {
        if (!this.shouldLog('info')) return;

        const entry = this.createLogEntry('info', message, context);
        this.sendToBackend(entry);
    }

    warn(message: string, context?: object): void {
        if (!this.shouldLog('warn')) return;

        const entry = this.createLogEntry('warn', message, context);
        this.sendToBackend(entry);
    }

    error(message: string, context?: object): void {
        if (!this.shouldLog('error')) return;

        const entry = this.createLogEntry('error', message, context);
        this.sendToBackend(entry);
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

        this.sendToBackend(entry);
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
        this.sendToBackend(entry);
    }
}

// Default configuration
const defaultConfig: LoggingConfig = {
    apiEndpoint: 'http://localhost:8000',
    batchSize: 10,
    flushInterval: 5000,
    maxQueueSize: 100,
    logLevel: 'info',
    retryAttempts: 3
};

// Global logger instance
let globalLogger: Logger | null = null;

export function initializeLogger(config?: Partial<LoggingConfig>): Logger {
    const finalConfig = { ...defaultConfig, ...config };
    globalLogger = new Logger(finalConfig);
    return globalLogger;
}

export function getLogger(): Logger {
    if (!globalLogger) {
        globalLogger = initializeLogger();
    }
    return globalLogger;
}