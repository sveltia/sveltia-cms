import { mount } from 'svelte';

import { customPreviewStyleRegistry } from '$lib/services/contents/editor';
import { customFileFormatRegistry } from '$lib/services/contents/file/config';
import { customComponentRegistry } from '$lib/services/contents/widgets/markdown/components/definitions';

import App from './components/app.svelte';

/**
 * @import { ComponentType } from 'react';
 * @import {
 * AppEventListener,
 * CustomPreviewTemplateProps,
 * CustomWidgetControlProps,
 * CustomWidgetPreviewProps,
 * CustomWidgetSchema,
 * EditorComponentDefinition,
 * FileFormatter,
 * FileParser,
 * SiteConfig,
 * } from './types/public';
 * // Don’t use `$lib` in `from` above, or type declarations will not be exported
 */

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
  'registerLocale',
  'registerMediaLibrary',
  'registerRemarkPlugin',
  'registerWidgetValueSerializer',
  'removeEventListener',
  'resolveWidget',
];

const COMPATIBILITY_URL = 'https://github.com/sveltia/sveltia-cms#compatibility';
let initialized = false;

/**
 * Initialize the CMS, optionally with the given site configuration.
 * @param {object} [options] Options.
 * @param {SiteConfig} [options.config] Configuration to be merged with `config.yml`. Include
 * `load_config_file: false` to prevent the configuration file from being loaded.
 * @see https://decapcms.org/docs/manual-initialization/
 */
const init = async ({ config } = {}) => {
  if (initialized) {
    return;
  }

  initialized = true;

  if (document.readyState === 'loading' && !document.querySelector('#nc-root')) {
    // A custom mount element (`<div id="nc-root">`) could appear after the CMS `<script>`, so just
    // wait until the page content is loaded. https://decapcms.org/docs/custom-mounting/
    await new Promise((resolve) => {
      window.addEventListener('DOMContentLoaded', () => resolve(undefined), { once: true });
    });
  }

  mount(App, {
    target: document.querySelector('#nc-root') ?? document.body,
    props: { config },
  });
};

/**
 * Register a custom entry file format.
 * @param {string} name Format name. This should match the `format` option of a collection where the
 * custom format will be used..
 * @param {string} extension File extension.
 * @param {{ fromFile?: FileParser, toFile?: FileFormatter }} methods Parser and/or formatter
 * methods. Async functions can be used.
 * @see https://decapcms.org/docs/custom-formatters/
 */
const registerCustomFormat = (name, extension, { fromFile, toFile }) => {
  customFileFormatRegistry.set(name, { extension, parser: fromFile, formatter: toFile });
};

/**
 * Register a custom component.
 * @param {EditorComponentDefinition} definition Component definition.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 */
const registerEditorComponent = (definition) => {
  customComponentRegistry.set(definition.id, definition);
};

/**
 * Register an event listener.
 * @param {AppEventListener} eventListener Event listener.
 * @see https://decapcms.org/docs/registering-events/
 */
const registerEventListener = (eventListener) => {
  // eslint-disable-next-line no-console
  console.error('Event hooks are not yet supported in Sveltia CMS.');
  void [eventListener];
};

/**
 * Register a custom preview stylesheet.
 * @param {string} style URL, file path or raw CSS string.
 * @param {object} [options] Options.
 * @param {boolean} [options.raw] Whether to use a CSS string.
 * @throws {TypeError} If `style` is not a string, or `raw` is not a boolean.
 * @see https://decapcms.org/docs/customization/#registerpreviewstyle
 */
const registerPreviewStyle = (style, { raw = false } = {}) => {
  if (typeof style !== 'string') {
    throw new TypeError('The `style` option for `CMS.registerPreviewStyle()` must be a string');
  }

  if (typeof raw !== 'boolean') {
    throw new TypeError('The `raw` option for `CMS.registerPreviewStyle()` must be a boolean');
  }

  const url = raw ? URL.createObjectURL(new Blob([style], { type: 'text/css' })) : style;

  customPreviewStyleRegistry.add(url);
};

/**
 * Register a custom preview template.
 * @param {string} name Template name.
 * @param {ComponentType<CustomPreviewTemplateProps>} component React component.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 */
const registerPreviewTemplate = (name, component) => {
  // eslint-disable-next-line no-console
  console.error('Custom preview templates are not yet supported in Sveltia CMS.');
  void [name, component];
};

/**
 * Register a custom widget.
 * @param {string} name Widget name.
 * @param {ComponentType<CustomWidgetControlProps> | string} control Component for the edit pane.
 * @param {ComponentType<CustomWidgetPreviewProps>} [preview] Component for the preview pane.
 * @param {CustomWidgetSchema} [schema] Field schema.
 * @see https://decapcms.org/docs/custom-widgets/
 */
const registerWidget = (name, control, preview, schema) => {
  // eslint-disable-next-line no-console
  console.error('Custom widgets are not yet supported in Sveltia CMS.');
  void [name, control, preview, schema];
};

const CMS = new Proxy(
  {
    init,
    registerCustomFormat,
    registerEditorComponent,
    registerEventListener,
    registerPreviewStyle,
    registerPreviewTemplate,
    registerWidget,
  },
  {
    // eslint-disable-next-line jsdoc/require-jsdoc
    get: (obj, /** @type {string} */ key) => {
      if (key in obj) {
        // @ts-ignore
        return obj[key];
      }

      let message = '';

      if (unsupportedFuncNames.includes(key)) {
        message =
          'CMS.%s() is not supported in Sveltia CMS, and we don’t have any plans to implement it.';
      }

      if (message) {
        // eslint-disable-next-line no-console
        console.error(`${message} See %s for compatibility information.`, key, COMPATIBILITY_URL);

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
