import { exec } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { appendFile, cp, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { isObject } from '@sveltia/utils/object';
import Sonda from 'sonda/vite';
import { createGenerator } from 'ts-json-schema-generator';
import { defineConfig } from 'vite';
import { defaultExclude } from 'vitest/config';
import { parse as parseYAML } from 'yaml';

// eslint-disable-next-line import-x/no-useless-path-segments
import { BUILTIN_FIELD_TYPES } from './src/lib/services/contents/fields/index.js';
import svelteConfig from './svelte.config.js';

/**
 * List of dev dependencies to include in the published `package.json`.
 */
const DEV_DEPENDENCIES = ['@types/react', 'immutable'];
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
 * the available locales without bundling their strings.
 * @returns {string[]} Locale codes, e.g. `['en-US', 'ja']`.
 */
const getAppLocales = () =>
  readdirSync(APP_LOCALES_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => path.basename(name, '.yaml'));

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
      delete packageJson.scripts;

      // Add properties for distribution; paths are relative to `package`
      Object.assign(packageJson, {
        // Keep only type declarations imported in the generated `d.ts` files
        devDependencies: Object.fromEntries(
          DEV_DEPENDENCIES.map((key) => [key, dependencies[key] ?? devDependencies[key]]),
        ),
        files: ['dist', 'locales', 'schema', 'services', 'types', 'main.d.ts'],
        main: './dist/sveltia-cms.mjs',
        module: './dist/sveltia-cms.mjs',
        exports: {
          '.': {
            types: './main.d.ts',
            default: './dist/sveltia-cms.mjs',
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

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib/'),
    },
    extensions: ['.js', '.svelte'],
  },
  define: {
    'import.meta.env.VITE_APP_LOCALES': JSON.stringify(getAppLocales().join(',')),
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
        missingNameOptionForIifeExport: false,
        mixedExports: false,
        pluginTimings: false,
      },
    },
    outDir: 'package/dist',
  },
  plugins: [
    yamlToJS(),
    svelte({
      ...svelteConfig,
      emitCss: false,
    }),
    copyPackageFiles(),
    generateExtraFiles(),
    bundleSchema(),
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
    coverage: {
      include: ['src/lib/{components,services}/**/*.js'],
      reporter: ['text', 'json-summary', 'json'],
    },
    env: {
      TZ: 'UTC',
    },
    silent: true,
  },
});
