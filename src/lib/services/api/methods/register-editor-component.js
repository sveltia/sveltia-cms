import { isObject } from '@sveltia/utils/object';

import { preloadImmutable } from '$lib/services/api/immutable';
import { customComponentRegistry } from '$lib/services/api/registries';
import { assertDefinition, assertOption, assertValid } from '$lib/services/api/validate';
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
  assertOption(isObject(definition), 'registerEditorComponent', 'definition', 'an object');
  assertDefinition(isNonEmptyString(definition.id), 'id', 'a non-empty string');

  assertDefinition(
    definition.label === undefined || isNonEmptyString(definition.label),
    'label',
    'a non-empty string',
  );

  assertDefinition(definition.pattern instanceof RegExp, 'pattern', 'a RegExp');
  assertDefinition(typeof definition.toBlock === 'function', 'toBlock', 'a function');

  assertDefinition(
    definition.toPreview === undefined || typeof definition.toPreview === 'function',
    'toPreview',
    'a function',
  );

  assertDefinition(Array.isArray(definition.fields), 'fields', 'an array');

  const { htmlSelector, fromBlockHTML, toBlockHTML } = definition;
  const htmlOptions = [htmlSelector, fromBlockHTML, toBlockHTML];

  if (htmlOptions.some((option) => option !== undefined)) {
    assertValid(
      !htmlOptions.includes(undefined),
      'The `definition.htmlSelector`, `definition.fromBlockHTML` and `definition.toBlockHTML` ' +
        'must be given together',
    );

    assertDefinition(
      isNonEmptyString(htmlSelector) && isValidSelector(htmlSelector),
      'htmlSelector',
      'a valid CSS selector',
    );

    assertValid(
      !!getSelectorTagNames(/** @type {string} */ (htmlSelector)),
      'Each selector in the `definition.htmlSelector` must name the element type it matches',
    );

    assertDefinition(typeof fromBlockHTML === 'function', 'fromBlockHTML', 'a function');
    assertDefinition(typeof toBlockHTML === 'function', 'toBlockHTML', 'a function');
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
