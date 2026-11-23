import { availableParallelism } from 'os';
import path from 'path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import Sonda from 'sonda/vite';
import { defineConfig } from 'vite';
import { defaultExclude } from 'vitest/config';

import { buildChunks, collectSharedModules } from './scripts/vite/chunks.js';
import { getAppLocales, getDayjsLocales, yamlToJS } from './scripts/vite/locales.js';
import { buildNpm } from './scripts/vite/npm-build.js';
import { copyPackageFiles, generateExtraFiles } from './scripts/vite/package-files.js';
import { bundleSchema } from './scripts/vite/schema.js';
import { bundleMimeTypes, bundlePackageInfo } from './scripts/vite/virtual-modules.js';
import svelteConfig from './svelte.config.js';

/**
 * Glob matching the component tests. A component test is written next to the `.svelte` file it
 * tests, with a `.svelte.test.js` suffix so it can use runes, and runs in a real browser: the
 * `@sveltia/ui` components rely on layout, focus and popovers, which a simulated DOM can’t provide.
 * Everything else runs in Node, or in happy-dom with a `@vitest-environment` comment.
 */
const COMPONENT_TESTS = 'src/lib/components/**/*.svelte.test.js';
/**
 * Files Vitest doesn’t run: the worktrees, and the end-to-end tests, which Playwright runs against
 * the built bundle. See `e2e/playwright.config.js`.
 */
const TEST_EXCLUDE = [...defaultExclude, '.claude/**', 'e2e/**'];
/**
 * Number of browser tabs the component tests run in parallel. Vitest defaults to one tab per core,
 * and a tab holds on to the memory of every file it has run — the whole suite costs about 600 MB
 * per tab on top of a gigabyte of browser — so on a machine with many cores the run alone takes
 * several gigabytes, and a second one beside it, from another worktree or an editor, pushes the
 * machine into swap. Six tabs cost the run about fifteen percent of its time and save a fifth of
 * that memory. A CI runner has fewer cores than the cap and is left alone.
 */
const BROWSER_WORKERS = Math.max(Math.min(availableParallelism() - 1, 6), 1);

/**
 * Module resolution options shared by the CDN builds and the npm build.
 */
const SHARED_RESOLVE = {
  alias: {
    $lib: path.resolve('./src/lib/'),
  },
  extensions: ['.js', '.svelte'],
};

/**
 * Global constants shared by the CDN builds and the npm build.
 */
const SHARED_DEFINE = {
  'import.meta.env.VITE_APP_LOCALES': JSON.stringify(getAppLocales().join(',')),
  'import.meta.env.VITE_DAYJS_LOCALES': JSON.stringify(getDayjsLocales().join(',')),
};

/**
 * Get the plugins processing the source, shared by the CDN builds and the npm build. A new instance
 * of each is needed per build.
 * @param {object} [options] Options.
 * @param {boolean} [options.cdn] Whether the plugins are for the CDN builds.
 * @returns {import('vite').PluginOption[]} Plugins.
 */
