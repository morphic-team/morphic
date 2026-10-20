/**
 * Version handshake for the Morphic website
 *
 * Firefox does not support web-page-to-extension messaging (externally_connectable),
 * so the website cannot ask the extension for its version directly. Instead this
 * content script runs on the website at document_start and publishes the installed
 * extension version as a data attribute on the root element. The website reads
 * the attribute to decide whether a compatible extension is installed.
 */

const VERSION_ATTRIBUTE = 'morphicExtensionVersion';

function announceExtensionVersion(): void {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.dataset[VERSION_ATTRIBUTE] = version;
  logger.info('Announced extension version to website:', version);
}
