# ⚠️ ARCHIVED: Morphic Website

**This repository has been archived and moved to the main Morphic monorepo.**

**🔗 New Location**: [morphic/website/](https://github.com/morphic-team/morphic/tree/main/website)

---

## Migration Notice

As of January 15, 2025, the Morphic Website has been:

- **Migrated** to the main Morphic monorepo at `morphic/website/`
- **Enhanced** with unified development workflow and deployment pipeline

### What Changed

- **New Location**: Development now happens in the [main Morphic repository](https://github.com/morphic-team/morphic)
- **New Path**: `website/` directory within the monorepo
- **Enhanced Features**: Unified tooling and cross-component coordination

### For Developers

To continue development:

1. Clone the main monorepo: `git clone git@github.com:morphic-team/morphic.git`
2. Navigate to: `cd morphic/website/`
3. Follow the updated documentation in the monorepo

### Why This Change

Moving to a monorepo provides:
- **Unified Development**: All Morphic components in one place
- **Better Coordination**: Easier cross-component changes
- **Simplified Deployment**: Streamlined CI/CD and release management
- **Improved Developer Experience**: Single clone, unified tooling

---

## Legacy Information

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.8.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Architecture Decisions

### Form Field Components

The application uses custom form field wrapper components (`morphic-text`, `morphic-select`, `morphic-radio`) instead of native HTML form elements. This design provides:

1. **Consistent null handling**: All fields use `null` to represent "not set" in the data layer, with conversion to HTML-expected values (empty string, undefined) happening only at the component boundary
2. **Clear API contracts**: Required inputs use Angular's `@Input({ required: true })` to fail fast with clear errors
3. **Future extensibility**: Custom components can be enhanced with validation, tooltips, error states, etc.

This approach maintains data consistency throughout the application stack while properly handling the impedance mismatch between TypeScript/database representations and HTML form behavior.
