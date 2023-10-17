import App from './app.svelte';

const app = new App({ target: document.getElementById('nc-root') ?? document.body });

export default app;

window.CMS = new Proxy(
  {},
  {
    /**
     * Define the getter.
     * @param {{ [key: string]: Function }} obj Object itself.
     * @param {string} key Property name.
     * @returns {any} Property value.
     */
    get: (obj, key) => {
      if (key in obj) {
        return obj[key];
      }

      const knownFuncNames = [
        'getBackend',
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
        'init',
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

      if (knownFuncNames.includes(key)) {
        // eslint-disable-next-line no-console
        console.error(
          `CMS.${key}() is not yet supported in Sveltia CMS. ` +
            `See https://github.com/sveltia/sveltia-cms#readme for compatibility information.`,
        );

        /** @returns {void} */
        return () => undefined;
      }

      return undefined;
    },
  },
);
