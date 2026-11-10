import React from 'react';
import { build } from 'vite';

import { SHARED_MODULES_KEY_PREFIX, SHARED_REACT_KEY } from '../../src/lib/chunks/constants.js';

import { getChunkModules } from './chunk-modules.js';
import { readPackageJson, virtualModule } from './utils.js';

/**
 * Parts of the app that are built as separate ES module chunks, keyed by chunk name. A chunk is
 * only loaded when needed, with `loadChunk()`, so the main bundle stays smaller. See the entry
 * files for what each chunk is for.
 */
const CHUNKS = {
  git: 'src/lib/chunks/git.js',
  gitea: 'src/lib/chunks/gitea.js',
  gitlab: 'src/lib/chunks/gitlab.js',
  qrcode: 'src/lib/chunks/qrcode.js',
  'react-dom': 'src/lib/chunks/react-dom.js',
};

/**
 * Chunks made of app modules rather than a package, which take the modules they share with the rest
 * of the app from the main bundle, keyed by chunk name: the backends a site may not use. The value
 * is the directory whose modules the chunk owns. See {@link getChunkModules}.
 */
const APP_CHUNK_DIRS = {
  gitea: 'src/lib/services/backends/git/gitea',
  gitlab: 'src/lib/services/backends/git/gitlab',
};

/**
 * The modules the app chunks own and those they share with the main bundle, worked out on first
 * use, as it takes reading the whole source.
 * @type {import('./chunk-modules.js').ChunkModules | undefined}
 */
let appChunkModules;

/**
 * Get the modules the app chunks own and those they share with the main bundle.
 * @returns {import('./chunk-modules.js').ChunkModules} Modules.
 */
const getAppChunkModules = () => {
  appChunkModules ??= getChunkModules({
    entries: Object.keys(APP_CHUNK_DIRS).map(
      (name) => CHUNKS[/** @type {keyof typeof CHUNKS} */ (name)],
    ),
    ownDirs: Object.values(APP_CHUNK_DIRS),
  });

  return appChunkModules;
};

/**
 * Get the global property the main bundle shares the modules of the app chunks on. It names the
 * release as well as the layout of the modules, as a chunk is loaded from a fixed URL next to the
 * main bundle: a browser may still have one cached from an earlier release, which would otherwise
 * run its outdated code against the new main bundle whenever the layout hasn’t changed.
 * @returns {string} Property name.
 */
const getSharedModulesKey = () => {
  const { version } = readPackageJson();

  return `${SHARED_MODULES_KEY_PREFIX}${version}_${getAppChunkModules().layoutId}`;
};

/**
 * Prefix of the module IDs the app chunks resolve a shared module to.
 */
const SHARED_MODULE_ID_PREFIX = '\0shared-module:';
/**
 * ID of the module the shared modules of an app chunk take the array of shared modules from.
 */
const SHARED_MODULE_LIST_ID = '\0shared-module-list';

/**
 * Collect the modules the app chunks import from the main bundle, so `main.js` can share them on
 * `globalThis`. Each module is an array of the exports the chunks use, in the order
 * {@link getChunkModules} gives, so the chunks take them by position rather than by name, which the
 * minifier would have mangled anyway. The chunks are only built for the CDN bundles: the npm build,
 * the development server and the tests import their entries like any other module, so the array is
 * empty there.
 * @param {object} [options] Options.
 * @param {boolean} [options.enabled] Whether the build is a CDN one.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const collectSharedModules = ({ enabled = false } = {}) => {
  let isBuild = false;

  return virtualModule({
    name: 'collect-shared-modules',
    id: 'virtual:shared-modules',
    hooks: {
      // eslint-disable-next-line jsdoc/require-jsdoc
      configResolved: (config) => {
        isBuild = config.command === 'build';
      },
      // eslint-disable-next-line jsdoc/require-jsdoc
      buildStart: () => {
        // Read the source again for each CDN build, which `build:watch` runs on every change
        if (enabled) {
          appChunkModules = undefined;
        }
      },
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: () => {
      if (!enabled || !isBuild) {
        return "export const sharedModulesKey = '';\nexport default [];";
      }

      const { sharedModules } = getAppChunkModules();

      return [
        `export const sharedModulesKey = ${JSON.stringify(getSharedModulesKey())};`,
        ...sharedModules.map(({ id: moduleId, names }, index) =>
          names.length
            ? `import { ${names.map((name, i) => `${name} as m${index}_${i}`).join(', ')} } from ${JSON.stringify(moduleId)};`
            : '',
        ),
        `export default [${sharedModules
          .map(({ names }, index) => `[${names.map((_name, i) => `m${index}_${i}`).join(', ')}]`)
          .join(', ')}];`,
      ].join('\n');
    },
  });
};

/**
 * Whether the given module specifier points to a package.
 * @param {string} specifier Module specifier.
 * @returns {boolean} Result.
 */
