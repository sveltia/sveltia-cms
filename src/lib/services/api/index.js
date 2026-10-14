import BundledReact from 'react';

import { COMPATIBILITY_URL, UNSUPPORTED_FUNC_NAMES } from '$lib/services/api/compatibility';

import { getFieldType } from './methods/get-field-type';
import { init } from './methods/init';
import { registerCustomFormat } from './methods/register-custom-format';
import { registerCustomPage } from './methods/register-custom-page';
import { registerEditorComponent } from './methods/register-editor-component';
import { registerEventListener } from './methods/register-event-listener';
import { registerFieldType } from './methods/register-field-type';
import { registerPreviewStyle } from './methods/register-preview-style';
import { registerPreviewTemplate } from './methods/register-preview-template';
import { registerStringTransformation } from './methods/register-string-transformation';
import { renderRichText } from './methods/render-rich-text';
// Don’t use `$lib` above, or the functions will not be declared in the generated `index.d.ts` file

/**
 * The React instance bundled with the CMS, which renders custom preview templates, custom field
 * types and editor component previews. Hooks such as `useState` only work when taken from this
 * instance, not from another copy of React, e.g. the `react` package installed by the user.
 * @type {typeof import('react')}
 * @see https://sveltiacms.app/en/docs/api#writing-react-components
 */
const React = BundledReact;

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
    registerCustomPage,
    registerEditorComponent,
    registerEventListener,
    registerFieldType,
    registerPreviewStyle,
    registerPreviewTemplate,
    registerStringTransformation,
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
  registerCustomPage,
  registerEditorComponent,
  registerEventListener,
  registerFieldType,
  registerPreviewStyle,
  registerPreviewTemplate,
  registerStringTransformation,
  registerFieldType as registerWidget, // alias for backward compatibility with Netlify/Decap CMS
  renderRichText,
};
