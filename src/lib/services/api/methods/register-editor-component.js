import { preloadImmutable } from '$lib/services/api/immutable';
import { customComponentRegistry } from '$lib/services/api/registries';
import {
  getSelectorTagNames,
  isValidSelector,
} from '$lib/services/contents/fields/rich-text/components/utils';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { EditorComponentDefinition } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

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

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-editor-component.d.ts` file
export { registerEditorComponent };
