import { mount } from 'svelte';
import App from './app.svelte';

const knownFuncNames = [
  'registerCustomFormat',
  'registerEditorComponent',
  'registerEventListener',
  'registerLocale',
  'registerPreviewStyle',
  'registerPreviewTemplate',
  'registerWidget',
];

const unsupportedFuncNames = [
  'getBackend',
  'getCustomFormats',
  'getCustomFormatsExtensions',
  'getCustomFormatsFormatters',
  'getEditorComponents',
  'getEventListeners',
  'getLocale',
  'getMediaLibrary',
  'getPreviewStyles',
  'getPreviewTemplate',
  'getRemarkPlugins',
  'getWidget',
  'getWidgetValueSerializer',
  'getWidgets',
  'invokeEvent',
  'moment',
  'registerBackend',
  'registerMediaLibrary',
  'registerRemarkPlugin',
  'registerWidgetValueSerializer',
  'removeEventListener',
  'resolveWidget',
];

const compatibilityURL = 'https://github.com/sveltia/sveltia-cms#compatibility';

/**
 * Initialize the CMS, optionally with the given configuration.
 * @param {object} [options] - Options.
 * @param {object} [options.config] - Configuration to be merged with the default configuration.
 * @see https://decapcms.org/docs/manual-initialization/
 * @see https://decapcms.org/docs/custom-mounting/
 */
const init = async ({ config = {} } = {}) => {
  if (!document.querySelector('#nc-root')) {
    // A custom mount element (`<div id="nc-root">`) could appear after the CMS `<script>`, so just
    // wait until the page content is loaded
    await new Promise((resolve) => {
      window.addEventListener('DOMContentLoaded', () => resolve(undefined), { once: true });
    });
  }

  mount(App, {
    target: document.querySelector('#nc-root') ?? document.body,
    props: { config },
  });
};

const CMS = new Proxy(
  {
    init,
  },
  {
    /**
     * Define the getter.
     * @param {Record<string, Function>} obj - Object itself.
     * @param {string} key - Property name.
     * @returns {any} Property value.
     */
    get: (obj, key) => {
      if (key in obj) {
        return obj[key];
      }

      let message = '';

      if (knownFuncNames.includes(key)) {
        message = 'CMS.%s() is not yet supported in Sveltia CMS, but we plan to implement it soon.';
      }

      if (unsupportedFuncNames.includes(key)) {
        message =
          'CMS.%s() is not supported in Sveltia CMS, and we don’t have any plans to implement it.';
      }

      if (message) {
        // eslint-disable-next-line no-console
        console.error(`${message} See %s for compatibility information.`, key, compatibilityURL);

        // eslint-disable-next-line jsdoc/require-description
        /** @returns {void} */
        return () => undefined;
      }

      return undefined;
    },
  },
);

export default CMS;
export { init };

window.CMS = CMS;
window.initCMS = init;

// Automatically initialize the CMS if manual initialization is not requested AND the script is NOT
// a module; We can’t just use `document.currentScript` for module detection because the earlier
// versions of Sveltia CMS were built and shipped as modules
if (
  !window.CMS_MANUAL_INIT &&
  (!!document.currentScript ||
    !!document.querySelector('script[src$="/sveltia-cms.js"]') ||
    import.meta.env.DEV)
) {
  init();
}
