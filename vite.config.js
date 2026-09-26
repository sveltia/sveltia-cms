import { exec } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { appendFile, cp, mkdir, readFile, writeFile } from 'fs/promises';
import { availableParallelism } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { isObject } from '@sveltia/utils/object';
import { playwright } from '@vitest/browser-playwright';
import React from 'react';
import Sonda from 'sonda/vite';
import { createGenerator } from 'ts-json-schema-generator';
import { build, defineConfig } from 'vite';
import { defaultExclude } from 'vitest/config';
import { parse as parseYAML } from 'yaml';

import { buildNpm, getNpmDependencies } from './scripts/npm-build.js';
import { SHARED_REACT_KEY } from './src/lib/chunks/constants.js';
// eslint-disable-next-line import-x/no-useless-path-segments
import { BUILTIN_FIELD_TYPES } from './src/lib/services/contents/fields/index.js';
import svelteConfig from './svelte.config.js';

/**
 * Packages whose types the generated `d.ts` files import. Those that aren’t dependencies of the npm
 * build are listed in the published `package.json` as optional peer dependencies: their code is
 * bundled, so only a TypeScript user needs them, and a package manager never installs the dev
 * dependencies of a dependency.
 */
const TYPE_DEPENDENCIES = ['@types/react', 'immutable'];
/**
 * Path to the generated main type declaration file.
 */
const MAIN_TYPE_PATH = 'package/main.d.ts';
/**
 * Path to the generated public type declaration file.
 */
const PUBLIC_TYPE_PATH = 'package/types/public.d.ts';
/**
 * Path to the generated JSON schema for the CMS configuration.
 */
const SCHEMA_PATH = 'package/schema/sveltia-cms.json';
/**
 * Path to the app’s locale files.
 */
const APP_LOCALES_DIR = 'src/lib/locales';
/**
 * Path to the generated locale files.
 */
const OUTPUT_LOCALES_DIR = 'package/locales';

/**
 * Get the list of the app’s locales based on the file names in the locales directory. The list is
 * injected into the bundle as `import.meta.env.VITE_APP_LOCALES` so that the app can register all
 * the available locales without bundling their strings. It’s sorted because `readdirSync()` returns
 * entries in a filesystem-dependent order, which would otherwise let the same source tree produce
 * different bundles on different build hosts.
 * @returns {string[]} Locale codes, e.g. `['en-US', 'ja']`.
 */
const getAppLocales = () =>
  readdirSync(APP_LOCALES_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => path.basename(name, '.yaml'))
    .sort();

/**
 * Recursively squash multiline strings in a parsed YAML object into single lines.
 * @param {unknown} value The value to process.
 * @returns {unknown} The processed value.
 */
const squashStrings = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(/\s*\n\s*/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\{\{ /g, '{{')
      .replace(/ \}\}/g, '}}')
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map(squashStrings);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (value)).map(([k, v]) => [
        k,
        squashStrings(v),
      ]),
    );
  }

  return value;
};

/**
 * Transform YAML files into JS object modules, stripping comments and squashing multiline strings.
 * This also handles `?raw` imports used by dependencies such as `@sveltia/ui`.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const yamlToJS = () => ({
  name: 'yaml-to-js',
  enforce: 'pre',
  // eslint-disable-next-line jsdoc/require-jsdoc
  async load(id) {
    const [cleanId, query = ''] = id.split('?');

    if (!cleanId.endsWith('.yaml') && !cleanId.endsWith('.yml')) return null;

    const content = await readFile(cleanId, 'utf-8');
    const parsed = squashStrings(parseYAML(content));

    if (new URLSearchParams(query).has('raw')) {
      // Return a JSON string so that the runtime `yaml.parse` call in dependencies still works
      return `export default ${JSON.stringify(JSON.stringify(parsed))};`;
    }

    return `export default ${JSON.stringify(parsed)};`;
  },
});

/**
 * Glob matching the component tests. A component test is written next to the `.svelte` file it
 * tests, with a `.svelte.test.js` suffix so it can use runes, and runs in a real browser: the
 * `@sveltia/ui` components rely on layout, focus and popovers, which a simulated DOM can’t provide.
 * Everything else runs in Node, or in happy-dom with a `@vitest-environment` comment.
 */
