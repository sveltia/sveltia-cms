import { cp, mkdir, writeFile } from 'fs/promises';

import { generateLocales } from './locales.js';
import { getNpmDependencies } from './npm-build.js';
import { generateSchema, generateTypes } from './schema.js';
import { readPackageJson } from './utils.js';

/**
 * Packages whose types the generated `d.ts` files import. Those that aren’t dependencies of the npm
 * build are listed in the published `package.json` as optional peer dependencies: their code is
 * bundled, so only a TypeScript user needs them, and a package manager never installs the dev
 * dependencies of a dependency.
 */
const TYPE_DEPENDENCIES = ['@types/react', 'immutable'];

/**
 * Copy essential package files while modifying the `package.json` content.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const copyPackageFiles = () => ({
  name: 'copy-package-files',
  apply: 'build',
  // eslint-disable-next-line jsdoc/require-jsdoc
  buildStart: async () => {
    const packageJson = readPackageJson();
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

    // `generateExtraFiles()` may create the directory at the same time
    await mkdir('package', { recursive: true });

    await Promise.all([
      writeFile('package/package.json', JSON.stringify(packageJson, null, 2).concat('\n')),
      cp('LICENSE.txt', 'package/LICENSE.txt'),
      cp('README.md', 'package/README.md'),
    ]);
  },
});

/**
 * Generate extra files such as TypeScript type declaration, JSON schema and JSON locales.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const generateExtraFiles = () => ({
  name: 'generate-extra-files',
  apply: 'build',
  // eslint-disable-next-line jsdoc/require-jsdoc
  buildStart: async () => {
    // The schema is generated from the type declarations, while the locales are independent
    await Promise.all([generateTypes().then(generateSchema), generateLocales()]);
  },
});
