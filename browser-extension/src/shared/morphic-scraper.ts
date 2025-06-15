/**
 * Core scraping logic for Morphic extension
 * This file contains browser-agnostic code that can be shared across different browser extensions
 */

// === Types ===
interface JWTPayload {
  search_id: number;
  limit: number;
  upload_url: string;
  exp: number;
  aud?: string;
  iss?: string;
}

interface ScrapedResult {
  imageUrl: string;
  pageUrl: string;
}

// Constants defining the scraping behavior
const RESULT_TIMEOUT = 250; // Timeout between scraping attempts (in milliseconds)
const RETRY_TIMEOUT = 250; // Timeout between retry attempts when scraping fails (in milliseconds)
const MAX_RETRIES = 20; // Maximum number of retries if scraping a result fails

// Regular expressions
const MORPHIC_TOKEN_REGEX = /morphic:([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/; // Regex to extract the JWT from the URL

// JWT validation constants
const EXPECTED_AUDIENCE = 'morphic-browser-extension';
const EXPECTED_ISSUER = 'morphic-api';

// CSS selectors for DOM elements that the scraper interacts with
const RESULT_CONTAINER_SELECTOR = '.MjjYud'; // Selector for the container holding the results
const RESULT_SELECTOR = '.eA0Zlc.WghbWd';
const SEE_MORE_BUTTON_SELECTOR = 'div.GNJvt'; // Selector for the "See more" button to load more results

/**
 * Decodes a JWT token and returns the payload.
 * @param {string} token - The JWT token to decode
 * @returns {Object} - The decoded payload
 */
function decodeJWT(token: string): JWTPayload {
  const parts = token.split('.');
  const payload = parts[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

/**
 * Validates a JWT payload for security and expiration.
 * @param {JWTPayload} payload - The decoded JWT payload to validate
 * @throws {Error} - If the token is invalid or expired
 */
function validateJWT(payload: JWTPayload): void {
  // Check expiration
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime >= payload.exp) {
    throw new Error('Token expired');
  }

  // Check audience if present
  if (payload.aud && payload.aud !== EXPECTED_AUDIENCE) {
    throw new Error(`Invalid token audience: expected '${EXPECTED_AUDIENCE}', got '${payload.aud}'`);
  }

  // Check issuer if present
  if (payload.iss && payload.iss !== EXPECTED_ISSUER) {
    throw new Error(`Invalid token issuer: expected '${EXPECTED_ISSUER}', got '${payload.iss}'`);
  }
}

/**
 * OverlayManager: A class that handles the centered modal overlay on the SERP page.
 * This replaces Chrome notifications with a more contextual user experience.
 */
class OverlayManager {
  private overlay: HTMLDivElement | null;
  private modal: HTMLDivElement | null;
  private progressBar: HTMLDivElement | null;
  private progressText: HTMLDivElement | null;
  private statusText: HTMLDivElement | null;
  private returnButtonHandler: (() => void) | null;

  constructor() {
    this.overlay = null;
    this.modal = null;
    this.progressBar = null;
    this.progressText = null;
    this.statusText = null;
    this.returnButtonHandler = null;
    this.createOverlay();
  }

  createOverlay() {
    // Create overlay backdrop
    this.overlay = document.createElement('div');
    this.overlay.id = 'morphic-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
      min-width: 400px;
      max-width: 500px;
    `;

    // Create content elements
    modal.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Gathering Results</h2>
        <p id="morphic-status" style="margin: 0; color: #6b7280; font-size: 14px;">Morphic is starting...</p>
      </div>
      <div style="margin-bottom: 24px;">
        <div style="background: #f3f4f6; border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 8px;">
          <div id="morphic-progress" style="background: #2563eb; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
        </div>
        <p id="morphic-count" style="margin: 0; font-size: 14px; color: #6b7280;">0 of 0 results</p>
      </div>
      <div id="morphic-actions" style="display: none;">
        <button id="morphic-return" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Return to Morphic</button>
      </div>
    `;

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    // Add click handler for return button
    this.returnButtonHandler = () => window.close();
    document.getElementById('morphic-return')?.addEventListener('click', this.returnButtonHandler);
  }

  updateStatus(message: string): void {
    const statusEl = document.getElementById('morphic-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  updateProgress(current: number, total: number): void {
    const progressEl = document.getElementById('morphic-progress');
    const countEl = document.getElementById('morphic-count');

    if (progressEl && total > 0) {
      const percentage = (current / total) * 100;
      progressEl.style.width = `${percentage}%`;
    }

    if (countEl) {
      countEl.textContent = `${current} of ${total} results`;
    }
  }

  showComplete(totalResults: number): void {
    this.updateStatus('Complete! Results sent to Morphic.');
    this.updateProgress(totalResults, totalResults);

    const actionsEl = document.getElementById('morphic-actions');
    if (actionsEl) {
      actionsEl.style.display = 'block';
    }
  }

  showError(message: string): void {
    this.updateStatus(`Error: ${message}`);

    const actionsEl = document.getElementById('morphic-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button onclick="document.getElementById('morphic-overlay').remove()" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Close</button>
      `;
      actionsEl.style.display = 'block';
    }
  }

  /**
   * Cleans up event listeners and removes the overlay from the DOM.
   * Call this method to prevent memory leaks when the overlay is no longer needed.
   */
  cleanup(): void {
    if (this.returnButtonHandler) {
      document
        .getElementById('morphic-return')
        ?.removeEventListener('click', this.returnButtonHandler);
      this.returnButtonHandler = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

/**
 * retry: A utility function that retries a given function a specified number of times
 * with a timeout between each attempt. It is used for handling temporary failures during scraping.
 *
 * @param {function} fn - The function to retry (it should return a promise).
 * @param {number} retries - The maximum number of retry attempts.
 * @param {number} timeout - The timeout between retry attempts (in milliseconds).
 * @returns {Promise} - Resolves if the function succeeds, rejects after exceeding retries.
 */
async function retry<T>(fn: () => Promise<T>, retries: number, timeout: number): Promise<T> {
  let attempts = 0; // Track the number of attempts
  let lastError: Error;
  while (attempts < retries) {
    try {
      return await fn(); // Try the function
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts++;
      if (attempts >= retries) {
        throw new Error(`Failed after ${retries} retries. Last error: ${lastError.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, timeout)); // Wait before retrying
    }
  }
  // This should never be reached due to the throw above, but TypeScript needs it
  throw new Error(`Failed after ${retries} retries. Last error: ${lastError!.message}`);
}

/**
 * Simulates a mouse hover event on the given element.
 * This triggers Google Images to load additional metadata for search results.
 * @param {Element} element - The DOM element to simulate hover on
 */
function simulateHover(element: Element): void {
  const event1 = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(event1);
}

/**
 * Utils: A utility object that holds helper functions for parsing links and checking their validity.
 */
const Utils = {
  /**
   * Parses a search result link to extract the image and visible links using URLSearchParams.
   * @param {HTMLElement} link - The link element containing the href attribute.
   * @returns {Object} - An object containing the image link and visible link.
   */
  parseResultLink(link: HTMLAnchorElement): { imageUrl: string | null; pageUrl: string | null } {
    const href = link.getAttribute('href');
    if (!href) {
      throw new Error('Link has no href attribute');
    }
    logger.debug('Href to parse:', href); // Log the href attribute of the link

    // Replace &amp; with & to properly handle the query string
    const fixedHref = href.replace(/&amp;/g, '&');

    // Use URLSearchParams to extract imgurl and imgrefurl from the query string
    const params = new URLSearchParams(fixedHref.split('?')[1]);

    const parsedResult = {
      imageUrl: params.get('imgurl'),
      pageUrl: params.get('imgrefurl')
    };

    logger.debug('Parsed result object:', parsedResult); // Log the parsed result
    return parsedResult;
  },

  /**
   * Checks if a search result link can be parsed by ensuring it matches the expected format.
   * @param {HTMLElement} link - The link element to check.
   * @returns {boolean} - True if the link can be parsed, false otherwise.
   */
  canParseLink(link: Element): boolean {
    if (!link) {
      return false;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return false;
    }
    const fixedHref = href.replace(/&amp;/g, '&');

    // Check if the href contains a query string
    if (!fixedHref.includes('?')) {
      return false;
    }

    try {
      // Parse the query parameters to check for required fields
      const params = new URLSearchParams(fixedHref.split('?')[1]);

      // A valid Google Images result link should have both imgurl and imgrefurl parameters
      return params.has('imgurl') && params.has('imgrefurl');
    } catch {
      // If URLSearchParams parsing fails, the link is not valid
      return false;
    }
  }
};

/**
 * Scraper: The main class responsible for scraping search results. It manages the state of the scraping process,
 * handles retries, and interacts with the OverlayManager to update the user on progress.
 * This class should be extended by browser-specific implementations.
 */
class Scraper {
  private resultTimeout: number;
  private maxRetries: number;
  private scrapedResults: ScrapedResult[];
  private cursor: number;
  private morphicId: number;
  private resultsToScrape: number;
  private uploadUrl: string;
  private token: string;
  private overlay: OverlayManager;

  /**
   * Constructor initializes the scraper with JWT configuration.
   */
  constructor(resultTimeout: number = RESULT_TIMEOUT, maxRetries: number = MAX_RETRIES) {
    this.resultTimeout = resultTimeout;
    this.maxRetries = maxRetries;
    this.scrapedResults = []; // Store successfully scraped results
    this.cursor = 0; // Track the current result index to scrape

    // Extract and decode JWT from URL
    const jwt = this.getJWTToken();
    const jwtPayload = decodeJWT(jwt);
    
    // Validate the JWT payload
    validateJWT(jwtPayload);
    
    this.morphicId = jwtPayload.search_id;
    this.resultsToScrape = jwtPayload.limit;
    this.uploadUrl = jwtPayload.upload_url;
    this.token = jwt;

    // Create overlay manager
    this.overlay = new OverlayManager();
  }

  /**
   * Extracts the JWT token from the current page's URL.
   * @returns {string} - The JWT token.
   * @throws {Error} - If the JWT cannot be found in the URL.
   */
  getJWTToken(): string {
    const match = MORPHIC_TOKEN_REGEX.exec(window.location.href);
    if (!match) {
      throw new Error('Morphic token not found in URL');
    }
    return match[1];
  }

  /**
   * Attempts to scrape a single search result. It locates the result container using the cursor,
   * validates the result link, and stores the scraped data.
   * This method will retry the result scraping up to MAX_RETRIES times.
   *
   * @param {number} cursor - The current cursor for the result being scraped.
   * @throws {Error} - If the result scraping fails after retries.
   */
  async scrapeSingleResult(cursor: number): Promise<void> {
    logger.debug(`Attempting to scrape result at cursor ${cursor}...`);

    const resultsContainer = document.querySelector(RESULT_CONTAINER_SELECTOR);
    logger.debug(
      `Results container (cursor: ${cursor}):`,
      resultsContainer ? 'Found' : 'Not found'
    );

    if (!resultsContainer) {
      logger.debug(`Results container is null at cursor ${cursor} (waiting for DOM)`);
      throw new Error('Results container is null');
    }

    // Get all elements matching the selector
    const elements = resultsContainer.querySelectorAll(RESULT_SELECTOR);
    // Safely select the nth element (cursor index), if it exists
    const resultContainer = elements.length > cursor ? elements[cursor] : null;
    // Log whether the element was found
    logger.debug(`Result container for cursor ${cursor}:`, resultContainer ? 'Found' : 'Not found');

    if (!resultContainer) {
      logger.debug(
        `Result container not found for cursor ${cursor}, checking for "See more" button...`
      );
      const seeMoreButton = document.querySelector(SEE_MORE_BUTTON_SELECTOR) as HTMLElement;
      if (seeMoreButton) {
        logger.info(`See more button found, clicking to load more results (cursor: ${cursor})`);
        seeMoreButton.click();
      } else {
        logger.debug(
          `See more button not found, and no result container at cursor ${cursor} (waiting for DOM)`
        );
      }
      throw new Error(`Result container ${cursor} not found`);
    }

    // Scroll the result container into view
    resultContainer.scrollIntoView();

    // Find the link in the result container
    const resultLink = resultContainer.querySelector('.ob5Hkd > a');
    logger.debug(`Result link for cursor ${cursor}:`, resultLink ? 'Found' : 'Not found');

    if (!resultLink) {
      logger.debug(`Result link is null at cursor ${cursor} (waiting for DOM)`);
      throw new Error(`Result link not found at cursor ${cursor}`);
    }

    // Find the trigger div in the result container
    const triggerDiv = resultContainer.querySelector('div.F0uyec');
    if (triggerDiv) {
      logger.debug(`Hovering result link at cursor ${cursor}...`);
      simulateHover(triggerDiv);
    }

    logger.debug(`Result link for cursor ${cursor}: ${resultLink}`);

    // Log if the link is not parsable
    if (!Utils.canParseLink(resultLink)) {
      logger.debug(`Cannot parse result link at cursor ${cursor} (waiting for DOM)`, resultLink);
      throw new Error(`Invalid result link at cursor ${cursor}`);
    }

    // Parse the result and store it in the scraped results array
    const parsedResult = Utils.parseResultLink(resultLink as HTMLAnchorElement);
    logger.debug(`Parsed result at cursor ${cursor}:`, parsedResult);

    // Only add non-null results
    if (parsedResult.imageUrl && parsedResult.pageUrl) {
      // Validate protocol before accepting the result
      const validProtocols = ['http:', 'https:', 'ftp:'];
      let protocol: string;

      try {
        const url = new URL(parsedResult.imageUrl);
        protocol = url.protocol;
      } catch (error) {
        // Handle special protocols like x-raw-image that URL constructor can't parse
        protocol = parsedResult.imageUrl.split('://')[0] + ':';
      }

      if (!validProtocols.includes(protocol.toLowerCase())) {
        logger.debug(
          `Invalid protocol '${protocol}' detected at cursor ${cursor}, triggering retry...`
        );
        throw new Error(`Invalid protocol '${protocol}' - expecting http/https/ftp`);
      }

      this.scrapedResults.push({
        imageUrl: parsedResult.imageUrl,
        pageUrl: parsedResult.pageUrl
      });
    } else {
      throw new Error(`Parsed result contains null values at cursor ${cursor}`);
    }
  }

  /**
   * Sends the scraped results to the server.
   * @returns {Promise} - Resolves when upload completes
   */
  async uploadResults(): Promise<void> {
    // Transform internal ScrapedResult format to backend API format
    const backendResults = this.scrapedResults.map(result => ({
      image_link: result.imageUrl,
      visible_link: result.pageUrl
    }));

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Upload-Token': this.token
      },
      body: JSON.stringify({
        morphic_id: this.morphicId,
        results: JSON.stringify(backendResults)
      })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Main method that controls the scraping process. It runs a loop that continues
   * scraping results until the target number of results is reached, retrying if necessary.
   * If the scraping fails after retries for a particular result, the entire process halts.
   */
  async scrape() {
    this.overlay.updateStatus('Morphic is starting...');
    this.overlay.updateProgress(0, this.resultsToScrape);

    try {
      // Continue scraping until we've gathered enough results
      while (this.scrapedResults.length < this.resultsToScrape) {
        logger.info(`Scraping progress: ${this.scrapedResults.length}/${this.resultsToScrape}`);

        // Retry scraping each result up to MAX_RETRIES
        try {
          await retry(() => this.scrapeSingleResult(this.cursor), this.maxRetries, RETRY_TIMEOUT);
          logger.debug(`Successfully scraped result at cursor ${this.cursor}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            `Failed to scrape result at cursor ${this.cursor} after ${this.maxRetries} retries: ${errorMessage}`
          );

          // Provide more context if it's a protocol error
          if (errorMessage.includes('Invalid protocol')) {
            logger.error(
              'Result may contain x-raw-image or other unsupported protocol that never resolved to a valid URL'
            );
          }

          throw error; // Halt scraping process on failure
        }

        this.overlay.updateStatus('Morphic is gathering results...');
        this.overlay.updateProgress(this.scrapedResults.length, this.resultsToScrape);

        // Move to the next result after successful scrape
        this.cursor++;
        await new Promise(resolve => setTimeout(resolve, this.resultTimeout)); // Wait before scraping the next result
      }

      // Once scraping is complete, send the results and show completion
      this.overlay.updateStatus('Uploading results...');
      await this.uploadResults();
      this.overlay.showComplete(this.scrapedResults.length);
      logger.info('Scraping completed successfully.');
    } catch (error) {
      // In case of failure, show error in overlay
      this.overlay.showError(
        (error instanceof Error ? error.message : String(error)) || 'Failed to gather results'
      );
      logger.error('Scraping failed:', error); // Log the error for debugging
    }
  }
}

// Scraper class is available as a global for browser extension use
