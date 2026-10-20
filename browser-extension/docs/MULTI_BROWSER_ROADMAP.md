# Multi-Browser Extension Roadmap

## Overview
Plan for shipping the Morphic extension on Chrome, Firefox, Edge and Safari from one codebase.

## Current State
- `src/shared/` holds all scraping, JWT and overlay logic and is browser-agnostic
- `src/chrome/` and `src/firefox/` hold only entry points and manifests
- Every build carries a handshake content script that publishes the installed version to the website
- `scripts/build.js` builds per browser (`--browser=chrome|firefox`) and packages per store (`--store=cws|edge|amo`)
- Output lives under `dist/<browser>/<target>/`

## Firefox
- [x] Manifest V3 with `browser_specific_settings.gecko` (fixed ID, min version 140, data collection declaration)
- [x] Website detects Firefox and reads the handshake attribute
- [x] Backend CORS allows `moz-extension://*`
- [x] Zip packaging and `web-ext lint` passes
- [x] Google Images serves the same markup to Firefox
- [ ] Confirm the install-time host permission prompt flow and surface a "permission denied" state on the website
- [ ] Decide between AMO listing and self-hosted signed xpi, then add the store URL to the website
- [ ] Review the `data_collection_permissions` declaration before AMO submission

## Edge
- [x] Loads the Chrome build unchanged, zipped by `package:edge`
- [x] Website detects Edge and reads the handshake attribute
- [ ] Microsoft Edge Add-ons listing, then add the store URL to the website

## Safari
- Safari 15.4+ supports `externally_connectable`, but the handshake content script approach avoids the
  team-ID-qualified extension ID and works unchanged
- [ ] Xcode wrapper app via `xcrun safari-web-extension-converter`
- [ ] Apple Developer Program membership and macOS build runner
- [ ] Mac App Store or notarized distribution, with per-site permission grant in Safari settings
- [ ] Verify Google Images markup and hover simulation in WebKit

## Risk Assessment
- **Low**: shared scraping code and build system
- **Medium**: Google serving different markup per browser
- **High**: store submission and review (AMO signing requirements, Apple review)
