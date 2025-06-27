# Changelog

All notable changes to the Morphic Website will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-06-27

### Added
- **Projects Page**: New dedicated page showcasing research projects using Morphic
  - Overview of how researchers leverage Morphic for trait variation studies
  - Comprehensive table of 17 published research papers with direct DOI links
  - Categorized research areas: color polymorphism, evolutionary ecology, conservation
  - Call-to-action for researchers to share their Morphic-powered projects
  - Added navigation item in main menu between Privacy and authentication options

## [1.2.0] - 2025-06-17

### Added
- **Date Field Type**: New form field type for date selection in surveys
  - Native HTML date picker integration  
  - ISO 8601 date format storage (YYYY-MM-DD)
  - Full support in survey builder, preview, and response forms
  - Seamless export functionality with proper date formatting

## [1.0.1] - 2025-06-15

### Added
- **Date Stamps**: Added date stamps to privacy policy and instructions pages for transparency
- **Docker Build Optimization**: Implemented BuildKit cache mount for faster npm dependency downloads
- **Bundle Size Monitoring**: Configured appropriate bundle size budgets (1.2MB warning threshold)

### Fixed
- **Image Toggle UX**: Improved search result image toggle behavior
  - Toggle now always visible regardless of cached image availability
  - Added "Archived (Not Available)" label when no cached image exists
  - Disabled toggle interaction when no cached image available
  - Fixed infinite loading spinner when switching to non-existent archived images
- **JWT Authentication**: Resolved 403 errors in Chrome extension upload workflow
  - Fixed JWT audience and issuer validation in backend communication
- **Build Warnings**: Configured allowedCommonJsDependencies for leaflet and leaflet-control-geocoder
  - Suppressed CommonJS optimization warnings for mapping dependencies

### Changed
- **CI/CD Pipeline**: Split Docker build workflows for efficient resource usage
  - Separate workflows for service and website builds
  - Builds only trigger when relevant files change
- **Docker Configuration**: Optimized Dockerfile with npm cache mounting for faster builds

## [1.0.0] - 2025-01-15

### Added
- **Initial Release**: Complete Angular 20 frontend application
- **User Authentication**: Sign-in/sign-up with session management
- **Survey Management**: Create, edit, and manage research surveys
  - Text, select, radio button, and location field types
  - Real-time survey preview during creation
  - Survey archiving and organization
- **Search Integration**: Google Images search integration via Chrome extension
  - Automated result gathering with JWT-authenticated uploads
  - Search query management and organization
- **Search Results Interface**: Comprehensive result viewing and analysis
  - Image toggle between live and archived versions
  - Filtering and pagination for large result sets
  - Tag-based result organization
- **Location Picker**: Interactive map component for location-based surveys
  - Leaflet-based maps with OpenStreetMap tiles
  - Intelligent search with Nominatim geocoding
  - Click-to-place and drag-to-move marker functionality
- **Data Export**: CSV export functionality for survey results
- **Chrome Extension Integration**: Seamless integration with Morphic browser extension
  - Extension detection and version validation
  - Real-time upload progress monitoring
- **Responsive Design**: Bootstrap 5-based responsive UI
- **Documentation**: Privacy policy and usage instructions