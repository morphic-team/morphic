# Multi-Browser Extension Roadmap

## Overview
This document outlines the plan to evolve the current Chrome extension into a cross-browser extension supporting Chrome, Firefox, and Edge.

## Current State
- Well-architected with good separation between browser-specific and shared code
- Core scraping logic is completely browser-agnostic ✅
- Professional build system that's easily extensible ✅
- TypeScript throughout with proper typing ✅
- Only Chrome-specific parts are entry points and external messaging ✅

## Phase 1: Foundation (Immediate)
### Project Restructure
- [ ] Rename `chrome-extension` → `browser-extension`
- [ ] Restructure directories:
  ```
  src/
  ├── browsers/
  │   ├── chrome/     (current src/chrome/)
  │   ├── firefox/    (new)
  │   └── edge/       (new)
  ├── shared/         (current src/shared/)
  └── assets/         (current src/assets/)
  ```

### Package Configuration
- [ ] Update `package.json`:
  - Name: `morphic-browser-extension`
  - Description: "Morphs.io Browser Extension for Chrome, Firefox, and Edge"
  - Scripts: `build:chrome`, `build:firefox`, `build:edge`, `build:all`
- [ ] Add dependencies:
  - `webextension-polyfill` for API compatibility
  - `@types/webextension-polyfill` for TypeScript support

### Build System Enhancement
- [ ] Extend build script to support multiple browsers:
  ```javascript
  const Browser = {
    CHROME: 'chrome',
    FIREFOX: 'firefox', 
    EDGE: 'edge'
  };
  ```
- [ ] Add browser-specific packaging:
  - Chrome: CRX with RSA signing
  - Firefox: XPI with web-ext tool
  - Edge: ZIP or APPX
- [ ] Dynamic file naming: `morphic-extension-v1.0.1-chrome.crx`

## Phase 2: Browser Abstraction
### API Compatibility Layer
- [ ] Create `src/shared/browser-api.ts`:
  ```typescript
  interface BrowserAPI {
    runtime: {
      getManifest(): any;
      onMessageExternal: any;
    };
  }
  ```
- [ ] Abstract Chrome-specific APIs:
  - `chrome.runtime.onMessageExternal` → cross-browser messaging
  - `chrome.runtime.getManifest()` → polyfilled version

### Manifest Strategy
- [ ] Create browser-specific manifests:
  - `src/browsers/chrome/manifest.json` (Manifest V3)
  - `src/browsers/firefox/manifest.json` (Manifest V2 initially)
  - `src/browsers/edge/manifest.json` (Manifest V3, Chrome-compatible)

## Phase 3: Firefox Support
### Firefox-Specific Requirements
- [ ] Manifest V2 structure:
  ```json
  {
    "manifest_version": 2,
    "applications": {
      "gecko": {
        "id": "morphic@morphs.io",
        "strict_min_version": "91.0"
      }
    }
  }
  ```
- [ ] External messaging compatibility testing
- [ ] XPI packaging with web-ext tool
- [ ] Firefox Add-ons (AMO) submission preparation

## Phase 4: Edge Support
### Edge-Specific Requirements
- [ ] Manifest V3 (Chrome-compatible)
- [ ] Microsoft Edge Add-ons store preparation
- [ ] APPX packaging if needed
- [ ] Edge-specific testing

## Technical Compatibility Analysis

### ✅ Already Browser-Agnostic
- DOM scraping logic (core functionality)
- Fetch API usage
- JWT token handling
- Overlay UI management
- TypeScript compilation

### ⚠️ Needs Abstraction
- External messaging API (`chrome.runtime.onMessageExternal`)
- Manifest structure and versioning
- Browser binary detection in build system
- Store-specific packaging

### 🔧 Hardcoded Chrome References to Update
- Build script messages: "Building Chrome Extension"
- Environment variables: `CHROME_BINARY`
- File naming: `morphic-chrome-extension`
- Comments: "Chrome-specific content script"

## Migration Strategy
1. **Start with Chrome compatibility** - ensure current functionality isn't broken
2. **Add Firefox as second browser** - largest API differences to solve first
3. **Edge last** - most Chrome-compatible, easiest to add

## Success Metrics
- [ ] Single codebase deploys to all three browsers
- [ ] No browser-specific code in shared modules
- [ ] Automated builds for all browsers
- [ ] Cross-browser external messaging works
- [ ] All browsers pass the same test suite

## Risk Assessment
- **Low Risk**: Core scraping functionality (already browser-agnostic)
- **Medium Risk**: External messaging compatibility across browsers
- **High Risk**: Store submission requirements and review processes

---

*This roadmap prioritizes maintaining the current high-quality Chrome extension while systematically adding multi-browser support.*