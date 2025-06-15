# GitHub Actions CI Plan for Browser Extension

## Overview

Set up automated builds and checks for the browser extension using GitHub Actions. The CI should leverage existing npm scripts rather than duplicating build logic.

## Workflow Strategy

### PR Workflow (Pull Request Builds)
**Trigger**: On pull request to any branch
**Purpose**: Validate changes, provide development artifacts

**Jobs**:
1. **Linting & Type Checking**
   - `npm run lint` - ESLint checks
   - `npm run type-check` (if available) - TypeScript validation
   
2. **Development Build**
   - `npm run build:chrome` - Create development build
   - Upload `dist/dev/` as artifact
   
3. **Preview Build** 
   - `npm run preview:cws` - Create preview CRX + unpacked
   - Upload `dist/preview/` as artifact (CRX and unpacked folder)

### Main Branch Workflow (Release Builds)
**Trigger**: Push to main branch (merged PRs)
**Purpose**: Create production-ready artifacts

**Jobs**:
1. **Release Build**
   - `npm run package:cws` - Create final Chrome Web Store package
   - Upload `dist/release/` as artifact (CRX without key field)
   
2. **Archive Artifacts**
   - Store release artifacts with commit SHA naming
   - Optionally create GitHub release with artifacts

## Implementation Notes

### Artifact Strategy
- **PR artifacts**: Available for 30 days for testing
- **Main artifacts**: Longer retention for releases
- **Naming**: Include commit SHA and build type (dev/preview/release)

### NPM Script Dependencies
Current scripts (from package.json):
- `npm run dev:chrome` - Development with hot reload
- `npm run build:chrome` - One-shot development build  
- `npm run preview:cws` - Preview build with CRX + unpacked
- `npm run package:cws` - Final release build

### Environment Setup
- Node.js version: Match package.json engines field
- Dependencies: `npm ci` for reproducible installs
- Caching: Cache node_modules for faster builds

### Security Considerations
- No secrets needed for public builds
- Extension key management handled by build scripts
- CRX signing uses build system logic

## Benefits

1. **Clean CI**: No bash scripts or build logic in workflows
2. **Maintainable**: Changes to build process only need npm script updates
3. **Testable**: Developers can reproduce CI builds locally
4. **Artifacts**: PR reviewers can test actual extension builds
5. **Release Ready**: Main builds produce Chrome Web Store packages

## File Structure
```
.github/
  workflows/
    browser-extension-pr.yml      # PR builds (dev, preview, linting)
    browser-extension-main.yml    # Main builds (CWS release)
```

## Future Enhancements
- Multi-browser builds (Firefox, Edge) when roadmap items are implemented
- Automated testing (if test scripts are added)
- Security scanning integration
- Release automation with version tagging