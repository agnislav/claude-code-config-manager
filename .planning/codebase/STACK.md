# Technology Stack — Claude Code Config Manager

## Language & Runtime

- **Language**: TypeScript (strict mode)
  - Target: ES2022
  - Module format: CommonJS (for Node.js extension environment)
  - Source maps enabled (dev), declaration files generated

- **Runtime**: Node.js
  - Runs within VS Code Extension Host environment
  - VS Code engine requirement: `^1.90.0` (January 2024 or later)

## Package Management

- **Package Manager**: npm
- **Main Entry Point**: `./dist/extension.js` (bundles to `esbuild`)

## Build Tools & Bundler

### esbuild (`^0.19.11`)
- Primary bundler configured in `esbuild.js`
- Configuration:
  - Entry point: `src/extension.ts`
  - Output: `dist/extension.js` (CommonJS format)
  - Bundle: enabled (self-contained single file)
  - Minification: enabled for production builds
  - Platform: Node.js
  - External dependencies: `vscode` (not bundled — provided by VS Code)
  - Source maps: enabled in dev, disabled in production

### TypeScript Compiler (`^5.3.3`)
- Type checking only: `tsc --noEmit`
- Configuration in `tsconfig.json`:
  - Strict mode enabled (no implicit any, strict null checks)
  - Output directory: `out/` (not used in production, serves type-checking)
  - Source maps enabled with declaration files
  - Module resolution: CommonJS
  - Library: ES2022
  - JSON module resolution enabled

### VS Code Extension Build

- **vsce** (`@vscode/vsce@^3.7.1`) — packages extension into `.vsix` format
- Build outputs:
  - `dist/extension.js` — compiled & bundled extension
  - `claude-code-config-manager-*.vsix` — installable extension package

## Development Tools

### Linting & Code Quality

- **ESLint** (`^8.56.0`) with TypeScript support
  - Parser: `@typescript-eslint/parser@^6.19.0`
  - Plugin: `@typescript-eslint/eslint-plugin@^6.19.0`
  - Rules: TypeScript recommended + custom (unused vars, no explicit any, throw literal, semi)
  - Config: `.eslintrc.json`

- **Prettier** (`^1.21.0` — via `.prettierrc`)
  - Single quotes
  - Trailing commas in all contexts
  - Print width: 100 characters
  - Tab width: 2 spaces
  - Semicolons enabled

### Testing

- **Mocha** (`^10.2.0`) — test runner
- **@vscode/test-electron** (`^2.3.8`) — VS Code extension testing harness
- **@types/mocha** (`^10.0.6`) — type definitions for Mocha

### Type Definitions

- `@types/node` (`^20.11.0`) — Node.js standard library types
- `@types/vscode` (`^1.90.0`) — VS Code API types (matches engine requirement)

### Utilities

- **glob** (`^10.3.10`) — file pattern matching (used in tests)

## Dependencies Summary

### Production (Runtime)
- **vscode** (not bundled — provided by VS Code) — VS Code API

### Development Only (All in `devDependencies`)
- TypeScript tooling: typescript, @types/node, @types/vscode
- Build: esbuild, @vscode/vsce
- Linting: eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin
- Testing: mocha, @vscode/test-electron, @types/mocha, glob

**Total dependencies: Zero production dependencies**
The extension is fully self-contained after bundling.

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | npm metadata, VS Code extension manifest (contributes section), scripts |
| `tsconfig.json` | TypeScript compiler options |
| `esbuild.js` | Bundler configuration |
| `.eslintrc.json` | ESLint rules and plugins |
| `.prettierrc` | Code formatter configuration |
| `schemas/claude-code-settings.schema.json` | JSON Schema for config validation (JSON Schema Draft-7) |

## Build & Packaging Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `compile` | `tsc --noEmit && node esbuild.js` | Type-check + bundle for development |
| `watch` | `node esbuild.js --watch` | Watch mode for live reloading during development |
| `build` | `node esbuild.js --production` | Minified production bundle |
| `typecheck` | `tsc --noEmit` | Type checking only (no output) |
| `lint` | `eslint src/ --ext .ts` | Code quality checks |
| `test` | `tsc -p tsconfig.test.json && node ./out/test/runTests.js` | Run test suite |
| `package` | `vsce package` | Build `.vsix` extension package |

## Version Information

- **Extension Version**: 0.3.1 (semantic versioning)
- **Node Target**: ES2022 (modern JavaScript features available)
- **Min VS Code**: 1.90.0 (January 2024)
