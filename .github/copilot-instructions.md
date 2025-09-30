# Copilot Instructions: Sveltia CMS

## Repository Overview

**Sveltia CMS** is a modern, Git-based headless content management system built as a drop-in replacement for Netlify/Decap CMS. The project is written in Svelte 5 with JavaScript and TypeScript definitions, using Vite as the build tool and Vitest for testing.

**Key Details:**
- **Size**: ~800 source files, 170+ test files, 2748+ tests
- **Languages**: JavaScript (ES2022), Svelte 5, SCSS/CSS, HTML
- **Target Runtime**: Browser (IIFE and ES modules)
- **Package Manager**: **pnpm only** (npm will cause issues)
- **Node Version**: v24 (see `.nvmrc`)
- **Bundle Output**: Distributable CMS that loads in browsers via CDN or npm

## Build & Development Commands

### Prerequisites
**CRITICAL**: Always use `pnpm` - npm will not work correctly with this project.

```bash
# Install pnpm if not available
npm install -g pnpm@latest

# Install dependencies (always run first)
pnpm install
```

### Core Development Commands

```bash
# Development server with hot reload
pnpm dev

# Production build (creates package/dist/ directory)
pnpm build

# Watch build for development
pnpm build:watch

# Preview production build
pnpm preview
```

### Quality Assurance Commands

```bash
# Run ALL checks (recommended before committing)
pnpm check

# Individual checks
pnpm check:eslint    # ESLint (JavaScript/Svelte linting)
pnpm check:prettier  # Code formatting
pnpm check:stylelint # CSS/SCSS linting  
pnpm check:svelte    # Svelte compiler checks
pnpm check:oxlint    # Additional fast linting
pnpm check:cspell    # Spell checking
pnpm check:imports   # Unused import detection
pnpm check:audit     # Security audit

# Testing
pnpm test            # Run all tests
pnpm test:watch      # Watch mode testing
pnpm test:coverage   # Test coverage report

# Code formatting
pnpm format          # Auto-fix Prettier formatting
```

### Build Timing
- `pnpm install`: ~25-30 seconds
- `pnpm check`: ~30-45 seconds 
- `pnpm test`: ~30 seconds (2748 tests)
- `pnpm build`: ~15-20 seconds

### Common Issues & Solutions

**pnpm not found**: Install with `npm install -g pnpm@latest`

**Build failures**: Always run `pnpm install` first after any `package.json` changes

**Import errors**: Use the custom `find-unused-imports.js` script via `pnpm check:imports` - it's more accurate than standard tools for this project

**Svelte 5 compatibility**: This project uses Svelte 5 with runes - ensure any Svelte code follows the new syntax patterns

## Project Architecture & Layout

### Source Structure
```
src/lib/
├── components/          # Svelte UI components
│   ├── app.svelte      # Main app component  
│   ├── assets/         # Asset management UI
│   ├── contents/       # Content editing UI
│   └── ...
├── services/           # Business logic & data services
│   ├── app/           # Core app services
│   ├── assets/        # Asset management
│   ├── backends/      # Git backend integrations (GitHub, GitLab, Gitea)
│   ├── config/        # CMS configuration handling
│   ├── contents/      # Content & collection management
│   ├── integrations/  # External service integrations
│   ├── user/          # User authentication & preferences
│   └── utils/         # Utility functions
├── types/             # TypeScript type definitions
├── locales/           # Internationalization files
└── main.js            # Entry point
```

### Key Configuration Files
- `vite.config.js`: Build configuration with custom plugins
- `svelte.config.js`: Svelte 5 with runes enabled
- `jsconfig.json`: JavaScript & path mapping (`$lib/*`)
- `.eslintrc.yaml`: Comprehensive ESLint rules with Svelte plugin
- `.prettierrc.yaml`: Code formatting (single quotes, trailing commas)
- `.stylelintrc.yaml`: SCSS/CSS linting rules
- `package.json`: Scripts and dependencies
- `.nvmrc`: Node v24 requirement

### Build Output
- `package/dist/sveltia-cms.js`: IIFE bundle for browser `<script>` tag
- `package/dist/sveltia-cms.mjs`: ES module for npm consumers
- `package/`: Complete npm package directory with types

## GitHub CI/CD Pipeline

**Workflow**: `.github/workflows/tests.yml`
- **Triggers**: Every push to any branch
- **Jobs**: Check, Test, Build (run in parallel matrix)
- **Node**: Uses `.nvmrc` version (v24)
- **Package Manager**: pnpm with cache
- **Steps**: checkout → setup → install → run task

**Validation Steps for PRs:**
1. All ESLint rules pass (strict Airbnb config + Svelte rules)
2. Prettier formatting enforced
3. All 2748+ tests pass
4. Svelte compiler checks pass
5. Production build succeeds
6. No unused imports (custom script validation)

## Development Guidelines

### Code Style
- **Quotes**: Single quotes for JavaScript, double for YAML/CSS
- **Line Length**: 100 characters max
- **Trailing Commas**: Always use
- **Import Sorting**: Automatic via ESLint (builtin → external → internal → $lib)

### Testing
- **Framework**: Vitest with coverage reporting
- **Location**: Co-located `*.test.js` files
- **Coverage**: Focuses on `src/lib/{components,services}/**/*.js`
- **Standards**: 2748+ tests must continue passing

### File Patterns
- **Components**: `*.svelte` files in `src/lib/components/`
- **Services**: `*.js` files in `src/lib/services/`
- **Tests**: `*.test.js` files alongside source
- **Types**: `*.d.ts` files for TypeScript definitions

### Import Path Conventions
```javascript
// External packages
import { get } from 'svelte/store';

// Internal with $lib alias
import { siteConfig } from '$lib/services/config';
import Button from '$lib/components/common/button.svelte';
```

### Making Changes

1. **Always run `pnpm install` first**
2. **Use `pnpm check` before committing** - fixes many issues automatically
3. **Run tests frequently**: `pnpm test` or `pnpm test:watch` 
4. **Follow existing patterns** - this codebase has consistent conventions
5. **Test in browser**: Use `pnpm dev` to verify UI changes work correctly

### Special Notes
- **React compatibility**: This project includes React types for CMS integration APIs
- **Svelte 5**: Uses new runes syntax - avoid legacy Svelte patterns
- **Bundle size**: Watch for large dependencies - final bundle should stay under 1.5MB
- **Browser support**: Targets modern browsers (ES2022)
- **CMS Domain**: Understanding of headless CMS concepts helpful for meaningful contributions

**Trust these instructions** - they are validated against the current codebase. Only search for additional information if these instructions are incomplete or incorrect.