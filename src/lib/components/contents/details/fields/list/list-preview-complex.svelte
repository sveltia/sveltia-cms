<!--
  @component
  Implement the preview for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { VisibilityObserver } from '@sveltia/ui';

  import SubfieldPreviews from '$lib/components/contents/details/fields/object/subfield-previews.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getMemoizedSubtree } from '$lib/services/contents/entry/subtree';
  import { getListFieldInfo, getListItemKey } from '$lib/services/contents/fields/list/helpers';

  /**
   * @import { SubtreeMemo } from '$lib/services/contents/entry/subtree';
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import {
   * ComplexListField,
   * ListFieldWithSubField,
   * ListFieldWithSubFields,
   * ListFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComplexListField} fieldConfig Field configuration.
   * @property {string[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let { locale, keyPath, typedKeyPath, fieldConfig } = $props();

  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  /* v8 ignore start -- a list field has either subfields or a single subfield */
  const singleSubFields = $derived(fields ?? (field ? [field] : []));
  /* v8 ignore stop */
  /**
   * What the items were last assembled from, so they’re only assembled again once they’ve changed.
   * A plain object, as it’s only a memo.
   * @type {SubtreeMemo}
   */
  const itemsMemo = {};
  /** @type {Record<string, any>[]} */
  const items = $derived(
    getMemoizedSubtree(
      itemsMemo,
      getFieldValueMapSnapshot(entryDraft.current, locale, keyPath),
      keyPath,
    ) ?? [],
  );
  /**
   * The variable type of each item, or `undefined` for a list without variable types. The `each`
   * block below iterates over these primitives rather than over the items: the items are rebuilt
   * from the snapshot on every update, and a keyed `each` block over them would rewrite the source
   * of every item on every keystroke, which Svelte then walks through every nested preview.
   * @type {(string | undefined)[]}
   */
  const itemTypes = $derived(items.map((item) => (hasVariableTypes ? item[typeKey] : undefined)));
</script>

{#each itemTypes as type, index (getListItemKey(items, index))}
  {@const itemKeyPath = `${keyPath}.${index}`}
  <!-- Mark the item outside its observer, so that focusing a field in it can scroll the preview to
    the item even before it’s rendered -->
  <div role="none" data-lazy-key-path={itemKeyPath}>
    <VisibilityObserver>
      <SubfieldPreviews
        {locale}
        keyPath={itemKeyPath}
        typedKeyPath="{typedKeyPath}.*"
        types={hasVariableTypes ? types : undefined}
        fields={singleSubFields}
        {type}
        single={hasSingleSubField}
      />
    </VisibilityObserver>
  </div>
{/each}
