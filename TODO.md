# TODO List

## Infrastructure & DevOps

### 🚀 Production Deployment Pipeline
**Status**: Planned  
**Priority**: High  

Improve deployment process from current docker-compose approach:
- Implement CI artifact pipeline (code → build → registry → deploy)
- Add infrastructure as code for reproducible deployments  
- Establish proper staging and rollback capabilities
- See [docs/DEPLOYMENT_PIPELINE_ANALYSIS.md](docs/DEPLOYMENT_PIPELINE_ANALYSIS.md) for detailed analysis

## Authentication & Security

### JWT-Based User Authentication (Medium Priority)
- **Current Status**: User authentication uses traditional server-side sessions
- **Proposed Enhancement**: Migrate to JWT-based authentication for improved scalability
- **Benefits**:
  - Stateless authentication suitable for microservices
  - Consistent with Chrome extension authentication pattern already implemented
  - Better support for mobile apps and third-party integrations
  - Reduced server-side session storage requirements
- **Implementation Considerations**:
  - Maintain backward compatibility during transition
  - Secure JWT storage in frontend (httpOnly cookies vs localStorage)
  - Token refresh strategy and expiration handling
  - Integration with existing session-based endpoints

## Infrastructure & Performance

### Configure Jumbo Frames (Low Priority)
- **Issue**: Currently using MTU 1450 as workaround for tunneled environment
- **Current Status**: Networks configured with 1450 MTU to prevent packet fragmentation
- **Goal**: Enable jumbo frames (9000 MTU) end-to-end for better network performance
- **Challenges**:
  - Requires jumbo frame support across entire network path
  - All switches, routers, and NICs must support 9000 MTU
  - Tunnel endpoints must be configured for jumbo frames
  - Docker network configuration updates needed
- **Implementation**: 
  - Audit network infrastructure for jumbo frame capability
  - Configure network equipment for 9000 MTU
  - Update docker-compose network settings
  - Test connectivity and performance improvements
- **Location**: `docker-compose.yml` networks section

## Backend Optimizations

### SQLAlchemy Autoflush Hack (Medium Priority)
- **Issue**: Had to manually disable autoflush due to Flask-SQLAlchemy not respecting `SQLALCHEMY_SESSION_OPTIONS`
- **Current hack**: Setting `db.session.autoflush = False` directly in `backend/__init__.py`
- **Problems**:
  - Not the proper way to configure SQLAlchemy
  - May not persist across all requests/contexts
  - Bypasses Flask-SQLAlchemy's configuration system
- **Solution**: Investigate proper Flask-SQLAlchemy configuration or upgrade to newer version
- **Location**: `backend/backend/__init__.py:24`

### Tag-Based Filtering System
- **Status**: ✅ **COMPLETED** - Removed entire tag-based filtering system to eliminate race conditions and complexity
- **Solution**: Replaced complex tag generation/filtering with simple completion state filtering
- **Improvements**: 
  - Eliminated race condition in `update_tags()` method
  - Simplified codebase by removing Tag model and related API endpoints
  - Better performance with direct SQL queries instead of tag intermediary layer

## Data Model Improvements

### Image Filename Extraction (Medium Priority)
- **Issue**: Image filename is currently calculated client-side by parsing the directLink URL
- **Problems**:
  - Inconsistent filename extraction across different URL formats
  - Unnecessary computation repeated for every table render
  - Client-side URL parsing may fail for complex/malformed URLs
- **Solution**: Calculate and store image filename in backend during search result creation
- **Implementation**:
  - Add `image_filename` field to SearchResult model
  - Extract filename during initial data ingestion
  - Handle edge cases (query parameters, fragments, URL encoding)
  - Migrate existing records to populate filename field
- **Location**: Currently in `website/src/app/survey/search-results-list/search-results-list.component.ts:157`

### SurveyField ID Usage
- **Status**: ✅ **COMPLETED** - Frontend and backend now use SurveyField IDs as stable keys instead of user-provided labels

### Sentry Integration  
- **Status**: ✅ **COMPLETED** - Removed unused Sentry integration from backend

### Export Results Feature
- **Status**: ✅ **COMPLETED** - Full CSV export functionality implemented with proper browser download handling

### Mock Data Generation
- **Status**: ✅ **COMPLETED** - Flask CLI command for populating development data: `python manage.py populate-mock-survey`

### Search Results Form System
- **Status**: ✅ **COMPLETED** - Complete search result detail view with survey form integration

### Chrome Extension Integration
- **Status**: ✅ **COMPLETED** - Full end-to-end automated result gathering system
- **Features Implemented**:
  - JWT-based authentication for secure Chrome extension uploads
  - Two-phase processing: SearchResults created immediately, images processed asynchronously
  - Elegant SERP modal overlay replacing intrusive Chrome notifications  
  - Smart extension detection with version validation (requires v0.0.14)
  - Browser compatibility checks with contextual messaging
  - Smart dismissal system that resets when extension status changes
  - Result limit validation (1-400 range) with proper error handling

## Chrome Extension Enhancements

### Real-Time Status Updates (Low Priority)
- **Feature**: Replace manual refresh button with real-time updates when extension completes
- **Current Status**: Users must manually refresh searches list to see updated result status
- **Potential Solutions**:
  - Server-Sent Events (SSE) to push completion notifications
  - Chrome extension messaging API to notify website when gathering completes
  - WebSocket connection for bi-directional real-time communication
- **Implementation**: Add SSE endpoint that tracks search completion status changes

### Automatic Tab Management (Low Priority)  
- **Feature**: Automatically close Google Images tab when result gathering completes
- **Current Status**: Users must manually close the tab after seeing "Return to Morphic" button
- **Implementation**: Add tab closing functionality to Chrome extension completion flow
- **Considerations**: Respect user preferences for tab management behavior

## Frontend Issues

### LocationPickerComponent Live Autocomplete (Low Priority)
- **Feature**: Add live search suggestions while typing in location picker
- **Current Status**: Search works on Enter with dropdown for multiple results, but no live suggestions while typing
- **Investigation Needed**: 
  - Determine if leaflet-control-geocoder's `suggest` functionality works with Nominatim
  - May need different geocoding service (Mapbox, OpenCage) that supports live autocomplete
  - Alternative: Build custom autocomplete using Nominatim API directly
- **Location**: `website/src/app/survey/location-picker/location-picker.component.ts`

### Residential Proxy Image System (Medium Priority)
- **Feature**: Implement user-driven image proxy for search result visualization
- **Requirements**:
  - Frontend fetches direct_link images from client browser (bypasses CORS/anti-bot)
  - On successful load, upload image data to backend for caching
  - Backend stores cached images for future viewing
  - Fallback to direct_link display if upload fails
- **Benefits**:
  - Acts as informal residential proxy using end user's IP
  - Improves performance with cached images
  - Reduces external dependencies for image viewing
- **Implementation**:
  - Client-side image loading with canvas/blob conversion
  - Backend endpoint for image upload and storage
  - Database model for cached image metadata
  - Smart fallback logic for failed uploads