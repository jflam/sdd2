// Chrome Extension Popup Script
import { ExtensionMessage } from '@shared/types';

class ChromeExtensionPopup {
  private elements: {
    version: HTMLElement;
    status: HTMLElement;
    refreshBtn: HTMLButtonElement;
    flushBtn: HTMLButtonElement;
    queueSize: HTMLElement;
    backendStatus: HTMLElement;
    lastUpdate: HTMLElement;
    testMessage: HTMLInputElement;
    testInfo: HTMLButtonElement;
    testWarn: HTMLButtonElement;
    testError: HTMLButtonElement;
  };

  constructor() {
    this.elements = this.getElements();
    this.initialize();
  }

  private getElements() {
    return {
      version: document.getElementById('version')!,
      status: document.getElementById('status')!,
      refreshBtn: document.getElementById('refresh-btn') as HTMLButtonElement,
      flushBtn: document.getElementById('flush-btn') as HTMLButtonElement,
      queueSize: document.getElementById('queue-size')!,
      backendStatus: document.getElementById('backend-status')!,
      lastUpdate: document.getElementById('last-update')!,
      testMessage: document.getElementById('test-message') as HTMLInputElement,
      testInfo: document.getElementById('test-info') as HTMLButtonElement,
      testWarn: document.getElementById('test-warn') as HTMLButtonElement,
      testError: document.getElementById('test-error') as HTMLButtonElement
    };
  }

  private async initialize(): Promise<void> {
    // Set up event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadVersionInfo();
    await this.checkStatus();
  }

  private setupEventListeners(): void {
    this.elements.refreshBtn.addEventListener('click', () => {
      this.checkStatus();
    });

    this.elements.flushBtn.addEventListener('click', () => {
      this.forceFlush();
    });

    this.elements.testInfo.addEventListener('click', () => {
      this.sendTestLog('info');
    });

    this.elements.testWarn.addEventListener('click', () => {
      this.sendTestLog('warn');
    });

    this.elements.testError.addEventListener('click', () => {
      this.sendTestLog('error');
    });

    // Enter key in test message input
    this.elements.testMessage.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendTestLog('info');
      }
    });
  }

  private async loadVersionInfo(): Promise<void> {
    try {
      const response = await this.sendMessageToBackground({
        type: 'VERSION_REPORT',
        payload: {}
      });

      this.elements.version.textContent = `v${response.version}`;
    } catch (error) {
      this.elements.version.textContent = 'Version unknown';
      console.error('Failed to load version info:', error);
    }
  }

  private async checkStatus(): Promise<void> {
    this.updateStatus('checking', 'Checking connection...');

    try {
      // Check background script health
      const healthResponse = await this.sendMessageToBackground({
        type: 'HEALTH_CHECK',
        payload: {}
      });

      // Check backend API health
      const backendHealth = await this.checkBackendHealth();

      if (healthResponse.status === 'healthy' && backendHealth) {
        this.updateStatus('connected', '✅ Connected to backend');
        this.elements.backendStatus.textContent = 'Online';
      } else {
        this.updateStatus('disconnected', '❌ Backend unavailable');
        this.elements.backendStatus.textContent = 'Offline';
      }

      // Update stats
      this.elements.queueSize.textContent = healthResponse.queueSize?.toString() || '0';
      this.elements.lastUpdate.textContent = new Date().toLocaleTimeString();

    } catch (error) {
      this.updateStatus('disconnected', '❌ Extension error');
      this.elements.backendStatus.textContent = 'Error';
      console.error('Status check failed:', error);
    }
  }

  private async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/health', {
        method: 'GET',
        timeout: 5000
      } as RequestInit);

      return response.ok;
    } catch {
      return false;
    }
  }

  private updateStatus(type: 'connected' | 'disconnected' | 'checking', message: string): void {
    this.elements.status.className = `status ${type}`;
    this.elements.status.textContent = message;
  }

  private async forceFlush(): Promise<void> {
    try {
      this.elements.flushBtn.textContent = 'Flushing...';
      this.elements.flushBtn.disabled = true;

      // Send flush command to background script
      await this.sendMessageToBackground({
        type: 'LOG',
        payload: {
          level: 'info',
          message: 'Manual flush triggered from popup',
          context: { source: 'popup', action: 'force_flush' }
        }
      });

      // Refresh status after flush
      setTimeout(() => {
        this.checkStatus();
      }, 1000);

    } catch (error) {
      console.error('Force flush failed:', error);
    } finally {
      this.elements.flushBtn.textContent = 'Force Flush';
      this.elements.flushBtn.disabled = false;
    }
  }

  private async sendTestLog(level: 'info' | 'warn' | 'error'): Promise<void> {
    const message = this.elements.testMessage.value.trim() || `Test ${level} message from popup`;

    try {
      await this.sendMessageToBackground({
        type: 'LOG',
        payload: {
          level,
          message,
          context: {
            source: 'popup',
            action: 'test_log',
            timestamp: new Date().toISOString()
          }
        }
      });

      // Clear input and show feedback
      this.elements.testMessage.value = '';
      this.showTemporaryFeedback(`${level.toUpperCase()} log sent`);

    } catch (error) {
      console.error('Test log failed:', error);
      this.showTemporaryFeedback('Failed to send log');
    }
  }

  private showTemporaryFeedback(message: string): void {
    const originalText = this.elements.status.textContent;
    const originalClass = this.elements.status.className;

    this.elements.status.textContent = message;
    this.elements.status.className = 'status connected';

    setTimeout(() => {
      this.elements.status.textContent = originalText;
      this.elements.status.className = originalClass;
    }, 2000);
  }

  private async sendMessageToBackground(message: ExtensionMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChromeExtensionPopup();
});