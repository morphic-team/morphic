# Morphic Chrome Extension

A Chrome Manifest V3 extension that automates gathering search results from Google Images for the Morphic research platform.

## Features

- **Automated Result Gathering**: Scrapes Google Images search results and uploads to Morphic
- **JWT Authentication**: Secure token-based communication with backend
- **Real-time Progress**: Modal overlay shows scraping progress on Google search pages
- **Extension Detection**: Smart validation and version checking from the Morphic website

## Quick Start

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev:chrome

# One-shot development build
npm run build:chrome

# Test production build (creates CRX + unpacked for testing)
npm run preview:cws

# Final release build for Chrome Web Store
npm run package:cws
```

## Build System

### Build Targets

- **`dev`**: Development build with localhost connectivity and stable extension ID
- **`preview`**: Production-identical CRX with extracted unpacked version for testing
- **`release`**: Final CRX ready for Chrome Web Store upload

### Directory Structure

```
chrome-extension/
├── src/                    # Source files
│   ├── chrome/            # Chrome-specific files
│   │   ├── manifest.json  # Extension manifest
│   │   ├── background.js  # Service worker
│   │   └── content.js     # Chrome content script
│   ├── shared/            # Browser-agnostic code
│   │   └── morphic-scraper.js  # Core scraping logic
│   └── assets/            # Images and resources
├── scripts/               # Build system
│   └── build.js          # Professional build script
├── .build/               # Temporary scratch directory (auto-cleaned)
├── dist/                 # Build outputs
│   ├── dev/             # Development build
│   ├── preview/         # Preview CRX + unpacked/
│   └── release/         # Final release CRX
├── package.json         # NPM configuration
├── public.pem           # Public key for Chrome Web Store
└── private.pem          # Private key for CRX signing (gitignored)
```

## Development Setup

### Prerequisites

- Node.js and npm
- Google Chrome
- Chrome Developer Mode enabled

### Environment Configuration

On macOS with Homebrew Chrome:

```bash
export CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

### Key Pair Generation

For verified CRX uploads, generate an RSA key pair:

```bash
# Generate private key
openssl genpkey -algorithm RSA -out private.pem -pkcs8 -pkeyopt rsa_keygen_bits:2048

# Extract public key
openssl rsa -pubout -in private.pem -out public.pem
```

**Important**: Upload `public.pem` to Chrome Web Store Developer Dashboard for verified uploads.

## Build Commands

### Development Workflow

```bash
# Start development with file watching
npm run dev:chrome

# Load unpacked extension from: dist/chrome/dev/
```

The dev build includes:
- Localhost connectivity for local website testing
- Extension key preserved for consistent extension ID
- Hot reload on file changes

### Testing Production Builds

```bash
# Create production-identical build for testing
npm run preview:cws

# Outputs:
# - dist/chrome/preview/morphic-chrome-extension-v1.1.0.crx (identical to release)
# - dist/chrome/preview/unpacked/ (for loading unpacked with stable ID)
```

### Release Builds

```bash
# Create final CRX for Chrome Web Store upload
npm run package:cws
# Output: dist/chrome/release/morphic-chrome-extension-v1.1.0.crx

# Create zip of the same Chrome build for Microsoft Edge Add-ons
npm run package:edge
# Output: dist/chrome/release/morphic-edge-extension-v1.1.0.zip
```

## Firefox

The same shared code builds a Firefox (Manifest V3) extension from `src/firefox/`.

### Differences from the Chrome build

- **Localhost**: Firefox match patterns cannot contain a port, so dev builds match `http://localhost/*`
  (any port) rather than `http://localhost:*/*`.
- **Host permission**: Firefox asks the user to grant access to google.com and morphs.io at install
  time. If declined, the content scripts never run.
- **Packaging**: a plain zip for addons.mozilla.org (AMO) instead of a signed CRX. There is no key
  field; the extension ID is fixed in `browser_specific_settings.gecko.id`.
- **Data collection**: AMO requires `data_collection_permissions` for new submissions. The manifest
  declares `websiteContent` because the extension sends scraped Google result URLs to morphs.io.

### Firefox Commands

```bash
npm run build:firefox   # Dev build -> dist/firefox/dev/
npm run dev:firefox     # Dev build with file watching
npm run lint:firefox    # Validate the dev build with web-ext lint
npm run run:firefox     # Launch Firefox with the dev build loaded (requires Firefox installed)
npm run preview:amo     # Zip + unpacked copy -> dist/firefox/preview/
npm run package:amo     # Release zip -> dist/firefox/release/
```

### Testing in Firefox

1. `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on**
3. Select `dist/firefox/dev/manifest.json`
4. Open (or reload) the Morphic website. The handshake script only runs on pages loaded after the
   add-on was installed, so reload any tab that was already open.
5. Run a search from the survey's searches page and watch the overlay on Google Images.

Temporary add-ons are removed when Firefox closes. Release Firefox only installs AMO-signed add-ons,
so distribution requires either an AMO listing or `web-ext sign` for a self-hosted xpi.

## Extension Architecture

### Core Components

- **Content Script**: Injected into Google search pages, handles scraping
- **Handshake Script**: Injected into the Morphic website, publishes the installed version
- **Shared Scraper**: Browser-agnostic scraping logic

### Communication Flow

1. User visits Morphic website, creates search with JWT token
2. Website generates signed upload URL and opens Google Images tab
3. Extension detects JWT in URL, starts scraping process
4. Modal overlay shows real-time progress
5. Results uploaded directly to backend via JWT-authenticated endpoint

### Version Management

- Version synced from `package.json` during build
- `handshake.js` runs on morphs.io at `document_start` and sets `data-morphic-extension-version`
  on the `<html>` element; the website reads it to validate the version before allowing searches
- Smart dismissal system resets warnings when version changes

## Security

- **JWT Authentication**: All uploads use signed tokens
- **CORS Protection**: Backend validates origin for cross-origin requests
- **Key Management**: Private keys excluded from source control
- **Signed CRX**: Production builds use RSA signatures

## Deployment

### Chrome Web Store

1. Build release CRX: `npm run package:cws`
2. Upload `dist/chrome/release/morphic-chrome-extension-v1.1.0.crx` to Chrome Web Store
3. Signed CRX provides verified upload proof

### Local Testing

1. Build preview: `npm run preview:cws`
2. Load unpacked from `dist/chrome/preview/unpacked/` in Chrome Developer Mode
3. Extension maintains consistent ID for testing

## Troubleshooting

### CRX Installation Issues

Chrome often blocks local CRX files. Use unpacked extension for testing:

```bash
npm run preview:cws
# Load unpacked from: dist/chrome/preview/unpacked/
```

### Chrome Binary Not Found

Set the Chrome binary path:

```bash
export CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# or for other platforms:
export CHROME_BINARY="google-chrome"  # Linux
export CHROME_BINARY="chrome.exe"     # Windows
```

### Version Mismatch

Ensure all components use the same version:
- `package.json` version (source of truth)
- Website `extension.service.ts` required version
- Build system syncs manifest version automatically

## License

See LICENSE file in the project root.
