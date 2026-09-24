/**
 * The npm build of the app, run by the `build-npm` Vite plugin once the CDN builds have been
 * written. Unlike those, it’s code-split into ES modules for the consumer’s bundler to process, and
 * doesn’t load anything from a CDN. See `buildNpm()` for the details.
 */

import { existsSync } from 'fs';
import { copyFile, readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { build } from 'vite';

/**
 * Shiki packages the npm build leaves to the consumer’s bundler rather than bundling: the grammars
 * and themes, which the Sveltia UI self-hosted loaders import one by one. Bundled, they would add a
 * few hundred chunks to every release of the package; as dependencies, they’re installed once and
 * only emitted with the consumer’s app. They’re pinned to the versions Sveltia UI depends on.
 */
const SHIKI_PACKAGES = ['@shikijs/langs', '@shikijs/themes'];

/**
 * Libraries the npm build leaves to the consumer’s bundler, like {@link SHIKI_PACKAGES}: the ones
 * loaded on demand with `loadModule()` that work as they are with any bundler. They take the
 * version ranges the CMS depends on, so a site that uses one of them too can share a single copy.
 * The jSquash and HEIC codecs are bundled instead, as `stripImportMetaAssignment()` has to fix them
 * for webpack, and so is React DOM, which has to share the bundled React with custom components.
 */
const LIBRARY_PACKAGES = [
  'exifr',
  'immutable',
  'leaflet',
  'svgo',
  'terra-draw',
  'terra-draw-leaflet-adapter',
  'turndown',
];

/**
 * All the packages the npm build leaves to the consumer’s bundler.
 */
const NPM_EXTERNAL_PACKAGES = [...SHIKI_PACKAGES, ...LIBRARY_PACKAGES];

/**
 * Check whether a module is imported from one of the {@link NPM_EXTERNAL_PACKAGES}. An import with
 * a query, like the Leaflet marker icon imported with `?url`, is an asset bundled with the app.
 * @param {string} id Module ID.
 * @returns {boolean} Result.
 */
const isNpmExternal = (id) =>
  !id.includes('?') &&
  NPM_EXTERNAL_PACKAGES.some((name) => id === name || id.startsWith(`${name}/`));

/**
 * Get the dependencies of the npm build: the {@link SHIKI_PACKAGES}, pinned to the versions the
 * installed Sveltia UI depends on, as the grammars and themes must match the Shiki version its
 * prebuilt engine was built with, and the {@link LIBRARY_PACKAGES}, with the ranges of the CMS.
 * @param {Record<string, string>} appDependencies Dependencies of the CMS.
 * @returns {Promise<Record<string, string>>} Versions keyed with the package name.
 * @throws {Error} If Sveltia UI doesn’t pin a Shiki package to an exact version, or the CMS doesn’t
 * depend on a library.
 */
export const getNpmDependencies = async (appDependencies) => {
  const { dependencies: uiDependencies } = JSON.parse(
    await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.resolve('@sveltia/ui'))),
        '../package.json',
      ),
      'utf-8',
    ),
  );

  return Object.fromEntries([
    ...SHIKI_PACKAGES.map((name) => {
      const version = uiDependencies?.[name];

      if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
        throw new Error(`Sveltia UI doesn’t pin ${name} to an exact version: ${version}`);
      }

      return [name, version];
    }),
    ...LIBRARY_PACKAGES.map((name) => {
      const version = appDependencies[name];

      if (!version) {
        throw new Error(`The CMS doesn’t depend on ${name}.`);
      }

      return [name, version];
    }),
  ]);
};

/**
 * Output directory of the npm build, next to the main bundle.
 */
const NPM_DIR = 'package/npm';

