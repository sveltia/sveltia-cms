import { isObject } from '@sveltia/utils/object';

import { isReactComponent } from '$lib/services/api/react';
import { preloadReactDom } from '$lib/services/api/react-dom';
import { customPageRegistry } from '$lib/services/api/registries';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { CustomPageDefinition } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Register a custom page, which is listed in the global toolbar, or in the Menu on small screens.
 * The page renders a React component, or embeds a web page in an iframe. With the `newTab` option,
 * the web page is opened in a new browser tab instead. Pages are listed in the order of
 * registration, and registering a page with the same `id` again replaces the previous one in place.
 * @param {CustomPageDefinition} definition Page definition.
 * @throws {TypeError} If `definition` is not an object, `id` is not a string of alphanumeric
 * characters, hyphens and underscores, `label` is not a non-empty string, `icon` is given but not a
 * non-empty string, neither or both of `component` and `url` are given, `component` is not a React
 * component, `url` is not a valid `http` or `https` URL or file path, or `newTab` is given but not
 * a boolean or along with `component`.
 * @see https://sveltiacms.app/en/docs/api/custom-pages
 */
const registerCustomPage = (definition) => {
  if (!isObject(definition)) {
    throw new TypeError('The `definition` option for `CMS.registerCustomPage()` must be an object');
  }

  const { id, label, icon, component, url, newTab } = definition;

  // The ID goes into the page’s URL path as is, so keep it to characters that need no encoding
  if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) {
    throw new TypeError(
      'The `definition.id` must be a non-empty string of alphanumeric characters, hyphens and ' +
        'underscores',
    );
  }

  if (!isNonEmptyString(label)) {
    throw new TypeError('The `definition.label` must be a non-empty string');
  }

  if (icon !== undefined && !isNonEmptyString(icon)) {
    throw new TypeError('The `definition.icon` must be a non-empty string');
  }

  if ((component === undefined) === (url === undefined)) {
    throw new TypeError('Either `definition.component` or `definition.url` must be given');
  }

  if (component !== undefined && !isReactComponent(component)) {
    throw new TypeError('The `definition.component` must be a React component');
  }

  if (newTab !== undefined && (typeof newTab !== 'boolean' || component !== undefined)) {
    throw new TypeError('The `definition.newTab` must be a boolean given along with `url`');
  }

  /** @type {string | undefined} */
  let resolvedURL = undefined;

  if (url !== undefined) {
    // Resolve a relative URL now, as the CMS URL hash changes as the user navigates. Other schemes
    // are rejected, so that a `javascript:` URL can’t run in the CMS
    const parsedURL = isNonEmptyString(url) ? URL.parse(url, window.location.href) : null;

    if (!parsedURL || !['http:', 'https:'].includes(parsedURL.protocol)) {
      throw new TypeError(
        'The `definition.url` must be a valid `http` or `https` URL or file path',
      );
    }

    resolvedURL = parsedURL.href;
  }

  customPageRegistry.set(id, {
    id,
    label,
    icon: icon ?? 'extension',
    component,
    url: resolvedURL,
    newTab: newTab ?? false,
  });

  if (component) {
    preloadReactDom();
  }
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-custom-page.d.ts` file
export { registerCustomPage };
