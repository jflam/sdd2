// Chrome Extension Content Script
// Injects logging capabilities into web pages

import { ExtensionMessage, LogLevel } from '@shared/types';

class ChromeContentScript {
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  constructor() {
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    };

    this.initialize();
  }

  private initialize(): void {
    // Intercept console methods
    this.interceptConsole();

    // Set up global error handlers
    this.setupErrorHandlers();

    // Log content script injection
    this.sendLog('debug', 'Content script injected', {
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  private interceptConsole(): void {
    // Intercept console.log
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.sendLog('info', this.formatConsoleMessage(args), {
        method: 'console.log',
        args: this.sanitizeArgs(args)
      });
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.sendLog('info', this.formatConsoleMessage(args), {
        method: 'console.info',
        args: this.sanitizeArgs(args)
      });
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.sendLog('warn', this.formatConsoleMessage(args), {
        method: 'console.warn',
        args: this.sanitizeArgs(args)
      });
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.sendLog('error', this.formatConsoleMessage(args), {
        method: 'console.error',
        args: this.sanitizeArgs(args)
      });
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.sendLog('debug', this.formatConsoleMessage(args), {
        method: 'console.debug',
        args: this.sanitizeArgs(args)
      });
    };
  }

  private setupErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.sendLog('error', `Uncaught Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        url: window.location.href
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.sendLog('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason,
        stack: event.reason?.stack,
        url: window.location.href
      });
    });
  }

  private sendLog(level: LogLevel, message: string, context?: Record<string, any>): void {
    const logMessage: ExtensionMessage = {
      type: 'LOG',
      payload: {
        level,
        message,
        context: {
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      }
    };

    // Send to background script
    chrome.runtime.sendMessage(logMessage).catch((error) => {
      // Fallback to original console if extension communication fails
      this.originalConsole.error('Failed to send log to background script:', error);
    });
  }

  private formatConsoleMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return arg;
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Object]';
        }
      } else {
        return String(arg);
      }
    }).join(' ');
  }

  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Create a sanitized copy of objects
          return JSON.parse(JSON.stringify(arg));
        } catch {
          return '[Circular Object]';
        }
      }
      return arg;
    });
  }
}

// Initialize content script
new ChromeContentScript();