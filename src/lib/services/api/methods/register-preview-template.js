import { preloadImmutable } from '$lib/services/api/immutable';
import { isReactComponent } from '$lib/services/api/react';
import { preloadReactDom } from '$lib/services/api/react-dom';
import { customPreviewTemplateRegistry } from '$lib/services/api/registries';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { CustomPreviewTemplate } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

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

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-preview-template.d.ts` file
export { registerPreviewTemplate };
