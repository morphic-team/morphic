# Changelog

All notable changes to the Morphic project infrastructure, deployment, and architecture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-06-16

### Added
- **Website Changelog Viewer**: Added changelog viewing feature to the website
  - Build-time processing of all component changelog markdown files to JSON
  - Public-facing changelog page accessible via navbar
  - Displays main project changelog with proper markdown rendering (links, bold text, code)
  - Integrated into Angular navigation between Instructions and Privacy

## [1.0.1] - 2025-06-15

### Added
- **Main Repository Changelog**: Added project-level changelog to track infrastructure and architectural changes
- **GitHub Container Registry**: Configured GHCR for automated Docker image builds
  - `ghcr.io/morphic-team/morphic-service:latest` for Python Flask API and worker
  - `ghcr.io/morphic-team/morphic-website:latest` for Angular frontend
- **CI/CD Pipeline**: GitHub Actions workflows for automated builds
  - Separate workflows for service and website builds
  - Builds only trigger when relevant files change
  - BuildKit cache optimization for faster builds
- **Secrets Management**: Structured approach to environment configuration
  - Sample files for all required environment variables
  - Clear separation between development and production configs

### Changed
- **Monorepo Architecture**: Completed migration from git submodules to unified repository
  - `backend/` → `service/` (Python Flask API)
  - `chrome-extension/` → `browser-extension/` (Manifest V3 extension)
  - `website/` integrated directly into monorepo
  - `research-results/` → `research/image-downloader/` (analysis tools)
- **Docker Compose Modernization**: Production-ready deployment configuration
  - Removed legacy `ops/` directory structure
  - Implemented override pattern for dev/prod environments
  - `docker-compose.yml`: Production defaults with tagged images
  - `docker-compose.dev.override.yml`: Development builds with local source
  - `docker-compose.prod.override.yml`: Production services (cloudflared)
- **Service Naming**: Consistent container and service naming
  - `backend` → `service` (API service)
  - `background_work` → `service-worker` (background processor)
  - All containers use `morphic-*` naming pattern

### Fixed
- **Cross-Component Security**: Enhanced JWT validation across service and browser extension
  - Consistent audience (`morphic-browser-extension`) and issuer (`morphic-api`) claims
  - Resolved 403 authentication errors in extension upload workflow

### Removed
- **Git Submodules**: Eliminated submodule complexity and dependency management issues
- **Legacy Build System**: Removed `ops/` directory in favor of root-level Docker configuration

## [1.0.0] - 2025-01-15

### Added
- **Initial Infrastructure**: Production-ready deployment architecture
  - Docker Compose orchestration for multi-service application
  - PostgreSQL database with persistent volumes
  - Cloudflare tunnel integration for secure public access
  - NGINX reverse proxy for static file serving

### Security
- **JWT Authentication**: Secure token-based authentication between components
- **Environment Isolation**: Proper secrets management and environment separation
- **Container Security**: Non-root users and minimal attack surface