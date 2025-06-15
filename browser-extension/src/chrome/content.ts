/**
 * Chrome-specific content script
 * Simply starts the scraper - all logic is in the shared code
 */

// Start the scraping process using the shared Scraper class
const scraper = new Scraper();
scraper.scrape();
