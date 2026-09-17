# Sveltia CMS

Modern, Git-based headless CMS, drop-in replacement for Netlify/Decap CMS. Svelte 5 (runes) with JavaScript, Vite 8, Vitest 5. ~840 source files, 380 test files, 9,300+ tests. Ships as a browser bundle (IIFE + ES module), loaded via CDN or npm.

## Setup

- **pnpm only** — npm will not work correctly with this project.
- Node v26 (see `.nvmrc`).
- Run `pnpm install` first, and again after any `package.json` change.
- Run `pnpm exec playwright install chromium` once for the component tests, which run in a real browser.

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

pnpm test                      # unit + component tests
pnpm test:unit                 # Vitest `unit` project: Node (or jsdom) tests
pnpm test:unit:coverage        # unit tests with coverage of the `.js` files
pnpm test:components           # Vitest `browser` project: component tests in headless Chromium
pnpm test:components:coverage  # component tests with coverage of the `.svelte` files

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

`.github/workflows/tests.yml` runs on every push: Check, Test (three unit test shards and three component test shards, the latter with Chromium), Build in parallel, using `.nvmrc` Node version and pnpm. A PR must pass ESLint, Prettier, all tests, Svelte compiler checks, the production build, and the unused-imports check.

## Conventions

- Style: Airbnb JS guide + project overrides in `eslint.config.js`. Single quotes in JS, double quotes in YAML/CSS. 100-char line length. Trailing commas always. Import order (builtin → external → internal → `$lib`) is enforced by ESLint.
- Types: JSDoc comments (TypeScript-flavoured), centralized in `src/types/*.js`, imported via `@import`.
- Svelte 5: runes syntax only — no legacy Svelte patterns. Use the Svelte MCP server / `svelte-file-editor` agent for any `.svelte` or `.svelte.js`/`.svelte.ts` work.
- Prose: Canadian English in Markdown, American English in code/comments. Curly quotes in prose, straight quotes in source, backticks for inline code.
- Tests: Vitest, co-located `*.test.js` files. Coverage tracked for `src/lib/{components,services}/**/*.js` from the `unit` project; `pnpm test:unit:coverage` enforces 100% on every metric. Use `sed` to spot uncovered lines in coverage reports. `clearMocks` defaults to `true`, so calls a mock records while its module is imported are cleared before the first test runs — capture those arguments in a `vi.hoisted()` variable rather than reading `mock.calls`.
- Component tests: `src/lib/components/**/*.svelte.test.js`, next to the `.svelte` file, run in headless Chromium (Vitest Browser Mode, `vitest-browser-svelte`). Render with `await render(Component, props)` or `render(Component, { props, context })`; query with `page.getByRole()` and `await expect.element()`, which retry for up to 5 s (`expect.poll.timeout` in `vite.config.js`; don’t pass a shorter one — a Sveltia UI dialog only reports its result once its closing transition has finished, which a loaded CI runner takes a while over); interact with the locators or `userEvent` from `vitest/browser`. A `.svelte.test.js` file can use runes: pass a `$state` props object to test a bindable prop in both directions, and `createRawSnippet()` for a snippet prop. `vitest.browser.setup.js` loads the `en-US` strings, so query by the text a user sees, not by message key. `toHaveTextContent()` matches the whole text of an element; use `toMatchTextContent()` for a substring or a regular expression. `initTestConfig()` clears the collection and field caches, so a test file can load another configuration, but a root effect reacting to a new `selectedCollection.current` runs after the test continues — call `flushSync()` before `setReorderMode()` or anything else the effect would undo. An interpolated value comes wrapped in bidi isolates, which are written as `\u2068…\u2069` escapes in an assertion — never as the literal characters, which GitHub flags as hidden Unicode. Before testing a component, extract the logic in it to a service module where it can be unit-tested; the component test then covers what’s left — markup, ARIA, bindings and events. `pnpm test:components:coverage` measures the `.svelte` files and enforces the thresholds: statements, functions and lines at 100%, branches at 98.4%. Branches can’t reach 100%: Svelte compiles `text {value}` interpolations and `class="x {y}"` to `${y ?? ''}`, whose fallback never runs, and there is no way to annotate markup — every other branch is covered or annotated, so a drop below the threshold is a real gap. For a defensive guard in a `<script>` block that a test can’t reach, use `/* v8 ignore next N -- reason */` — the hint works in `.svelte` files, but only right before a statement, not inside a method chain or a `try` block, and not with a JSDoc block in between: put `/* v8 ignore start */` … `/* v8 ignore stop */` around a documented function or a `$derived()` declaration instead, JSDoc included, or ESLint inserts an empty JSDoc stub. A branch in markup that can’t be reached is moved into a `<script>` helper or `$derived()` where it can be annotated, or simplified away: a fallback for a value the draft always has is a cast, not a `??`. Many `$derived()` fallbacks are unreachable because the value is only read while the component is rendered, e.g. within `{#if entryDraft.current}`; annotate those with the reason. A Sveltia UI `Toast` writes `show` back after a few seconds, so a test that shows one waits for it with `waitForToastsToHide()` from `$lib/test/toast`.
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
