import { exec } from 'child_process';
import { existsSync } from 'fs';
import { appendFile, cp, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createGenerator } from 'ts-json-schema-generator';
import { defineConfig } from 'vite';

import { BUILTIN_WIDGETS } from './src/lib/services/contents/widgets';
import svelteConfig from './svelte.config';

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
        files: ['dist', 'schema', 'types', 'main.d.ts'],
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

  // Export the `CmsConfig` type
  await appendFile(MAIN_TYPE_PATH, 'export type { CmsConfig };\n');

  const publicType = await readFile(PUBLIC_TYPE_PATH, 'utf-8');

  // Replace `DEPRECATED:` with proper `@deprecated` tag. This is needed because JSDoc comments
  // cannot have the `@deprecated` tag for each property in a typedef.
  await writeFile(PUBLIC_TYPE_PATH, publicType.replaceAll('DEPRECATED:', '@deprecated'));
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

  // Disallow built-in widget names for custom widgets. We need this because the `Exclude` type
  // utility used in the TypeScript definition is not converted to JSON schema.
  // @see https://github.com/vega/ts-json-schema-generator/issues/993
  Object.assign(schema.definitions.CustomField.properties.widget, {
    minLength: 1,
    not: { enum: BUILTIN_WIDGETS },
  });

  const schemaString = JSON.stringify(schema)
    // Remove unnecessary escaped line breaks in `markdownDescription` originally present in JSDoc
    .replace(/\\n/g, ' ')
    // Use the proper boolean `deprecated` property instead of a string and append a separate
    // message property. `deprecationMessage` is a VS Code schema extension
    .replace(/"deprecated":"(.+?)"/g, '"deprecated":true,"deprecationMessage":"$1"');

  await mkdir('package/schema', { recursive: true });
  await writeFile('package/schema/sveltia-cms.json', schemaString);
};

/**
 * Generate extra files such as TypeScript type declaration and JSON schema.
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
  build: {
    target: 'es2024',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
    sourcemap: true,
    rollupOptions: {
      // Output JavaScript only
      input: 'src/lib/main.js',
      output: [
        {
          entryFileNames: 'sveltia-cms.js',
          format: 'iife',
        },
        {
          entryFileNames: 'sveltia-cms.mjs',
          format: 'es',
        },
      ],
      // Keep exports in the ES module
      // https://stackoverflow.com/q/71500190
      preserveEntrySignatures: 'strict',
    },
    outDir: 'package/dist',
  },
  // https://esbuild.github.io/api/#legal-comments
  esbuild: { legalComments: 'eof' },
  plugins: [
    svelte({
      ...svelteConfig,
      emitCss: false,
    }),
    copyPackageFiles(),
    generateExtraFiles(),
  ],
  test: {
    coverage: {
      include: ['src/lib/{components,services}/**/*.js'],
      reporter: ['text'],
    },
    silent: true,
  },
});
