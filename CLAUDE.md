# Sveltia CMS

Modern, Git-based headless CMS, drop-in replacement for Netlify/Decap CMS. Svelte 5 (runes) with JavaScript, Vite 8, Vitest 4. ~710 source files, 255 test files, 7,200+ tests. Ships as a browser bundle (IIFE + ES module), loaded via CDN or npm.

## Setup

- **pnpm only** — npm will not work correctly with this project.
- Node v26 (see `.nvmrc`).
- Run `pnpm install` first, and again after any `package.json` change.

## Commands

```bash
pnpm dev              # dev server with hot reload
pnpm build            # production build -> package/dist/
pnpm build:watch
pnpm preview

pnpm check            # run all checks below — do this before committing
pnpm check:eslint
pnpm check:prettier
pnpm check:stylelint
pnpm check:svelte
pnpm check:oxlint
pnpm check:cspell
pnpm check:imports    # custom script, more accurate than standard unused-import tools
pnpm check:audit

pnpm test
pnpm test:coverage

pnpm format           # auto-fix Prettier formatting
```

## Architecture

```
src/lib/
├── components/        # Svelte UI (app.svelte is the root component)
│   ├── assets/        # asset management UI
│   └── contents/      # content editing UI
├── services/          # business logic & data
│   ├── app/           # core app services
│   ├── assets/
│   ├── api/           # api client wrappers
│   ├── backends/      # GitHub/GitLab/Gitea integrations
│   ├── config/        # CMS config handling
│   ├── contents/      # content & collection management
│   ├── integrations/  # external services
│   ├── search/        # content search
│   ├── user/          # auth & preferences
│   └── utils/
├── types/             # JSDoc/TS type definitions
├── locales/           # i18n
└── main.js            # entry point
```

Key config: `vite.config.js`, `svelte.config.js` (runes enabled), `jsconfig.json` (`$lib/*` alias), `eslint.config.js` (flat config, Airbnb + Svelte), `.prettierrc.yaml`, `.stylelintrc.yaml`.

Build output: `package/dist/sveltia-cms.js` (IIFE), `package/dist/sveltia-cms.mjs` (ESM), full npm package in `package/`.

## CI

`.github/workflows/tests.yml` runs on every push: Check, Test, Build in parallel, using `.nvmrc` Node version and pnpm. A PR must pass ESLint, Prettier, all tests, Svelte compiler checks, the production build, and the unused-imports check.

## Conventions

- Style: Airbnb JS guide + project overrides in `eslint.config.js`. Single quotes in JS, double quotes in YAML/CSS. 100-char line length. Trailing commas always. Import order (builtin → external → internal → `$lib`) is enforced by ESLint.
- Types: JSDoc comments (TypeScript-flavoured), centralized in `src/types/*.js`, imported via `@import`.
- Svelte 5: runes syntax only — no legacy Svelte patterns. Use the Svelte MCP server / `svelte-file-editor` agent for any `.svelte` or `.svelte.js`/`.svelte.ts` work.
- Prose: Canadian English in Markdown, American English in code/comments. Curly quotes in prose, straight quotes in source, backticks for inline code.
- Tests: Vitest, co-located `*.test.js` files. Coverage tracked for `src/lib/{components,services}/**/*.js`; keep it at 100%. Use `sed` to spot uncovered lines in coverage reports.
- Target: modern browsers (ES2025).

```javascript
// import order
import { get } from 'svelte/store'; // external

import { cmsConfig } from '$lib/services/config'; // internal, $lib alias
import Button from '$lib/components/common/button.svelte';

/**
 * @import { CmsConfig } from '$lib/types/public';
 */
```
