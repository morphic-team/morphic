# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

Morphic is a multi-component application:

- **service/**: Python 3 Flask API with SQLAlchemy ORM and PostgreSQL database
- **website/**: Angular 20 frontend built with TypeScript and Angular CLI
- **browser-extension/**: Browser extension that interacts with Google search results
- **research/**: Research tools and analysis (e.g., image-downloader)

## Essential Setup Commands

```bash
# Start development environment
cp docker-compose.dev.override.yml docker-compose.override.yml
docker-compose up

# Start production environment
cp docker-compose.prod.override.yml docker-compose.override.yml
docker-compose up
```

## Development Commands

### Backend (Python Flask)
```bash
cd service/

# Database management (Flask-Migrate)
SQLALCHEMY_DATABASE_URI=postgresql://morphic@localhost/morphic FLASK_APP=manage:app flask db upgrade  # Apply migrations
SQLALCHEMY_DATABASE_URI=postgresql://morphic@localhost/morphic FLASK_APP=manage:app flask db migrate -m "Description"  # Generate migration
SQLALCHEMY_DATABASE_URI=postgresql://morphic@localhost/morphic FLASK_APP=manage:app flask db stamp head  # Mark current DB as up-to-date

# Background processing
python manage.py background_work   # Run background tasks

# Interactive shell with models loaded
python manage.py shell
```

### Website (Angular + TypeScript)
```bash
cd website/

# Install dependencies
npm install

# Development commands
npm start            # Start dev server on port 4200
npm run build        # Build for production
npm run watch        # Build and watch for changes
npm test             # Run tests
```

### Chrome Extension (Manifest V3)
```bash
cd browser-extension/

# Install dependencies
npm install

# Development commands
npm run dev:chrome      # Development build with hot reload
npm run build:chrome    # One-shot development build
npm run preview:cws     # Preview build - creates production CRX + unpacked for testing
npm run package:cws     # Final release build for Chrome Web Store upload

# Environment setup (macOS)
export CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

**Build Targets:**
- **dev**: Includes localhost connectivity, preserves extension key for consistent ID
- **preview**: Production-identical CRX + extracted unpacked version with key for testing
- **release**: Final CRX without key field, ready for Chrome Web Store upload

**Directory Structure:**
- `src/`: Source files (manifest, scripts, assets)
- `.build/`: Temporary scratch directory (auto-cleaned)
- `dist/dev/`: Development build output
- `dist/preview/`: Preview CRX + unpacked testing version
- `dist/release/`: Final release CRX

## Technology Stack

- **Backend**: Python 3, Flask 3.1, SQLAlchemy 2.0, PostgreSQL 9.6
- **Frontend**: Angular 20, TypeScript, Angular CLI, Bootstrap 5
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Deployment**: Docker with Docker Compose
- **Extension**: Chrome Manifest V3 with professional build system
- **Mapping**: Leaflet with OpenStreetMap tiles (Google-free)
- **Geocoding**: Nominatim via leaflet-control-geocoder (API-free)

## Docker Services

### Development (docker-compose.dev.override.yml)
- `website`: Frontend development build with volume mounts
- `service`: API development build with volume mounts
- `service-worker`: Background task processor development build
- `postgres`: PostgreSQL database

### Production (docker-compose.prod.override.yml)
- `website`: Frontend with production-ready tagged images
- `service`: API service with production configuration
- `service-worker`: Background task processor
- `postgres`: Database with persistent volumes
- `cloudflared`: Cloudflare tunnel

## Key Directories

- `service/backend/api/`: REST API endpoints
- `service/backend/models/`: SQLAlchemy database models  
- `website/src/app/`: Angular components and services (TypeScript)
- `website/src/app/survey/`: Survey management components and services
- `website/src/app/survey/location-picker/`: Interactive map component with search
- `website/src/app/survey/services/`: Data services (searches, search-results, surveys)
- `website/src/app/survey/models/`: TypeScript interfaces and data models
- `browser-extension/`: Browser extension with Manifest V3 and build system

## Important Instructions

- **NEVER** attribute commits to Claude unless explicitly requested by the user
- Do not add Claude attribution to commit messages

## Git Workflow

### Semantic Commits via Pull Requests

This project uses **semantic commit conventions** for the main branch history, implemented through a branch-and-PR workflow:

#### Development Process:
1. **Create feature branch** from main
2. **Make normal commits** with descriptive messages during development
3. **Create Pull Request** with semantic commit title
4. **Squash and merge** to main, preserving the semantic PR title as the commit message

#### Semantic Commit Format:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types:
- `feat`: New features
- `fix`: Bug fixes  
- `docs`: Documentation changes
- `style`: Code style/formatting (no logic changes)
- `refactor`: Code refactoring (no feature/bug changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI/CD pipeline changes
- `chore`: Maintenance tasks

#### Scopes (optional):
- `service`: Backend API changes
- `website`: Frontend application changes
- `extension`: Browser extension changes
- `docker`: Docker/deployment changes
- `ci`: GitHub Actions workflows

#### Examples:
- `feat(website): add image toggle with archived state indicators`
- `fix(service): resolve JWT validation for extension uploads`
- `docs: add development workflow and semantic commit guidelines`
- `ci: split Docker workflows for efficient builds`
- `refactor(extension): migrate from JavaScript to TypeScript`

#### Benefits:
- **Clean main history**: Each commit represents a complete, tested change
- **Flexible development**: Normal commits during feature development
- **Automatic changelogs**: Semantic commits enable automated changelog generation
- **Clear change tracking**: Easy to identify types of changes in history

## Handling Degenerate Data Cases

When encountering unexpected data conditions (null values, empty arrays, divide by zero, etc.), **DO NOT** immediately add defensive code or edge case handling. Instead, **ALWAYS ASK** the user which of these three scenarios applies:

1. **Model Invariant Violation**: The data model guarantees this should never happen - this indicates a database integrity issue or model bug
2. **Integration Bug**: The model allows this state but there's a bug in how we're fetching/processing the data 
3. **Legitimate Edge Case**: The system must gracefully handle this degenerate case as part of normal operation

**Why this matters:**
- Code assistants typically default to option 3 (defensive coding) because it's prevalent in training data and gets to "done" quickly
- This often masks real bugs and creates unnecessary complexity
- Only by understanding the full system requirements and user expectations can we determine the correct approach

**Process:**
- When hitting unexpected data conditions, stop and ask the user which scenario applies
- Don't guess or add "safe" fallbacks without understanding the business requirements
- The user understands the product requirements and can guide the correct solution

**Example:**
Instead of: `if (!url) return 'No URL';`
Ask: "I'm seeing undefined URLs in search results. Should this be impossible (model bug), is there a data fetching issue, or do we need to handle missing URLs gracefully?"

## Form Field Design Philosophy

### Data Representation Consistency
- **Backend/API**: `null` represents "not set" throughout Python/PostgreSQL
- **Frontend data layer**: `null` represents "not set" in TypeScript models and services
- **UI components**: Convert between `null` and framework-expected values at the boundary

### Custom Form Components
All form fields use custom Morphic wrapper components (`morphic-text`, `morphic-select`, `morphic-radio`) that:
- Handle `null` ↔ HTML-expected value conversion at the presentation layer
- Provide a consistent API across all field types
- Create a clear abstraction boundary between Morphic logic and HTML behavior

### Required vs Optional Inputs
- Use Angular's `@Input({ required: true })` for truly required properties
- Fail fast with clear errors instead of silently accepting invalid states
- Examples:
  - `name` and `inputId` are required for form fields (accessibility and form submission)
  - `cssClass` is optional (styling enhancement)
- Never provide default values that mask missing required inputs

## Development Notes

- The website is built with modern Angular 20 and TypeScript
- Uses Angular CLI for development and build processes
- Bootstrap 5 for styling with standalone components architecture
- Backend uses Python 3 with modern Flask and SQLAlchemy
- Database migrations are manual via manage.py commands
- Git submodules must be updated when switching branches or pulling changes

## Current Development Status

### Completed Features
- **Authentication System**: User sign-in/sign-up with session management
- **Survey Builder**: Create surveys with text, select, radio, and location fields
- **Survey Preview**: Real-time preview of survey fields during creation
- **Search Management**: Create and manage search queries for surveys
- **Search Results**: View and interact with Google Images search results
- **Location Fields**: Interactive maps with intelligent search capabilities
- **Export System**: Export survey results to CSV format
- **Chrome Extension Integration**: Automated result gathering from Google Images with JWT-based upload authentication
- **Extension Detection**: Smart validation of extension installation and version with contextual messaging

### Survey System Architecture
- **Survey Creation**: Multi-step survey builder with field validation
- **Field Types**: Support for text, select (dropdown), radio buttons, and location
- **Location Picker**: Leaflet-based maps with Nominatim geocoding
  - Click-to-place markers
  - Drag-to-move functionality  
  - Intelligent omni-search (addresses, coordinates, place names)
  - Form integration via ControlValueAccessor
- **Data Services**: Proper service architecture for API interactions
- **Property Conversion**: Automatic snake_case ↔ camelCase via interceptor

### API Endpoints
- `GET /api/surveys/{id}/searches` - List searches for a survey
- `POST /api/surveys/{id}/searches` - Create new search
- `POST /api/searches/{id}/generate-upload-url` - Generate JWT-signed upload URL for Chrome extension
- `POST /api/upload-google-results` - Upload search results from Chrome extension (JWT authenticated)
- `GET /api/surveys/{id}/search_results` - Get search results with pagination/filtering
- `GET /api/surveys/{id}/tags` - Get available filter tags
- `GET /api/surveys/{id}/export-results` - Export results as CSV

### Chrome Extension Integration
- **Result Gathering**: Automated collection of Google Images search results
- **Authentication**: JWT-based upload tokens with HMAC signing for secure data transfer
- **Two-Phase Processing**: SearchResults created immediately, images processed by background worker
- **User Experience**: Centered modal overlay on Google search pages with real-time progress
- **Extension Detection**: Smart validation requiring v0.0.14 with browser compatibility checks
- **Smart Dismissal**: Extension warnings reset when installation status or version changes

### Current Branch: `main`
The project has completed its major frontend rewrite:
- **Legacy**: AngularJS 1.x (in `master` branch)  
- **Modern**: Angular 20 (in `main` branch) - **Current development branch**