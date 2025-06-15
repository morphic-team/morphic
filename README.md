# Morphic

A comprehensive research platform for gathering and analyzing Google Images search results through automated Chrome extension integration.

## Overview

Morphic enables researchers to systematically collect Google Images search results for academic and research purposes. The platform combines a modern web interface, robust backend API, and intelligent Chrome extension to automate the traditionally manual process of search result collection.

## Architecture

Morphic is built as a multi-component application using git submodules:

### 🌐 **Website** (Angular 20)
- Modern TypeScript frontend with Bootstrap 5 styling
- Survey builder with text, select, radio, and location fields
- Interactive maps with Leaflet and OpenStreetMap
- Real-time search result management and export capabilities

### 🔧 **Backend** (Python Flask)
- REST API with SQLAlchemy ORM and PostgreSQL database
- JWT-based authentication and session management
- Background task processing for image downloads
- Secure upload endpoints for Chrome extension integration

### 🧩 **Chrome Extension** (Manifest V3)
- Automated Google Images result scraping
- JWT-authenticated data uploads
- Real-time progress tracking with modal overlays
- Professional build system with dev/preview/release workflows

### 📊 **Research Results**
- Data analysis tools and visualization scripts
- Statistical analysis with Python (regression, clustering)
- Interactive maps and heatmaps for geographic data
- Export capabilities for further research

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js and npm
- Python 3 (for service backend)
- Google Chrome with Developer Mode

### Setup

```bash
# Clone with submodules
git clone --recursive https://github.com/your-org/morphic.git
cd morphic

# Initialize submodules (if not cloned recursively)
git submodule init && git submodule update

# Start development environment
cp docker-compose.dev.override.yml docker-compose.override.yml
docker-compose up
```

### Development Servers

```bash
# Website (Angular) - http://localhost:4200
cd website && npm start

# Backend API - http://localhost:5000  
cd backend && python manage.py runserver

# Chrome Extension
cd chrome-extension && npm run dev:chrome
```

## Key Features

### ✅ **Completed Components**

- **User Authentication**: Secure sign-in/sign-up with session management
- **Survey System**: Create surveys with multiple field types and validation
- **Location Fields**: Interactive maps with intelligent geocoding search
- **Search Management**: Configure and track Google Images searches
- **Automated Collection**: Chrome extension gathers results automatically
- **Data Export**: Export survey results to CSV format
- **Extension Integration**: JWT-based secure communication between website and extension
- **Smart Validation**: Extension version checking with contextual messaging

### 🚀 **Technology Stack**

- **Frontend**: Angular 20, TypeScript, Bootstrap 5, Leaflet Maps
- **Backend**: Python 3, Flask 3.1, SQLAlchemy 2.0, PostgreSQL
- **Extension**: Chrome Manifest V3, JWT Authentication, Professional Build System
- **Deployment**: Docker, Docker Compose, Cloudflare Tunnels
- **Analysis**: Python data science tools, statistical analysis, interactive visualizations

## Project Structure

```
morphic/
├── website/                             # Angular 20 frontend
├── service/                             # Python Flask API  
├── browser-extension/                   # Browser extension (Manifest V3)
├── research/                            # Research tools and analysis
│   └── image-downloader/               # Image download analysis tools
├── docker-compose.yml                   # Production-ready Docker setup
├── docker-compose.dev.override.yml      # Development overrides
├── docker-compose.prod.override.yml     # Production overrides
├── secrets/                             # Environment configuration templates
└── docs/                               # Project documentation
```

## Development Workflow

### Chrome Extension (v1.0.0)

```bash
cd chrome-extension/

# Development with hot reload
npm run dev:chrome

# Test production build
npm run preview:cws  

# Release for Chrome Web Store
npm run package:cws
```

### Website Development

```bash
cd website/

# Development server
npm start

# Production build
npm run build
```

### Backend Development

```bash
cd backend/

# Database migrations
SQLALCHEMY_DATABASE_URI=postgresql://morphic@localhost/morphic FLASK_APP=manage:app flask db upgrade

# Background processing
python manage.py background_work
```

## Deployment

### Development
```bash
cp docker-compose.dev.override.yml docker-compose.override.yml
docker-compose up
```

### Production
```bash
cp docker-compose.prod.override.yml docker-compose.override.yml
docker-compose up
```

## Research Applications

Morphic is designed for researchers studying:
- Visual content trends and patterns
- Geographic distribution of image search results  
- Comparative analysis across different search queries
- Temporal changes in search result compositions
- Academic research requiring systematic image collection

## Contributing

1. Ensure all git submodules are updated: `git submodule update --recursive`
2. Follow existing code conventions and architecture patterns
3. Test changes across all components (website, backend, extension)
4. Update documentation for any new features or changes

## Documentation

- **[CLAUDE.md](CLAUDE.md)**: Comprehensive development guide and project instructions
- **[Chrome Extension README](chrome-extension/README.md)**: Extension build system and architecture
- **[Website Documentation](website/docs/)**: Frontend component guides
- **[Backend Documentation](backend/docs/)**: API documentation and data models

## License

See individual component LICENSE files for specific licensing terms.
