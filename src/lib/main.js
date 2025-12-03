import { isObject } from '@sveltia/utils/object';
import createClass from 'create-react-class';
import { createElement } from 'react';
import { mount } from 'svelte';

import { eventHookRegistry, SUPPORTED_EVENT_TYPES } from '$lib/services/contents/draft/events';
import { customPreviewStyleRegistry } from '$lib/services/contents/editor';
import { customFileFormatRegistry } from '$lib/services/contents/file/config';
import { customComponentRegistry } from '$lib/services/contents/widgets/markdown/components/definitions';

import App from './components/app.svelte';

/**
 * @import { ComponentType } from 'react';
 * @import {
 * AppEventListener,
 * CmsConfig,
 * CustomPreviewTemplateProps,
 * CustomWidgetControlProps,
 * CustomWidgetPreviewProps,
 * CustomWidgetSchema,
 * EditorComponentDefinition,
 * FileFormatter,
 * FileParser,
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
 * Initialize the CMS, optionally with the given CMS configuration.
 * @param {object} [options] Options.
 * @param {CmsConfig} [options.config] Configuration to be merged with `config.yml`. Include
 * `load_config_file: false` to prevent the configuration file from being loaded.
 * @throws {TypeError} If `config` is not an object or undefined.
 * @see https://decapcms.org/docs/manual-initialization/
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
 * @throws {TypeError} If `name` or `extension` is not a string, or if `methods` is not an object.
 * @throws {Error} If at least one of `fromFile` or `toFile` is not provided.
 * @see https://decapcms.org/docs/custom-formatters/
 */
const registerCustomFormat = (name, extension, { fromFile, toFile } = {}) => {
  if (typeof name !== 'string') {
    throw new TypeError('The `name` option for `CMS.registerCustomFormat()` must be a string');
  }

  if (typeof extension !== 'string') {
    throw new TypeError('The `extension` option for `CMS.registerCustomFormat()` must be a string');
  }

  if (typeof fromFile !== 'function' && typeof toFile !== 'function') {
    throw new Error(
      'At least one of `fromFile` or `toFile` must be provided to `CMS.registerCustomFormat()`',
    );
  }

  if (typeof fromFile !== 'undefined' && typeof fromFile !== 'function') {
    throw new TypeError(
      'The `fromFile` option for `CMS.registerCustomFormat()` must be a function',
    );
  }

  if (typeof toFile !== 'undefined' && typeof toFile !== 'function') {
    throw new TypeError('The `toFile` option for `CMS.registerCustomFormat()` must be a function');
  }

  customFileFormatRegistry.set(name, { extension, parser: fromFile, formatter: toFile });
};

/**
 * Register a custom component.
 * @param {EditorComponentDefinition} definition Component definition.
 * @throws {TypeError} If `definition` is not an object, or if required properties are invalid.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 */
const registerEditorComponent = (definition) => {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError(
      'The `definition` option for `CMS.registerEditorComponent()` must be an object',
    );
  }

  if (typeof definition.id !== 'string') {
    throw new TypeError('The `definition.id` must be a string');
  }

  if (typeof definition.label !== 'string') {
    throw new TypeError('The `definition.label` must be a string');
  }

  if (typeof definition.pattern !== 'object' || !(definition.pattern instanceof RegExp)) {
    throw new TypeError('The `definition.pattern` must be a RegExp');
  }

  if (typeof definition.toBlock !== 'function') {
    throw new TypeError('The `definition.toBlock` must be a function');
  }

  if (typeof definition.toPreview !== 'function') {
    throw new TypeError('The `definition.toPreview` must be a function');
  }

  if (!Array.isArray(definition.fields)) {
    throw new TypeError('The `definition.fields` must be an array');
  }

  customComponentRegistry.set(definition.id, definition);

  // eslint-disable-next-line no-console
  console.warn('Preview for custom editor components are not yet supported in Sveltia CMS.');
};

/**
 * Register an event listener.
 * @param {AppEventListener} eventListener Event listener.
 * @throws {TypeError} If the event listener is not an object, or is missing required properties.
 * @throws {RangeError} If the event listener name is not supported.
 * @see https://decapcms.org/docs/registering-events/
 */
const registerEventListener = (eventListener) => {
  if (!isObject(eventListener)) {
    throw new TypeError('The event listener must be an object');
  }

  const { name, handler } = eventListener;

  if (typeof name !== 'string' || typeof handler !== 'function') {
    throw new TypeError(
      'The event listener must have a string `name` property and a function `handler` property',
    );
  }

  if (!SUPPORTED_EVENT_TYPES.includes(name)) {
    throw new RangeError(
      `Unsupported event listener name "${name}". ` +
        `Supported names are: ${SUPPORTED_EVENT_TYPES.join(', ')}`,
    );
  }

  eventHookRegistry.add(eventListener);
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
  console.warn('Custom preview templates are not yet supported in Sveltia CMS.');
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
  console.warn('Custom widgets are not yet supported in Sveltia CMS.');
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
        console.warn(`${message} See %s for compatibility information.`, key, COMPATIBILITY_URL);

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

// Expose React APIs for custom widgets, custom preview templates and custom editor components
// @see https://decapcms.org/docs/custom-widgets/
// @see https://decapcms.org/docs/customization/
window.createClass = createClass;
window.createElement = createElement;
window.h = createElement;

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
