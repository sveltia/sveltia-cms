import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Read the project’s `package.json` file.
 * @returns {Record<string, any>} Parsed content.
 */
export const readPackageJson = () => JSON.parse(readFileSync('package.json', 'utf-8'));

/**
 * Get the directory of the file a module specifier resolves to, e.g. the `dist` directory of a
 * package for its main entry.
 * @param {string} specifier Module specifier, e.g. `@sveltia/ui`.
 * @returns {string} Absolute directory path.
 */
export const resolveModuleDir = (specifier) =>
  path.dirname(fileURLToPath(import.meta.resolve(specifier)));

/**
 * Create a Vite plugin that provides a virtual module: importing the given ID loads the code the
 * `load` function returns. The ID is resolved with the conventional `\0` prefix, so other plugins
 * leave the module alone.
 * @param {object} args Arguments.
 * @param {string} args.name Plugin name.
 * @param {string} args.id Module specifier, e.g. `virtual:package-info`.
 * @param {() => string | Promise<string>} args.load Function returning the module code.
 * @param {Omit<import('vite').Plugin, 'name' | 'resolveId' | 'load'>} [args.hooks] Other plugin
 * properties, e.g. `enforce`.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const virtualModule = ({ name, id, load, hooks = {} }) => {
  const resolvedId = `\0${id}`;

  return {
    ...hooks,
    name,
    // eslint-disable-next-line jsdoc/require-jsdoc
    resolveId: (source) => (source === id ? resolvedId : null),
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: (source) => (source === resolvedId ? load() : null),
  };
};
