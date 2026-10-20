/**
 * Version handshake for the Morphic website
 *
 * This content script runs on the website at document_start and publishes the
 * installed extension version as a data attribute on the root element. The website
 * reads the attribute to decide whether a compatible extension is installed. A data
 * attribute is used rather than extension messaging because Firefox has no
 * web-page-to-extension messaging and Edge assigns its own extension ID, so this is
 * the one mechanism that works identically in every browser.
 */

const VERSION_ATTRIBUTE = 'morphicExtensionVersion';

function announceExtensionVersion(): void {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.dataset[VERSION_ATTRIBUTE] = version;
  logger.info('Announced extension version to website:', version);
}