/**
 * In the npm build, remove the assignment to `import.meta.url` that the jSquash and HEIC codecs
 * make for Node and Cloudflare Workers, where the CMS never runs. The webpack bundler replaces
 * `import.meta.url` with a string literal, which turns the assignment into a syntax error.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const stripImportMetaAssignment = () => ({
  name: 'strip-import-meta-assignment',
  // eslint-disable-next-line jsdoc/require-jsdoc
  transform: (code, id) => {
    if (!/\/codec\/(?:enc|dec)\/[\w-]+\.js$/.test(id)) {
      return null;
    }

    const result = code.replace(
      'if(import.meta.url===undefined){import.meta.url="https://localhost"}',
      '',
    );

    // Fail the build rather than ship a package that webpack can’t minify, e.g. once a codec
    // update has changed the minified shim so the replacement above no longer matches
    if (/import\.meta\.url\s*=(?!=)/.test(result)) {
      throw new Error(`Unexpected assignment to \`import.meta.url\` left in ${id}.`);
    }

    // Removing one statement doesn’t move the rest of the code enough to need a new sourcemap
    return { code: result, map: null };
  },
});

/**
 * In the npm build, generate `published-locales.js` with a loader for each locale file published
 * with the package, except the default one, which is bundled. Each file is imported with a static
 * path, left to the consumer’s bundler to emit it as a chunk: a path with a variable part wouldn’t
 * do, as Vite doesn’t analyze those in `node_modules`. The path is relative to the entry point,
 * `npm/index.js`, where the module ends up, as `i18n.js` imports it statically; the build fails if
 * it ends up anywhere else, where the paths would point to the wrong folder.
 * @param {string[]} locales Locale codes of the app.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const publishedLocales = (locales) => {
  const moduleId = path.resolve('src/lib/services/app/published-locales.js');
  const localesDir = '../locales/';

  return {
    name: 'published-locales',
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: (id) => {
      if (id !== moduleId) {
        return null;
      }

      const loaders = locales
        .filter((locale) => locale !== 'en-US')
        .map((locale) => `  '${locale}': () => import('${localesDir}${locale}.json'),`);

      return `export const PUBLISHED_LOCALE_LOADERS = {\n${loaders.join('\n')}\n};\n`;
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    resolveId: (source, importer) =>
      importer === moduleId && source.startsWith(localesDir)
        ? { id: source, external: true }
        : null,
    // eslint-disable-next-line jsdoc/require-jsdoc
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (chunk) =>
          chunk.type === 'chunk' && chunk.dynamicImports.some((id) => id.startsWith(localesDir)),
      );

      if (chunks.length !== 1 || !chunks[0].isEntry) {
        this.error(
          `The locale files must be imported from the entry chunk only, but are imported from: ${
            chunks.map(({ fileName }) => fileName).join(', ') || 'nowhere'
          }`,
        );
      }
    },
  };
};

/**
 * In the npm build, load the `.npm.js` variant of a module wherever there is one, e.g.
 * `heic-worker-factory.npm.js` for `heic-worker-factory.js`. A variant replaces code that uses a
 * CDN, either with code that bundles the same files, or with a stand-in when the feature is left
 * out, like `pdf.npm.js`. That can’t be done with `import.meta.env.NPM_BUILD` alone: a bundler
 * handles the modules and assets a module references before the unused branches are removed.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const useNpmVariants = () => ({
  name: 'use-npm-variants',
  enforce: 'pre',
  // eslint-disable-next-line jsdoc/require-jsdoc
  async resolveId(source, importer, options) {
    if (!importer || source.endsWith('.npm.js')) {
      return null;
    }

    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

    if (!resolved || resolved.external || !resolved.id.startsWith(path.resolve('src/lib'))) {
      return null;
    }

    const variant = resolved.id.replace(/\.js$/, '.npm.js');

    return variant !== resolved.id && existsSync(variant) ? variant : null;
  },
});

/**
 * Build the npm version of the app once the main bundle has been written. Unlike the CDN builds,
 * it’s code-split, and doesn’t load anything from UNPKG or jsDelivr: it bundles the libraries,
 * fonts and workers as separate chunks and assets the consumer’s bundler picks up, and leaves the
 * locale files published with the package and the Shiki grammars and themes to that bundler, see
 * {@link publishedLocales} and {@link NPM_EXTERNAL_PACKAGES}. PDF thumbnails are left out, as
 * PDF.js comes with hundreds of files.
 * @param {object} args Settings shared with the main build.
 * @param {import('vite').UserConfig['resolve']} args.resolve Module resolution options.
 * @param {Record<string, string>} args.define Global constants.
 * @param {() => import('vite').PluginOption[]} args.plugins Function returning the plugins that
 * process the source, like the Svelte compiler. A function, as a plugin instance can only be used
 * in one build.
 * @param {string[]} args.locales Locale codes of the app.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const buildNpm = ({ resolve, define, plugins, locales }) => ({
  name: 'build-npm',
  apply: 'build',
  // eslint-disable-next-line jsdoc/require-jsdoc
  closeBundle: async () => {
    await build({
      configFile: false,
      logLevel: 'warn',
      base: './',
      resolve,
      define: { ...define, 'import.meta.env.NPM_BUILD': 'true' },
      plugins: [
        useNpmVariants(),
        stripImportMetaAssignment(),
        publishedLocales(locales),
        ...plugins(),
      ],
      worker: {
        format: 'es',
        // eslint-disable-next-line jsdoc/require-jsdoc
        plugins: () => [stripImportMetaAssignment()],
      },
      build: {
        outDir: NPM_DIR,
        emptyOutDir: true,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 5000,
        sourcemap: true,
        // Emit every asset as a file, so a strict Content Security Policy needs no `data:` source
        assetsInlineLimit: 0,
        // Leave preloading to the consumer’s bundler: the helper lists our own chunk paths, which
        // no longer exist once the consumer has bundled again the package
        modulePreload: false,
        rolldownOptions: {
          input: { index: 'src/lib/npm.js' },
          external: isNpmExternal,
          output: {
            format: 'es',
            entryFileNames: '[name].js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
            comments: { legal: true },
          },
          preserveEntrySignatures: 'strict',
          checks: { pluginTimings: false },
        },
      },
    });

    // The fonts bundled from Sveltia UI are under the SIL Open Font License, which requires the
    // license to accompany every redistributed copy, but a bundler only emits the files referenced
    // in the code. Copy them next to the font files
    const fontsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.resolve('@sveltia/ui/self-hosted'))),
      'fonts',
    );

    await Promise.all(
      (await readdir(fontsDir))
        .filter((name) => name.endsWith('.LICENSE.txt'))
        .map((name) => copyFile(path.join(fontsDir, name), path.join(NPM_DIR, 'assets', name))),
    );
  },
});
