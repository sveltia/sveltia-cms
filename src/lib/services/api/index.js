import { isObject } from '@sveltia/utils/object';
import BundledReact from 'react';
import { mount } from 'svelte';

import App from '$lib/components/app.svelte';
import { COMPATIBILITY_URL, UNSUPPORTED_FUNC_NAMES } from '$lib/services/api/compatibility';
import { SUPPORTED_EVENT_TYPES } from '$lib/services/api/events';
import { getFieldTypeDefinition } from '$lib/services/api/field-types';
import { preloadImmutable } from '$lib/services/api/immutable';
import { isReactComponent } from '$lib/services/api/react';
import { preloadReactDom } from '$lib/services/api/react-dom';
import {
  customComponentRegistry,
  customFieldTypeRegistry,
  customFileFormatRegistry,
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
  eventHookRegistry,
} from '$lib/services/api/registries';
import { prefetchCmsConfig } from '$lib/services/config/loader';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';
import {
  getSelectorTagNames,
  isValidSelector,
} from '$lib/services/contents/fields/rich-text/components/utils';
import { BUILTIN_FILE_FORMATS } from '$lib/services/contents/file/constants';
import { isNonEmptyString } from '$lib/services/utils/string';

import { renderRichText } from './rich-text';
// Don’t use `$lib` above, or the function will not be declared in the generated `index.d.ts` file

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

/**
 * The React instance bundled with the CMS, which renders custom preview templates, custom field
 * types and editor component previews. Hooks such as `useState` only work when taken from this
 * instance, not from another copy of React, e.g. the `react` package installed by the user.
 * @type {typeof import('react')}
 * @see https://sveltiacms.app/en/docs/api#writing-react-components
 */
const React = BundledReact;
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

