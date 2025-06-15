/**
 * Minimal Chrome background script
 * Only handles version checks from the website
 */

interface VersionRequest {
  action: 'getVersion';
}

interface VersionResponse {
  version: string;
}

logger.info('Background script initialized');

// Allow external messages from the website for version checking
chrome.runtime.onMessageExternal.addListener(
  (
    request: VersionRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: VersionResponse) => void
  ) => {
    logger.debug('External message received:', request.action, 'from', sender.url);

    if (request.action === 'getVersion') {
      const version = chrome.runtime.getManifest().version;
      logger.info('Version request fulfilled:', version, 'for', sender.url);
      sendResponse({ version });
      return true;
    }

    logger.warn('Unknown external message action:', request.action, 'from', sender.url);
  }
);
