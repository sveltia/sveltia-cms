import { isObject } from '@sveltia/utils/object';

import { isReactComponent } from '$lib/services/api/react';
import { preloadReactDom } from '$lib/services/api/react-dom';
import { customPageRegistry } from '$lib/services/api/registries';
import {
  assertDefinition,
  assertOption,
  assertValid,
  parseURLFromPage,
} from '$lib/services/api/validate';
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
  assertOption(isObject(definition), 'registerCustomPage', 'definition', 'an object');

  const { id, label, icon, component, url, newTab } = definition;

  // The ID goes into the page’s URL path as is, so keep it to characters that need no encoding
  assertDefinition(
    typeof id === 'string' && /^[\w-]+$/.test(id),
    'id',
    'a non-empty string of alphanumeric characters, hyphens and underscores',
  );

  assertDefinition(isNonEmptyString(label), 'label', 'a non-empty string');
  assertDefinition(icon === undefined || isNonEmptyString(icon), 'icon', 'a non-empty string');

  assertValid(
    (component === undefined) !== (url === undefined),
    'Either `definition.component` or `definition.url` must be given',
  );

  assertDefinition(
    component === undefined || isReactComponent(component),
    'component',
    'a React component',
  );

  assertDefinition(
    newTab === undefined || (typeof newTab === 'boolean' && component === undefined),
    'newTab',
    'a boolean given along with `url`',
  );

  /** @type {string | undefined} */
  let resolvedURL = undefined;

  if (url !== undefined) {
    // Resolve a relative URL now. Other schemes are rejected, so that a `javascript:` URL can’t run
    // in the CMS
    const parsedURL = isNonEmptyString(url) ? parseURLFromPage(url) : null;

    assertDefinition(
      !!parsedURL && ['http:', 'https:'].includes(parsedURL.protocol),
      'url',
      'a valid `http` or `https` URL or file path',
    );

    resolvedURL = /** @type {URL} */ (parsedURL).href;
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
