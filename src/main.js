import App from './app.svelte';

const knownFuncNames = [
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
  'registerCustomFormat',
  'registerEditorComponent',
  'registerEventListener',
  'registerLocale',
  'registerMediaLibrary',
  'registerPreviewStyle',
  'registerPreviewTemplate',
  'registerRemarkPlugin',
  'registerWidget',
  'registerWidgetValueSerializer',
  'removeEventListener',
  'resolveWidget',
];

/**
 * Initialize the CMS, optionally with the given configuration.
 * @param {object} [options] - Options.
 * @param {object} [options.config] - Configuration to be merged with the default configuration.
 * @see https://decapcms.org/docs/manual-initialization/
 * @see https://decapcms.org/docs/custom-mounting/
 */
const init = ({ config = {} } = {}) => {
  // eslint-disable-next-line no-new
  new App({
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
     * @param {{ [key: string]: Function }} obj - Object itself.
     * @param {string} key - Property name.
     * @returns {any} Property value.
     */
    get: (obj, key) => {
      if (key in obj) {
        return obj[key];
      }

      if (knownFuncNames.includes(key)) {
        // eslint-disable-next-line no-console
        console.error(
          `CMS.${key}() is not yet supported in Sveltia CMS. ` +
            'See https://github.com/sveltia/sveltia-cms#compatibility for compatibility information.',
        );

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

if (!window.CMS_MANUAL_INIT) {
  init();
}
