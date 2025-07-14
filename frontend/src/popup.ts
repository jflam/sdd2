// Popup script for Safari extension
import { getLogger } from './logger';
import { getExceptionHandler, safeExecute } from './exception-handler';
import { getVersionString, EXTENSION_NAME } from './version';

const logger = getLogger();
const exceptionHandler = getExceptionHandler();

// Log popup initialization
logger.info('Popup opened');

// Update version display
document.addEventListener('DOMContentLoaded', () => {
    safeExecute(
        () => {
            const versionElement = document.getElementById('version');
            if (versionElement) {
                versionElement.textContent = `Version: ${getVersionString()}`;
            }

            // Test backend connection
            testBackendConnection();
            
            // Log user interaction
            logger.debug('Popup DOM loaded', {
                url: window.location.href,
                timestamp: Date.now()
            });
        },
        { component: 'popup', action: 'dom-loaded' }
    );
});

async function testBackendConnection(): Promise<void> {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;

    await safeExecute(
        async () => {
            logger.debug('Testing backend connection');
            
            const response = await fetch('http://localhost:8000/health');
            
            if (response.ok) {
                const data = await response.json();
                statusElement.textContent = 'Connected to backend';
                statusElement.className = 'status connected';
                
                logger.info('Backend connection successful', {
                    status: data.status,
                    service: data.service
                });
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        },
        { component: 'popup', action: 'test-backend-connection' },
        undefined // fallback value
    ).then((result) => {
        // If safeExecute returned undefined, it means an error occurred
        if (result === undefined) {
            statusElement.textContent = 'Backend unavailable';
            statusElement.className = 'status disconnected';
        }
    });
}

// Example of logging user interactions with exception handling
document.addEventListener('click', (event) => {
    safeExecute(
        () => {
            const target = event.target as HTMLElement;
            logger.debug('User clicked element', {
                tagName: target.tagName,
                id: target.id,
                className: target.className
            });
        },
        { component: 'popup', action: 'user-click' }
    );
});

// Log when popup is closed
window.addEventListener('beforeunload', () => {
    logger.info('Popup closing');
});