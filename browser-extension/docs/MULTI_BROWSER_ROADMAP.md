# Multi-Browser Extension Roadmap

## Overview
Plan for shipping the Morphic extension on Chrome, Firefox, Edge and Safari from one codebase.

## Current State
- `src/shared/` holds all scraping, JWT and overlay logic and is browser-agnostic
- `src/chrome/` and `src/firefox/` hold only entry points and manifests
- `scripts/build.js` builds per browser (`--browser=chrome|firefox`) and packages per store (`--store=cws|amo`)
- Output lives under `dist/<browser>/<target>/`

## Firefox (built, pending end-to-end verification)
- [x] Manifest V3 with `browser_specific_settings.gecko` (fixed ID, min version 140, data collection declaration)
- [x] No background script. Firefox does not support `externally_connectable` for web pages, so the
      version check uses a handshake content script that writes the version to a data attribute on morphs.io
- [x] Website detects Firefox and reads the handshake attribute
- [x] Backend CORS allows `moz-extension://*`
- [x] Zip packaging and `web-ext lint` passes
- [ ] Verify Google Images serves the same markup to Firefox (the scraper depends on obfuscated class names)
- [ ] Confirm the install-time host permission prompt flow and surface a "permission denied" state on the website
- [ ] Decide between AMO listing and self-hosted signed xpi, then add an install URL to the website
- [ ] Review the `data_collection_permissions` declaration before AMO submission

## Edge
- Loads the Chrome build unchanged
- [ ] Stop excluding `edg/` user agents in the website's browser detection
- [ ] Microsoft Edge Add-ons listing

## Safari
- Safari 15.4+ supports `externally_connectable`, but the handshake content script approach avoids the
  team-ID-qualified extension ID and works unchanged
- [ ] Xcode wrapper app via `xcrun safari-web-extension-converter`
- [ ] Apple Developer Program membership and macOS build runner
- [ ] Mac App Store or notarized distribution, with per-site permission grant in Safari settings
- [ ] Verify Google Images markup and hover simulation in WebKit

## Possible Simplification
Chrome could adopt the handshake content script too. That would remove the background script and
`externally_connectable` from the Chrome build and leave a single detection path on the website.
This must wait for a Chrome extension release so the website keeps working with the installed base.

## Risk Assessment
- **Low**: shared scraping code and build system
- **Medium**: Google serving different markup per browser
- **High**: store submission and review (AMO signing requirements, Apple review)
