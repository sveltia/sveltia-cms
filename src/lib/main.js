/* eslint-disable no-console */

import createClass from 'create-react-class';
import { createElement, Fragment } from 'react';

import CMS, { init } from './services/api';

export default CMS;
export * from './services/api';
// Don’t use `$lib` above, or type declarations will not be exported

window.CMS = CMS;
window.initCMS = init;

// Expose React APIs for custom field types, custom preview templates and custom editor components
// @see https://decapcms.org/docs/custom-widgets/
// @see https://decapcms.org/docs/customization/
// @see https://sveltiacms.app/en/docs/api/field-types
// @see https://sveltiacms.app/en/docs/api/preview-templates
window.createClass = createClass;
window.createElement = createElement;
window.h = createElement;
window.rf = Fragment;

const cssLinkElement = document.querySelector('link[rel="stylesheet"][href$="/sveltia-cms.css"]');

// Warn if an invalid stylesheet is included. Claude tends to add it when setting up Sveltia CMS.
if (cssLinkElement) {
  console.warn(
    'Sveltia CMS does not require a stylesheet. Remove the invalid `<link>` tag referencing ' +
      '`sveltia-cms.css` to avoid unnecessary network requests.',
  );
}

const scriptElement = /** @type {HTMLScriptElement | null} */ (
  document.querySelector('script[src$="/sveltia-cms.js"]')
);

// Warn if the CMS script comes with `type="module"`. Earlier versions of Sveltia CMS were built and
// shipped as ES modules. Therefore, some users may have added the attribute to the script tag.
// Additionally, Claude tends to add it due to outdated/inaccurate knowledge. We recommend removing
// the attribute from the CMS script tag to avoid unexpected behavior.
if (scriptElement?.type === 'module') {
  console.warn(
    'The Sveltia CMS script is not an ES module. Remove the "type="module" attribute from the ' +
      '`<script>` tag to avoid unexpected behavior when using the JavaScript API.',
  );
}

const netlifyIdentityScriptElement = /** @type {HTMLScriptElement | null} */ (
  document.querySelector('script[src="https://identity.netlify.com/v1/netlify-identity-widget.js"]')
);

// Warn if Netlify Identity Widget is included, as it’s not compatible with Sveltia CMS.
if (netlifyIdentityScriptElement) {
  console.warn('Netlify Identity Widget is not supported in Sveltia CMS.');
}

// Automatically initialize the CMS if manual initialization is not requested AND the script is NOT
// a module; We can’t just use `document.currentScript` for module detection because the earlier
// versions of Sveltia CMS were built and shipped as modules
if (!window.CMS_MANUAL_INIT && (document.currentScript || scriptElement || import.meta.env.DEV)) {
  init();
}
