# Chrome Extension TODO

## Development Infrastructure

### 🔄 GitHub Actions CI
**Status**: Planned  
**Priority**: Medium  

Set up automated builds and testing:
- PR builds: dev artifacts, preview CRX, linting checks
- Main builds: Chrome Web Store release packages  
- Leverage existing npm scripts (no bash in CI)
- See [docs/GITHUB_ACTIONS_CI_PLAN.md](docs/GITHUB_ACTIONS_CI_PLAN.md) for detailed plan

## Future Enhancements

### 🔍 Enhanced URL Extraction
**Status**: Planned  
**Priority**: Medium  

Improve overall URL extraction robustness:
- Better handling of dynamic content loading
- Support for additional image formats
- Improved selector reliability as Google updates their UI

### 🌐 Multi-Browser Support
**Status**: Research Phase  
**Priority**: Medium  

Extend support beyond Chrome:
- Firefox WebExtensions API compatibility
- Edge browser support
- Safari Web Extension (pending feasibility study)
- Shared codebase with browser-specific adapters

## Notes

- For completed tasks and release history, see [CHANGELOG.md](./CHANGELOG.md)
- Priority levels: High (critical for production), Medium (nice to have), Low (future consideration)
- Status: Planned (not started), Research Phase (investigating feasibility), In Progress (actively working)