/**
 * Get the definition of a field type (widget), so that a custom field type can reuse the control
 * and/or preview component of another field type. The components are React components; for a
 * built-in field type, they render the built-in Svelte components internally. Only the built-in
 * field types that work outside the entry editor can be reused: `boolean`, `color`, `datetime`,
 * `map`, `number`, `select`, `string`, `text` and `uuid`. `CMS.getWidget()` is an alias of this
 * method for compatibility with Netlify/Decap CMS.
 * @param {string} name Field type name.
 * @returns {FieldTypeDefinition | undefined} Field type definition, or `undefined` if the field
 * type is not registered or cannot be reused.
 * @throws {TypeError} If `name` is not a non-empty string.
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
const getFieldType = (name) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError('The `name` option for `CMS.getFieldType()` must be a non-empty string');
  }

  return getFieldTypeDefinition(name);
};

/**
 * Register a custom entry file format. A custom format with the same name as a built-in one, such
 * as `json`, takes precedence over it, and registering a format again replaces the previous one.
 * @param {string} name Format name. This should match the `format` option of a collection where the
 * custom format will be used.
 * @param {string} extension File extension without a leading dot, e.g. `json5`. Files in a
 * collection with the custom format use this extension, regardless of the collection’s `extension`
 * option.
 * @param {{ fromFile?: FileParser, toFile?: FileFormatter }} methods Parser and/or formatter
 * methods. Async functions can be used. Without `fromFile`, files in the format are parsed with the
 * built-in parser for the format name, if any; without `toFile`, they are formatted likewise. If
 * the format name isn’t a built-in one, such as `yaml` or `json`, omit neither: without `fromFile`,
 * files in the format can’t be loaded, and without `toFile`, saving an entry fails with an error,
 * leaving the file untouched. A warning is logged when either is missing.
 * @throws {TypeError} If `name` or `extension` is not a non-empty string, or if `fromFile` or
 * `toFile` is given but not a function.
 * @throws {Error} If neither `fromFile` nor `toFile` is provided.
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

  // Check the types first, so a method given by mistake as a non-function is reported as such
  // rather than as a missing method
  if (typeof fromFile !== 'undefined' && typeof fromFile !== 'function') {
    throw new TypeError(
      'The `fromFile` option for `CMS.registerCustomFormat()` must be a function',
    );
  }

  if (typeof toFile !== 'undefined' && typeof toFile !== 'function') {
    throw new TypeError('The `toFile` option for `CMS.registerCustomFormat()` must be a function');
  }

  if (typeof fromFile !== 'function' && typeof toFile !== 'function') {
    throw new Error(
      'At least one of `fromFile` or `toFile` must be provided to `CMS.registerCustomFormat()`',
    );
  }

  // Without a built-in method to fall back to, the format can only go one way
  if (!BUILTIN_FILE_FORMATS.includes(name)) {
    if (!fromFile) {
      // eslint-disable-next-line no-console
      console.warn(
        `The custom “${name}” format has no \`fromFile\` method, so its entries can’t be loaded`,
      );
    }

    if (!toFile) {
      // eslint-disable-next-line no-console
      console.warn(
        `The custom “${name}” format has no \`toFile\` method, so its entries can’t be saved`,
      );
    }
  }

  customFileFormatRegistry.set(name, { extension, parser: fromFile, formatter: toFile });
};

/**
 * Register a custom rich text editor component, which can be used in RichText and Markdown fields.
 * Registering a component with the same `id` again replaces the previous one.
 * @param {EditorComponentDefinition} definition Component definition.
 * @throws {TypeError} If `definition` is not an object, `id` is not a non-empty string, `label` is
 * given but not a non-empty string, `pattern` is not a regular expression, `toBlock` is not a
 * function, `toPreview` is given but not a function, `fields` is not an array, or the HTML options
 * are invalid: `htmlSelector`, `fromBlockHTML` and `toBlockHTML` must be given together, and
 * `htmlSelector` must be a valid CSS selector naming the element types it matches.
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

  if (definition.label !== undefined && !isNonEmptyString(definition.label)) {
    throw new TypeError('The `definition.label` must be a non-empty string');
  }

  if (typeof definition.pattern !== 'object' || !(definition.pattern instanceof RegExp)) {
    throw new TypeError('The `definition.pattern` must be a RegExp');
  }

  if (typeof definition.toBlock !== 'function') {
    throw new TypeError('The `definition.toBlock` must be a function');
  }

  if (definition.toPreview !== undefined && typeof definition.toPreview !== 'function') {
    throw new TypeError('The `definition.toPreview` must be a function');
  }

  if (!Array.isArray(definition.fields)) {
    throw new TypeError('The `definition.fields` must be an array');
  }

  const { htmlSelector, fromBlockHTML, toBlockHTML } = definition;
  const htmlOptions = [htmlSelector, fromBlockHTML, toBlockHTML];

  if (htmlOptions.some((option) => option !== undefined)) {
    if (htmlOptions.includes(undefined)) {
      throw new TypeError(
        'The `definition.htmlSelector`, `definition.fromBlockHTML` and `definition.toBlockHTML` ' +
          'must be given together',
      );
    }

    if (!isNonEmptyString(htmlSelector) || !isValidSelector(htmlSelector)) {
      throw new TypeError('The `definition.htmlSelector` must be a valid CSS selector');
    }

    if (!getSelectorTagNames(htmlSelector)) {
      throw new TypeError(
        'Each selector in the `definition.htmlSelector` must name the element type it matches',
      );
    }

    if (typeof fromBlockHTML !== 'function') {
      throw new TypeError('The `definition.fromBlockHTML` must be a function');
    }

    if (typeof toBlockHTML !== 'function') {
      throw new TypeError('The `definition.toBlockHTML` must be a function');
    }
  }

  customComponentRegistry.set(definition.id, definition);

  // `toPreview()` receives the component’s fields as an Immutable List, like Netlify/Decap CMS, so
  // start loading the library now if the function takes them, rather than for every component
  if ((definition.toPreview?.length ?? 0) >= 3) {
    preloadImmutable();
  }
};

/**
 * Register an event listener. Multiple listeners can be registered for the same event; they are
 * called in the order of registration.
 * @param {AppEventListener} eventListener Event listener.
 * @throws {TypeError} If the event listener is not an object, `name` is not a string, or `handler`
 * is not a function.
 * @throws {RangeError} If the event listener name is not a supported event type.
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
  // The handler receives an Immutable Map, so start loading the library now rather than when the
  // event fires
  preloadImmutable();
};

/**
 * Register a custom stylesheet to be applied to the entry preview pane. Multiple stylesheets can
 * be registered.
 * @param {string} style URL or file path of a stylesheet, or a raw CSS string if the `raw` option
 * is `true`. A relative path is resolved against the current page URL.
 * @param {object} [options] Options.
 * @param {boolean} [options.raw] Whether `style` is a raw CSS string. Default: `false`.
 * @throws {TypeError} If `style` is not a non-empty string, `raw` is not a boolean, or `style` is
 * not a valid URL or file path when `raw` is `false`.
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
 * Register a custom preview template, which replaces the default entry preview. Registering a
 * template with the same name again replaces the previous one.
 * @param {string} name Name of the entry collection, or of the file in a file/singleton collection,
 * whose entries are previewed with the template.
 * @param {CustomPreviewTemplate} component React component.
 * @throws {TypeError} If `name` is not a non-empty string or `component` is not a React component.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
const registerPreviewTemplate = (name, component) => {
  if (!isNonEmptyString(name)) {
    throw new TypeError(
      'The `name` option for `CMS.registerPreviewTemplate()` must be a non-empty string',
    );
  }

  if (!isReactComponent(component)) {
    throw new TypeError(
      'The `component` option for `CMS.registerPreviewTemplate()` must be a React component',
    );
  }

  customPreviewTemplateRegistry.set(name, component);
  // The template is a React component receiving Immutable Maps, so start loading the libraries
  // now rather than when the preview opens
  preloadImmutable();
  preloadReactDom();
};

/**
 * Register a custom field type (widget), which can be used with the `widget` field option.
 * Registering a field type with the same name again replaces the previous one.
 * `CMS.registerWidget()` is an alias of this method for compatibility with Netlify/Decap CMS.
 * @param {string} name Field type name, which cannot be the name of a built-in field type.
 * @param {CustomFieldControl | string} control React component for the edit pane, or the name of
 * another custom field type whose control is reused.
 * @param {CustomFieldPreview} [preview] React component for the preview pane. If omitted, no
 * preview is rendered for the field.
 * @param {CustomFieldSchema} [schema] JSON schema to validate the field type’s options in the CMS
 * configuration.
 * @throws {TypeError} If `name` is not a non-empty string, `control` is neither a React component
 * nor a string, `preview` is given but not a React component, or `schema` is given but not an
 * object.
 * @throws {Error} If `name` is the name of a built-in field type.
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

  if (!isReactComponent(control) && typeof control !== 'string') {
    throw new TypeError(
      'The `control` option for `CMS.registerFieldType()` must be a React component or a string',
    );
  }

  if (preview !== undefined && !isReactComponent(preview)) {
    throw new TypeError(
      'The `preview` option for `CMS.registerFieldType()` must be a React component',
    );
  }

  if (schema !== undefined && !isObject(schema)) {
    throw new TypeError('The `schema` option for `CMS.registerFieldType()` must be an object');
  }

  customFieldTypeRegistry.set(name, { control, preview, schema });
  // The components are React components receiving Immutable Maps, so start loading the libraries
  // now rather than when the editor opens
  preloadImmutable();
  preloadReactDom();
};

/**
 * The CMS object is a proxy that intercepts access to unsupported functions and logs a warning.
 * This allows users to call unsupported functions without breaking their code, while still being
 * informed that the function is not supported.
 */
const CMS = new Proxy(
  {
    React,
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
    renderRichText,
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
  React,
  registerCustomFormat,
  registerEditorComponent,
  registerEventListener,
  registerFieldType,
  registerPreviewStyle,
  registerPreviewTemplate,
  registerFieldType as registerWidget, // alias for backward compatibility with Netlify/Decap CMS
  renderRichText,
};
