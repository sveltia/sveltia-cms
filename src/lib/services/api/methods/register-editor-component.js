import { isObject } from '@sveltia/utils/object';

import { preloadImmutable } from '$lib/services/api/immutable';
import { customComponentRegistry } from '$lib/services/api/registries';
import { assertDefinition, assertOption, assertValid } from '$lib/services/api/validate';
import { normalizeEditorComponentTemplates } from '$lib/services/config/templates';
import { isInlinePatternComponent } from '$lib/services/contents/fields/rich-text/components/inline-pattern';
import {
  getSelectorTagNames,
  isValidSelector,
} from '$lib/services/contents/fields/rich-text/components/utils';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import {
 * CustomEditorComponentDefinition,
 * EditorComponentDefinition,
 * InlineEditorComponentDefinition,
 * } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Assert that the given option of a definition is a function, if given.
 * @param {any} value Option value.
 * @param {string} name Option name.
 */
const assertOptionalFunction = (value, name) => {
  assertDefinition(value === undefined || typeof value === 'function', name, 'a function');
};

/**
 * Validate the options of a pattern-based inline component, which has the `type` option set to
 * `inline`. Like Decap CMS, `fromBlock` and `toBlock` are accepted in place of `fromInline` and
 * `toInline`.
 * @param {InlineEditorComponentDefinition} definition Component definition.
 */
const validateInlineDefinition = (definition) => {
  const { fromInline, toInline, trigger, toPreview, onInsert, onEdit } = definition;
  const { fromBlock, toBlock } = /** @type {Record<string, any>} */ (definition);

  assertDefinition(typeof (toInline ?? toBlock) === 'function', 'toInline', 'a function');
  assertOptionalFunction(fromInline ?? fromBlock, 'fromInline');
  assertOptionalFunction(toPreview, 'toPreview');
  assertOptionalFunction(onInsert, 'onInsert');
  assertOptionalFunction(onEdit, 'onEdit');

  assertDefinition(
    trigger === undefined || isNonEmptyString(trigger),
    'trigger',
    'a non-empty string',
  );
};

/**
 * Validate the options of a field-based component.
 * @param {EditorComponentDefinition} definition Component definition.
 */
const validateBlockDefinition = (definition) => {
  assertDefinition(typeof definition.toBlock === 'function', 'toBlock', 'a function');
  assertOptionalFunction(definition.toPreview, 'toPreview');
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
};

/**
 * Register a custom rich text editor component, which can be used in RichText and Markdown fields.
 * Registering a component with the same `id` again replaces the previous one. A component with the
 * `type` option set to `inline` is a pattern-based inline component, compatible with Decap CMS,
 * which has no fields.
 * @param {CustomEditorComponentDefinition} definition Component definition.
 * @throws {TypeError} If `definition` is not an object, `id` is not a non-empty string, `label` is
 * given but not a non-empty string, `pattern` is not a regular expression, `toPreview` is given
 * but not a function, or the other options are invalid. A field-based component must have
 * `toBlock` as a function and `fields` as an array, and the HTML options must be valid:
 * `htmlSelector`, `fromBlockHTML` and `toBlockHTML` must be given together, and `htmlSelector`
 * must be a valid CSS selector naming the element types it matches. An inline component must have
 * `toInline` as a function, `fromInline`, `onInsert` and `onEdit` must be functions if given, and
 * `trigger` must be a non-empty string if given.
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

  if (isInlinePatternComponent(definition)) {
    validateInlineDefinition(definition);
  } else {
    validateBlockDefinition(definition);
    // Like the configuration, the templates are written in their canonical form, e.g. `{{ slug }}`
    // as `{{slug}}`
    normalizeEditorComponentTemplates(definition);
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
