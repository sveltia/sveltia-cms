import { existsSync, readdirSync, readFileSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { isObject } from '@sveltia/utils/object';
import { parse as parseYAML } from 'yaml';

import { resolveModuleDir } from './utils.js';

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
export const getAppLocales = () =>
  readdirSync(APP_LOCALES_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => path.basename(name, '.yaml'))
    .sort();

/**
 * Get the keys of the locales Day.js provides, e.g. `de` or `pt-br`. The list is injected into the
 * bundle as `import.meta.env.VITE_DAYJS_LOCALES`, as the `locale.json` file of the package holds
 * their names as well, which the app doesn’t need.
 * @returns {string[]} Locale keys.
 */
export const getDayjsLocales = () =>
  JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('dayjs/locale.json')), 'utf-8')).map(
    (/** @type {{ key: string }} */ { key }) => key,
  );

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
export const yamlToJS = () => ({
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
export const generateLocales = async () => {
  // Resolve the path to the locale files bundled with the `@sveltia/ui` package
  const uiLocalesDir = path.resolve(resolveModuleDir('@sveltia/ui'), 'locales');

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