const COMPONENT_TESTS = 'src/lib/components/**/*.svelte.test.js';
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
 * Copy essential package files while modifying the `package.json` content.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const copyPackageFiles = () => ({
  name: 'copy-package-files',
  apply: 'build',
  buildStart: {
    async: true,
    sequential: false,
    // eslint-disable-next-line jsdoc/require-jsdoc
    handler: async () => {
      const packageJson = JSON.parse(await readFile('package.json'));
      const { dependencies, devDependencies } = packageJson;

      // Remove unnecessary properties as we only publish compiled bundles
      delete packageJson.dependencies;
      delete packageJson.devDependencies;
      delete packageJson.scripts;
      // `directory` only points `pnpm publish` at this folder from the repository root, and the
      // other options are passed on the command line. Kept here, it would make pnpm look for the
      // manifest in a `package` subfolder when the folder is installed as a local dependency
      delete packageJson.publishConfig;

      // Needed by the npm build only; the CDN builds are self-contained
      const npmDependencies = await getNpmDependencies(dependencies);
      const peerDependencies = TYPE_DEPENDENCIES.filter((key) => !(key in npmDependencies));

      // Add properties for distribution; paths are relative to `package`
      Object.assign(packageJson, {
        peerDependencies: Object.fromEntries(
          peerDependencies.map((key) => [key, dependencies[key] ?? devDependencies[key]]),
        ),
        peerDependenciesMeta: Object.fromEntries(
          peerDependencies.map((key) => [key, { optional: true }]),
        ),
        dependencies: npmDependencies,
        files: ['dist', 'npm', 'locales', 'schema', 'services', 'types', 'main.d.ts'],
        main: './npm/index.js',
        module: './npm/index.js',
        exports: {
          '.': {
            types: './main.d.ts',
            default: './npm/index.js',
          },
        },
        typesVersions: {
          '>4.0': {
            index: ['./main.d.ts'],
          },
        },
      });

      if (!existsSync('package')) {
        await mkdir('package');
      }

      await Promise.all([
        writeFile('package/package.json', JSON.stringify(packageJson, null, 2).concat('\n')),
        cp('LICENSE.txt', 'package/LICENSE.txt'),
        cp('README.md', 'package/README.md'),
      ]);
    },
  },
});

/**
 * Generate TypeScript type declaration files from JSDoc comments. This produces `main.d.ts` and
 * `types/public.d.ts`.
 * @see https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html
 */
const generateTypes = async () => {
  const command =
    'tsc src/lib/main.js --allowJs --declaration --emitDeclarationOnly --outDir package';

  await new Promise((resolve) => {
    exec(command, () => {
      resolve(undefined);
    });
  });

  // Re-export all types from `types/public.d.ts` in `main.d.ts` for better DX
  await appendFile(MAIN_TYPE_PATH, "export type * from './types/public';\n");

  const publicType = await readFile(PUBLIC_TYPE_PATH, 'utf-8');

  // Replace `DEPRECATED:` with proper `@deprecated` tag. This is needed because JSDoc comments
  // cannot have the `@deprecated` tag for each property in a typedef.
  await writeFile(PUBLIC_TYPE_PATH, publicType.replaceAll('DEPRECATED:', '@deprecated'));
};

/**
 * Schema keywords that document the configuration for an editor but have no effect on validation.
 */
const SCHEMA_ANNOTATIONS = [
  'title',
  'description',
  'markdownDescription',
  'deprecated',
  'deprecationMessage',
];

/**
 * Keywords whose value maps names to nested schemas. A key there is a configuration option name,
 * not a schema keyword, and `description` happens to be one of those options, so the keys are kept.
 */
const SCHEMA_MAPS = ['properties', 'definitions'];
/**
 * Keywords whose value is data rather than a nested schema, so it’s copied over untouched.
 */
const SCHEMA_VALUES = ['const', 'enum', 'required'];

/**
 * Remove the documentation from a schema, leaving only what affects validation.
 * @param {any} node Schema node.
 * @returns {any} Node without annotations.
 */
