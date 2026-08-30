<!--
  @component
  Implement the preview for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { VisibilityObserver } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';

  import Subsection from '$lib/components/contents/details/fields/object/subsection.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getSubtree } from '$lib/services/contents/entry/subtree';
  import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';

  /**
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

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  /** @type {Record<string, any>[]} */
  const items = $derived(getSubtree(getValueMapSnapshot($entryDraft, locale), keyPath) ?? []);
</script>

{#each items as item, index (isObject(item) ? (item.__sc_item_id ?? index) : index)}
  <VisibilityObserver>
    {@const type = hasVariableTypes ? item[typeKey] : undefined}
    {@const typeConfig = type ? types?.find(({ name }) => name === type) : undefined}
    {#if hasVariableTypes && !typeConfig}
      <!-- Unknown type: a warning is displayed in the editor -->
    {:else}
      {@const itemKeyPath = `${keyPath}.${index}`}
      {@const label = typeConfig ? typeConfig.label || typeConfig.name : undefined}
      {@const subFields = hasVariableTypes
        ? (typeConfig?.fields ?? [])
        : (fields ?? (field ? [field] : []))}
      <Subsection {label}>
        {#each subFields as subField (subField.name)}
          <VisibilityObserver>
            <FieldPreview
              keyPath={hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${subField.name}`}
              typedKeyPath={hasVariableTypes
                ? `${typedKeyPath}.*<${type}>.${subField.name}`
                : `${typedKeyPath}.*.${subField.name}`}
              {locale}
              fieldConfig={subField}
            />
          </VisibilityObserver>
        {/each}
      </Subsection>
    {/if}
  </VisibilityObserver>
{/each}
