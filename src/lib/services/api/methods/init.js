import { isObject } from '@sveltia/utils/object';
import { mount } from 'svelte';

import App from '$lib/components/app.svelte';
import { prefetchCmsConfig } from '$lib/services/config/loader';

/**
 * @import { CmsConfig } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

let initialized = false;

/**
 * Initialize the CMS, optionally with the given CMS configuration. When the CMS is loaded with a
 * classic `<script>` tag, e.g. from a CDN, it initializes itself automatically unless
 * `window.CMS_MANUAL_INIT` is set to `true` before the script is loaded. When it’s imported as a
 * module, e.g. from the npm package, this method always has to be called. It mounts the app on the
 * `<div id="nc-root">` element if present, or the `<body>` element otherwise, waiting for the page
 * content to be loaded if needed. Calls after the first one are ignored.
 * @param {object} [options] Options.
 * @param {CmsConfig} [options.config] Configuration to be merged with the configuration file, such
 * as `config.yml`. Its options override the file’s, except for arrays such as `collections`, which
 * are concatenated, so an array item can be added but not replaced. Include
 * `load_config_file: false` to prevent the configuration file from being loaded, in which case
 * this has to be a complete configuration.
 * @returns {Promise<void>} Promise that resolves once the app has been mounted.
 * @throws {TypeError} If `config` is neither an object nor `undefined`. As this is an async
 * function, the error is thrown as a rejection of the returned Promise.
 * @see https://decapcms.org/docs/manual-initialization/
 * @see https://sveltiacms.app/en/docs/api/initialization
 */
const init = async ({ config } = {}) => {
  if (config !== undefined && !isObject(config)) {
    throw new TypeError('The `config` option for `CMS.init()` must be an object');
  }

  if (initialized) {
    return;
  }

  initialized = true;

  if (document.readyState === 'loading' && !document.querySelector('#nc-root')) {
    // A custom mount element (`<div id="nc-root">`) could appear after the CMS `<script>`, so just
    // wait until the page content is loaded.
    // @see https://decapcms.org/docs/custom-mounting/
    // @see https://sveltiacms.app/en/docs/customization#custom-mount-element
    await new Promise((resolve) => {
      window.addEventListener('DOMContentLoaded', () => resolve(undefined), { once: true });
    });
  }

  // Request the config file now rather than once the app has mounted and asks for it, so the
  // network round trip overlaps the mount. A manual configuration can opt out of the file
  if (config?.load_config_file !== false) {
    prefetchCmsConfig();
  }

  mount(App, {
    target: document.querySelector('#nc-root') ?? document.body,
    props: { config },
  });
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `init.d.ts` file
export { init };