const isPackageSpecifier = (specifier) => !/^(?:\.|\/|\$lib\/|\0)/.test(specifier);

/**
 * In a chunk build, resolve every module an app chunk imports from the main bundle to the copy the
 * main bundle shares on `globalThis` (see {@link collectSharedModules}), rather than bundling a
 * second one, which wouldn’t share the state of the app’s modules. Only the modules the chunk owns
 * are bundled; importing anything else fails the build, as it would be a module the analysis has
 * missed.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const shareMainModules = () => {
  const { ownFiles, sharedModules } = getAppChunkModules();
  const sharedModulesKey = getSharedModulesKey();
  const indexById = new Map(sharedModules.map(({ id }, index) => [id, index]));

  return {
    name: 'share-main-modules',
    enforce: 'pre',
    // eslint-disable-next-line jsdoc/require-jsdoc
    async resolveId(source, importer, options) {
      if (source === SHARED_MODULE_LIST_ID) {
        return source;
      }

      if (!importer || !ownFiles.has(importer)) {
        return null;
      }

      const id = isPackageSpecifier(source)
        ? source
        : (await this.resolve(source, importer, { ...options, skipSelf: true }))?.id;

      const index = id === undefined ? undefined : indexById.get(id);

      if (index !== undefined) {
        return `${SHARED_MODULE_ID_PREFIX}${index}`;
      }

      if (id !== undefined && ownFiles.has(id)) {
        return id;
      }

      return this.error(`${source}, imported by ${importer}, is not shared by the main bundle`);
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: (id) => {
      if (id === SHARED_MODULE_LIST_ID) {
        // A chunk cached from another release finds nothing under the property, and fails to load,
        // so `loadChunk()` falls back to the copy of this release on the CDN
        return [
          `const list = globalThis[${JSON.stringify(sharedModulesKey)}];`,
          "if (!list) throw new Error('The chunk was built with another version of the CMS.');",
          'export default list;',
        ].join('\n');
      }

      if (!id.startsWith(SHARED_MODULE_ID_PREFIX)) {
        return null;
      }

      const index = Number(id.slice(SHARED_MODULE_ID_PREFIX.length));
      const { names } = sharedModules[index];

      if (!names.length) {
        return 'export {};';
      }

      return [
        `import list from ${JSON.stringify(SHARED_MODULE_LIST_ID)};`,
        `const m = list[${index}];`,
        `const ${names.map((_name, i) => `e${i} = m[${i}]`).join(', ')};`,
        `export { ${names.map((name, i) => `e${i} as ${name}`).join(', ')} };`,
      ].join('\n');
    },
  };
};

/**
 * Output directory of the chunks, next to the main bundle.
 */
const CHUNKS_DIR = 'package/dist/chunks';

/**
 * In a chunk build, resolve the `react` package to the React instance the main bundle shares on
 * `globalThis`, rather than bundling a second copy: React elements created by one copy can’t be
 * rendered by another. Every export of the package is re-exported from the shim, so the chunk’s
 * dependencies can import whichever they use.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const shimReact = () =>
  virtualModule({
    name: 'shim-react',
    id: 'react',
    // Run before Vite’s own resolver, which would otherwise resolve the package to its files
    hooks: { enforce: 'pre' },
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: () =>
      [
        `const React = globalThis[${JSON.stringify(SHARED_REACT_KEY)}];`,
        'export default React;',
        ...Object.keys(React).map((key) => `export const ${key} = React[${JSON.stringify(key)}];`),
      ].join('\n'),
  });

/**
 * Build the chunks once the main bundle has been written. They’re built separately because the
 * main bundle is an IIFE, which can’t be split. A package chunk shares nothing with it but React,
 * and an app chunk the modules it imports from the rest of the app.
 * @param {object} args Arguments.
 * @param {import('vite').UserConfig['resolve']} args.resolve Module resolution options.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const buildChunks = ({ resolve }) => ({
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
      resolve,
      plugins: [shimReact(), shareMainModules()],
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
