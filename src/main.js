import App from './app.svelte';

const app = new App({ target: document.getElementById('nc-root') || document.body });

export default app;

window.CMS = new Proxy(
  {},
  {
    // eslint-disable-next-line jsdoc/require-jsdoc
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

        return () => undefined;
      }

      return undefined;
    },
  },
);
