<!--
  @component
  Implement the preview for an Object field.
  @see https://decapcms.org/docs/widgets/#Object
  @see https://sveltiacms.app/en/docs/fields/object
-->
<script>
  import SubfieldPreviews from '$lib/components/contents/details/fields/object/subfield-previews.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
  import { isValueEmpty } from '$lib/services/utils/object';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import {
   * ObjectField,
   * ObjectFieldWithSubFields,
   * ObjectFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let { locale, keyPath, typedKeyPath, fieldConfig } = $props();

  const { fields } = $derived(/** @type {ObjectFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ObjectFieldWithTypes} */ (fieldConfig));
  const valueMap = $derived(getFieldValueMapSnapshot(entryDraft.current, locale, keyPath));
  // Ask the shared key path index rather than scanning the whole value map, like the Object field
  // editor does. Unlike the editor, which asks whether the object is there at all, this asks
  // whether there’s anything to show: a number, `0` included, is, but `false`, which a Boolean
  // field holds until it’s turned on, isn’t
  const hasValues = $derived(
    getKeysByPrefix(valueMap, `${keyPath}.`).some((_keyPath) => {
      const value = valueMap[_keyPath];

      return value !== false && !isValueEmpty(value);
    }),
  );
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const type = $derived(hasVariableTypes ? valueMap[typeKeyPath] : undefined);
</script>

{#if hasValues}
  <SubfieldPreviews {locale} {keyPath} {typedKeyPath} {types} {fields} {type} />
{/if}
