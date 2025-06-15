# Changelog

All notable changes to the Morphic Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-01-15

### Added
- **TypeScript Migration**: Complete migration from JavaScript to TypeScript with full type safety
  - Chrome API type definitions for better developer experience
  - TypeScript compilation integrated into build system
  - Type-safe interfaces for all data structures
  
- **Professional Build System**: Enterprise-grade build pipeline
  - Three build targets: dev (with localhost), preview (testing), and release (production)
  - Extension key management moved from manifest to build configuration for cleaner builds
  - Support for generating both CRX packages and unpacked extensions
  - Clean separation of build artifacts in dist/ directory
  
- **Code Quality Infrastructure**:
  - ESLint configuration with TypeScript support
  - Prettier integration for consistent code formatting
  - JSDoc documentation for all utility functions
  - EditorConfig for cross-IDE consistency
  
- **Enterprise Logging System**: Conditional logging with multiple levels
  - Production-optimized log levels to reduce console noise
  - Debug logging preserved in development builds
  - Structured logging for better debugging

- **Enhanced JWT Security**: Client-side token validation improvements
  - Added expiration validation for better user experience
  - Implemented audience (`morphic-browser-extension`) and issuer (`morphic-api`) validation
  - Extracted validation constants to prevent magic strings
  - Enhanced error messages for debugging token issues
  
- **Manifest V3 Enhancements**:
  - Added minimum_chrome_version: "88" for proper MV3 support
  - Updated permissions and host_permissions structure
  - Modern chrome.action API usage

### Fixed
- **Critical x-raw-image URL Handling**: Resolved bug affecting ~11% of scraped URLs
  - Added strict protocol validation (only http://, https://, ftp:// allowed)
  - Implemented retry mechanism when x-raw-image URLs are detected
  - Enhanced error logging for protocol-related failures
  - Extension now waits for Google Images to resolve internal references to actual URLs
  
- **Memory Management**: Improved cleanup of event listeners and DOM references
  - Proper cleanup in OverlayManager to prevent memory leaks
  - Optimized retry logic to prevent excessive memory usage
  
- **Error Handling**: More robust error handling throughout the extension
  - Better error messages for debugging
  - Graceful fallbacks for DOM parsing failures
  - Improved retry logic with exponential backoff

### Changed
- **URL Parsing Logic**: Enhanced link validation and parsing
  - More robust handling of Google Images result structure
  - Better detection of valid vs invalid result links
  - Improved handling of special characters in URLs
  
- **DOM Interaction**: Optimized polling and element detection
  - Reduced frequency of non-critical DOM polls
  - More efficient result container detection
  - Better handling of dynamically loaded content
  
- **User Experience**: Replaced Chrome notifications with overlay modal
  - Centered modal provides real-time progress updates
  - Clear visual feedback during scraping process
  - One-click return to Morphic when complete

### Security
- Better validation of scraped data before upload
- Strict protocol validation for URLs (http/https/ftp only)

### Documentation
- Added comprehensive roadmap for multi-browser support
- Documented client-side image download research findings
- Improved inline code documentation with JSDoc
- Added detailed build system documentation in README

### Developer Experience
- Full TypeScript support with type checking
- Improved development workflow with hot reload support
- Better error messages during development
- Consistent code style enforced by linting tools

## [1.0.0] - 2025-01-11

### Added
- Initial release of Morphic Chrome Extension
- Google Images search result scraping functionality
- JWT-based authentication for secure uploads
- Basic overlay notification system
- Manifest V3 compliance
- Support for scraping image URLs and page URLs from Google Images
- Configurable result limits via JWT payload
- Retry logic for failed scraping attempts