const stripSchemaAnnotations = (node) => {
  if (Array.isArray(node)) {
    return node.map(stripSchemaAnnotations);
  }

  if (!isObject(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(/** @type {Record<string, any>} */ (node))
      .filter(([key]) => !SCHEMA_ANNOTATIONS.includes(key))
      .map(([key, value]) => {
        if (SCHEMA_VALUES.includes(key)) {
          return [key, value];
        }

        if (SCHEMA_MAPS.includes(key) && isObject(value)) {
          return [
            key,
            Object.fromEntries(
              Object.entries(/** @type {Record<string, any>} */ (value)).map(([name, nested]) => [
                name,
                stripSchemaAnnotations(nested),
              ]),
            ),
          ];
        }

        return [key, stripSchemaAnnotations(value)];
      }),
  );
};

/**
 * Generate JSON schema for the Sveltia CMS configuration from TypeScript types. This schema is used
 * to validate the `config.yml` file within VS Code and other tools that support JSON schema
 * validation.
 * @see https://github.com/vega/ts-json-schema-generator
 * @see https://www.schemastore.org/netlify.json - Legacy Netlify CMS config schema
 * @see https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json - Our published schema
 */
const generateSchema = async () => {
  const config = {
    path: PUBLIC_TYPE_PATH,
    type: 'CmsConfig',
    // `markdownDescription` is a VS Code schema extension
    // https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings
    markdownDescription: true,
  };

  const schema = {
    ...createGenerator(config).createSchema(config.type),
    title: 'Sveltia CMS Configuration',
    description: 'Sveltia CMS configuration file',
  };

  // Allow having the `$schema` property at the top of the config file
  // https://json-schema.org/understanding-json-schema/keywords
  schema.definitions.CmsConfig.properties.$schema = { type: 'string', format: 'uri' };

  // Require at least one of `collections` or `singletons`
  schema.definitions.CmsConfig.anyOf = [
    { required: ['collections'] },
    { required: ['singletons'] },
  ];

  // Disallow built-in field type names for custom fields. We need this because the `Exclude` type
  // utility used in the TypeScript definition is not converted to JSON schema.
  // @see https://github.com/vega/ts-json-schema-generator/issues/993
  Object.assign(schema.definitions.CustomField.properties.widget, {
    minLength: 1,
    not: { enum: BUILTIN_FIELD_TYPES },
  });

  const schemaString = JSON.stringify(schema)
    // Remove unnecessary escaped line breaks in `markdownDescription` originally present in JSDoc
    .replace(/\\n/g, ' ')
    // Use the proper boolean `deprecated` property instead of a string and append a separate
    // message property. `deprecationMessage` is a VS Code schema extension
    .replace(/"deprecated":"(.+?)"/g, '"deprecated":true,"deprecationMessage":"$1"');

  await mkdir('package/schema', { recursive: true });
  await writeFile(SCHEMA_PATH, schemaString);
};

/**
 * Parts of the app that are built as separate ES module chunks, keyed by chunk name. A chunk is
 * only loaded when needed, with `loadChunk()`, so the main bundle stays smaller. See the entry
 * files for what each chunk is for.
 */
const CHUNKS = {
  'react-dom': 'src/lib/chunks/react-dom.js',
};

/**
 * Output directory of the chunks, next to the main bundle.
 */
const CHUNKS_DIR = 'package/dist/chunks';
/**
 * Module specifier of the shim the `react` package resolves to in a chunk build.
 */
const REACT_SHIM_MODULE_ID = 'virtual:react-shim';
const RESOLVED_REACT_SHIM_MODULE_ID = `\0${REACT_SHIM_MODULE_ID}`;

/**
 * In a chunk build, resolve the `react` package to the React instance the main bundle shares on
 * `globalThis`, rather than bundling a second copy: React elements created by one copy can’t be
 * rendered by another. Every export of the package is re-exported from the shim, so the chunk’s
 * dependencies can import whichever they use.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const shimReact = () => ({
  name: 'shim-react',
  // eslint-disable-next-line jsdoc/require-jsdoc
  resolveId: (id) => (id === 'react' ? RESOLVED_REACT_SHIM_MODULE_ID : null),
  // eslint-disable-next-line jsdoc/require-jsdoc
  load: (id) => {
    if (id !== RESOLVED_REACT_SHIM_MODULE_ID) {
      return null;
    }

    return [
      `const React = globalThis[${JSON.stringify(SHARED_REACT_KEY)}];`,
      'export default React;',
      ...Object.keys(React).map((key) => `export const ${key} = React[${JSON.stringify(key)}];`),
    ].join('\n');
  },
});

/**
 * Build the chunks once the main bundle has been written. They’re built separately because the
 * main bundle is an IIFE, which can’t be split, and a chunk shares nothing with it but React.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const buildChunks = () => ({
  name: 'build-chunks',
  apply: 'build',
  // eslint-disable-next-line jsdoc/require-jsdoc
  closeBundle: async () => {
    await build({
      configFile: false,
      logLevel: 'warn',
      define: {
        // `react-dom` picks its production build by this
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      plugins: [shimReact()],
      build: {
        outDir: CHUNKS_DIR,
        emptyOutDir: true,
        reportCompressedSize: false,
        sourcemap: true,
        rolldownOptions: {
          input: CHUNKS,
          output: {
            format: 'es',
            entryFileNames: '[name].js',
            comments: {
              legal: true,
            },
          },
          preserveEntrySignatures: 'strict',
        },
      },
    });
  },
});

/**
 * Module specifier the app imports the bundled configuration schema from.
 */
const SCHEMA_MODULE_ID = 'virtual:config-schema';
const RESOLVED_SCHEMA_MODULE_ID = `\0${SCHEMA_MODULE_ID}`;

/**
 * Bundle the configuration schema with the app, stripped of the documentation that only an editor
 * needs. Validation then costs nothing at runtime beyond the few kilobytes the schema compresses
 * to, and it works offline and under a content security policy that blocks the CDN.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const bundleSchema = () => ({
  name: 'bundle-schema',
  // eslint-disable-next-line jsdoc/require-jsdoc
  resolveId: (id) => (id === SCHEMA_MODULE_ID ? RESOLVED_SCHEMA_MODULE_ID : null),
  // eslint-disable-next-line jsdoc/require-jsdoc
  load: async (id) => {
    if (id !== RESOLVED_SCHEMA_MODULE_ID) {
      return null;
    }

    // A build writes the schema in `buildStart`, before any module is loaded. The dev server
    // doesn’t, to keep startup quick, so it reuses whatever the last build left behind — and
    // exports nothing at all if there was none, which turns validation off.
    if (!existsSync(SCHEMA_PATH)) {
      return 'export default null;';
    }

    const schema = stripSchemaAnnotations(JSON.parse(await readFile(SCHEMA_PATH, 'utf-8')));

    return `export default ${JSON.stringify(schema)};`;
  },
});

/**
 * Read a YAML file and parse it, stripping comments and squashing multiline strings, just like the
 * {@link yamlToJS} plugin does for imported YAML files.
 * @param {string} filePath Path to the YAML file.
 * @returns {Promise<Record<string, any>>} Parsed object.
 */
const parseYAMLFile = async (filePath) =>
  /** @type {Record<string, any>} */ (squashStrings(parseYAML(await readFile(filePath, 'utf-8'))));

/**
 * Generate JSON locale files from the YAML sources. The Sveltia CMS strings are merged with the
 * Sveltia UI strings, the latter being prefixed with `_sui`, in the same way as `initAppLocale`
 * does at runtime. These files are published and will be lazily loaded.
 * @see https://unpkg.com/@sveltia/cms/locales/en-US.json - Our published locale file
 */
const generateLocales = async () => {
  // Resolve the path to the locale files bundled with the `@sveltia/ui` package
  const uiLocalesDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.resolve('@sveltia/ui'))),
    'locales',
  );

  await mkdir(OUTPUT_LOCALES_DIR, { recursive: true });

  await Promise.all(
    getAppLocales().map(async (locale) => {
      const uiLocalePath = path.resolve(uiLocalesDir, `${locale}.yaml`);

      const [appStrings, componentStrings] = await Promise.all([
        parseYAMLFile(path.resolve(APP_LOCALES_DIR, `${locale}.yaml`)),
        // Sveltia UI may not have the locale yet
        existsSync(uiLocalePath) ? parseYAMLFile(uiLocalePath) : {},
      ]);

      await writeFile(
        path.resolve(OUTPUT_LOCALES_DIR, `${locale}.json`),
        JSON.stringify({ ...appStrings, _sui: componentStrings }),
      );
    }),
  );
};

/**
 * Generate extra files such as TypeScript type declaration, JSON schema and JSON locales.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const generateExtraFiles = () => ({
  name: 'generate-extra-files',
  apply: 'build',
  buildStart: {
    async: true,
    sequential: false,
    // eslint-disable-next-line jsdoc/require-jsdoc
    handler: async () => {
      await generateTypes();
      await generateSchema();
      await generateLocales();
    },
  },
});

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
};

/**
 * Get the plugins processing the source, shared by the CDN builds and the npm build. A new instance
 * of each is needed per build.
 * @returns {import('vite').PluginOption[]} Plugins.
 */
const getSharedPlugins = () => [
  yamlToJS(),
  svelte({
    ...svelteConfig,
    emitCss: false,
  }),
  bundleSchema(),
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
    include: ['create-react-class'],
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
    ...getSharedPlugins(),
    copyPackageFiles(),
    generateExtraFiles(),
    buildChunks(),
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
    exclude: [...defaultExclude, '.claude/**'],
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
          exclude: [...defaultExclude, '.claude/**', COMPONENT_TESTS],
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
