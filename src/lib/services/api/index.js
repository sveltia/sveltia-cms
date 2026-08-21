import { isObject } from '@sveltia/utils/object';
import { mount } from 'svelte';

import App from '$lib/components/app.svelte';
import { COMPATIBILITY_URL, UNSUPPORTED_FUNC_NAMES } from '$lib/services/api/compatibility';
import { SUPPORTED_EVENT_TYPES } from '$lib/services/api/events';
import { getFieldTypeDefinition } from '$lib/services/api/field-types';
import {
  customComponentRegistry,
  customFieldTypeRegistry,
  customFileFormatRegistry,
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
  eventHookRegistry,
} from '$lib/services/api/registries';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import {
 * AppEventListener,
 * CmsConfig,
 * CustomFieldControl,
 * CustomFieldPreview,
 * CustomFieldSchema,
 * CustomPreviewTemplate,
 * EditorComponentDefinition,
 * FieldTypeDefinition,
 * FileFormatter,
 * FileParser,
 * } from '../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

let initialized = false;

/**
 * Initialize the CMS, optionally with the given CMS configuration.
 * @param {object} [options] Options.
 * @param {CmsConfig} [options.config] Configuration to be merged with `config.yml`. Include
 * `load_config_file: false` to prevent the configuration file from being loaded.
 * @throws {TypeError} If `config` is not an object or undefined.
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

  mount(App, {
    target: document.querySelector('#nc-root') ?? document.body,
    props: { config },
  });
};

/**
 * Get the definition of a field type (widget), so that a custom field type can reuse the control
 * and/or preview component of another field type. The components are React components; for a
 * built-in field type, they render the built-in Svelte components internally. Only the built-in
 * field types that work outside the entry editor can be reused.
 * @param {string} name Field type name.
 * @returns {FieldTypeDefinition | undefined} Field type definition, or `undefined` if the field
 * type is not registered or cannot be reused.
 * @throws {TypeError} If `name` is not a string.
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
const getFieldType = (name) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError('The `name` option for `CMS.getFieldType()` must be a non-empty string');
  }

  return getFieldTypeDefinition(name);
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
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */
const registerCustomFormat = (name, extension, { fromFile, toFile } = {}) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  }

  if (!isNonEmptyString(extension)) {
    throw new TypeError(
      'The `extension` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
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
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */
const registerEditorComponent = (definition) => {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError(
      'The `definition` option for `CMS.registerEditorComponent()` must be an object',
    );
  }

  if (!isNonEmptyString(definition.id)) {
    throw new TypeError('The `definition.id` must be a non-empty string');
  }

  if (!isNonEmptyString(definition.label)) {
    throw new TypeError('The `definition.label` must be a non-empty string');
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
};

/**
 * Register an event listener.
 * @param {AppEventListener} eventListener Event listener.
 * @throws {TypeError} If the event listener is not an object, or is missing required properties.
 * @throws {RangeError} If the event listener name is not supported.
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
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
 * @see https://sveltiacms.app/en/docs/api/preview-styles
 */
const registerPreviewStyle = (style, { raw = false } = {}) => {
  if (!isNonEmptyString(style)) {
    throw new TypeError(
      'The `style` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  }

  if (typeof raw !== 'boolean') {
    throw new TypeError('The `raw` option for `CMS.registerPreviewStyle()` must be a boolean');
  }

  const base = window.location.href;

  if (!raw && !URL.canParse(style, base)) {
    throw new TypeError(
      'The `style` option for `CMS.registerPreviewStyle()` must be a valid URL or file path ' +
        'when `raw` is false',
    );
  }

  const url = raw
    ? // Create a blob URL for the raw CSS string
      URL.createObjectURL(new Blob([style], { type: 'text/css' }))
    : // Convert relative URLs to absolute to ensure they work in the preview iframe, which has a
      // unique blob URL as its origin
      new URL(style, base).href;

  customPreviewStyleRegistry.add(url);
};

/**
 * Register a custom preview template.
 * @param {string} name Template name.
 * @param {CustomPreviewTemplate} component React component.
 * @throws {TypeError} If `name` is not a string or `component` is not a function.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
const registerPreviewTemplate = (name, component) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerPreviewTemplate()` must be a non-empty string',
    );
  }

  if (typeof component !== 'function') {
    throw new TypeError(
      'The `component` option for `CMS.registerPreviewTemplate()` must be a React component',
    );
  }

  customPreviewTemplateRegistry.set(name, component);
};

/**
 * Register a custom field type (widget).
 * @param {string} name Field type name.
 * @param {CustomFieldControl | string} control Component for the edit pane.
 * @param {CustomFieldPreview} [preview] Component for the preview pane.
 * @param {CustomFieldSchema} [schema] Field schema.
 * @throws {TypeError} If `name` is not a string, `control` is not a function or string, `preview`
 * is not a function, or `schema` is not an object.
 * @see https://decapcms.org/docs/custom-widgets/
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
const registerFieldType = (name, control, preview, schema) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerFieldType()` must be a non-empty string',
    );
  }

  if (/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(name)) {
    throw new Error(
      `The field type name "${name}" is reserved for a built-in field type. ` +
        'Choose a different name for your custom field type.',
    );
  }

  if (typeof control !== 'function' && typeof control !== 'string') {
    throw new TypeError(
      'The `control` option for `CMS.registerFieldType()` must be a React component or a string',
    );
  }

  if (preview !== undefined && typeof preview !== 'function') {
    throw new TypeError(
      'The `preview` option for `CMS.registerFieldType()` must be a React component',
    );
  }

  if (schema !== undefined && !isObject(schema)) {
    throw new TypeError('The `schema` option for `CMS.registerFieldType()` must be an object');
  }

  customFieldTypeRegistry.set(name, { control, preview, schema });
};

/**
 * The CMS object is a proxy that intercepts access to unsupported functions and logs a warning.
 * This allows users to call unsupported functions without breaking their code, while still being
 * informed that the function is not supported.
 */
const CMS = new Proxy(
  {
    getFieldType,
    getWidget: getFieldType, // alias for backward compatibility with Netlify/Decap CMS
    init,
    registerCustomFormat,
    registerEditorComponent,
    registerEventListener,
    registerFieldType,
    registerPreviewStyle,
    registerPreviewTemplate,
    registerWidget: registerFieldType, // alias for backward compatibility with Netlify/Decap CMS
  },
  {
    // eslint-disable-next-line jsdoc/require-jsdoc
    get: (obj, /** @type {string} */ key) => {
      if (key in obj) {
        // @ts-ignore
        return obj[key];
      }

      let message = '';

      if (UNSUPPORTED_FUNC_NAMES.includes(key)) {
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

// Export all the functions at once instead of `export const init`, etc. to prevent annotations from
// being stripped in the generated `index.d.ts` file
export {
  getFieldType,
  getFieldType as getWidget, // alias for backward compatibility with Netlify/Decap CMS
  init,
  registerCustomFormat,
  registerEditorComponent,
  registerEventListener,
  registerFieldType,
  registerPreviewStyle,
  registerPreviewTemplate,
  registerFieldType as registerWidget, // alias for backward compatibility with Netlify/Decap CMS
};