const getSharedPlugins = ({ cdn = false } = {}) => [
  yamlToJS(),
  svelte({
    ...svelteConfig,
    emitCss: false,
  }),
  bundleSchema(),
  bundlePackageInfo(),
  bundleMimeTypes(),
  collectSharedModules({ enabled: cdn }),
];

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    ...SHARED_RESOLVE,
    // Vitest doesn’t use the `browser` condition by default, so the `svelte` package would resolve
    // to its server build even in the `happy-dom` environment, while the `.svelte.js` modules are
    // compiled for the client there. Runtime functions like `untrack()` and `flushSync()` would
    // then come from a different runtime than the one the compiled modules use, and wouldn’t work.
    // The list replaces Vite’s defaults rather than extending them, so spell out the full client
    // set to keep the other packages resolving as they do in the app
    ...(process.env.VITEST ? { conditions: ['module', 'browser', 'development|production'] } : {}),
  },
  optimizeDeps: {
    // The `strings` export of Sveltia UI collects the package’s locale files with
    // `import.meta.glob()`, which only works when Vite processes the module itself. Pre-bundling
    // would leave the object empty, and every UI string would show up as a raw `_sui.*` key in
    // development. Production is unaffected: the default locale is imported from the YAML file
    // directly, and the other locales are fetched from the CDN
    exclude: ['@sveltia/ui'],
    // Pre-bundle the packages the component tests only get to late in a run, or Vite discovers
    // them mid-run and reloads the browser, failing whatever tests are loading at that moment
    include: ['create-react-class', 'htm'],
  },
  define: {
    ...SHARED_DEFINE,
    // Vitest would expose the value as a string, and `'false'` is truthy
    ...(process.env.VITEST ? {} : { 'import.meta.env.NPM_BUILD': 'false' }),
  },
  build: {
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
    sourcemap: true,
    rolldownOptions: {
      // Output JavaScript only
      input: 'src/lib/main.js',
      output: [
        {
          entryFileNames: 'sveltia-cms.js',
          format: 'iife',
          comments: {
            legal: true,
          },
        },
        {
          entryFileNames: 'sveltia-cms.mjs',
          format: 'es',
          comments: {
            legal: true,
          },
        },
      ],
      // Keep exports in the ES module
      // https://stackoverflow.com/q/71500190
      preserveEntrySignatures: 'strict',
      // Inline every imported constant, not only those in conditions, which saves about 1 KB of
      // the compressed bundle though the raw size grows slightly
      optimization: {
        inlineConst: { mode: 'all', pass: 2 },
      },
      experimental: {
        // Skip compiling the unused modules a barrel file re-exports
        lazyBarrel: true,
      },
      // Silence some warnings that are not relevant to our use case
      checks: {
        // `import.meta` becomes `{}` in the IIFE build. The only use of ours, `import.meta.url` in
        // `dependencies.js`, expects that, and Vite’s preload helper, the other source, is
        // tree-shaken away because an IIFE has no chunks to preload
        emptyImportMeta: false,
        missingNameOptionForIifeExport: false,
        mixedExports: false,
        pluginTimings: false,
      },
    },
    outDir: 'package/dist',
  },
  plugins: [
    ...getSharedPlugins({ cdn: true }),
    copyPackageFiles(),
    generateExtraFiles(),
    buildChunks({ resolve: SHARED_RESOLVE }),
    buildNpm({
      resolve: SHARED_RESOLVE,
      define: SHARED_DEFINE,
      plugins: getSharedPlugins,
      locales: getAppLocales(),
    }),
    // https://sonda.dev/configuration.html
    Sonda({
      enabled: false,
      brotli: true,
      gzip: true,
      exclude: [/\.mjs$/],
    }),
  ],
  test: {
    exclude: TEST_EXCLUDE,
    // Coverage is collected from the `unit` project only, see `test:unit:coverage` in
    // `package.json`. The component tests don’t add to it, and a module that both projects load
    // gets a different branch map from each, as Svelte compiles a `.svelte.js` file differently for
    // the browser, so merging the two reports would count the same branch twice. The `.svelte`
    // components are measured separately by `test:components:coverage`, which overrides `include`
    // and lowers the branch threshold: the Svelte compiler inserts a `?? ''` for every text or
    // class interpolation mixed with static text, and those branches can neither be reached nor
    // annotated, so the components are held at the figure they reach with everything else covered
    coverage: {
      include: ['src/lib/{components,services}/**/*.js'],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    env: {
      TZ: 'UTC',
    },
    silent: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [...TEST_EXCLUDE, COMPONENT_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: [COMPONENT_TESTS],
          maxWorkers: BROWSER_WORKERS,
          // A group runs with a single `maxWorkers`, so the project needs its own when `unit` runs
          // beside it with the default of one worker per core
          sequence: { groupOrder: 1 },
          setupFiles: ['./vitest.browser.setup.js'],
          // `expect.element()` and `expect.poll()` retry for a second by default, which a shared
          // CI runner can’t always keep up with: a Sveltia UI dialog only reports its result once
          // its closing transition has finished, a list renders its rows one tick at a time, and a
          // syntax grammar is loaded on demand. A failure is a real one, so it’s worth the wait
          expect: { poll: { timeout: 5000 } },
          browser: {
            enabled: true,
            headless: true,
            // Pin the time zone and language like the `env` option above does for Node, so a
            // date or number is formatted the same wherever the tests run
            provider: playwright({ contextOptions: { timezoneId: 'UTC', locale: 'en-US' } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
