<!--
  @component
  Implement the preview for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { VisibilityObserver } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';
  import { escapeRegExp } from '@sveltia/utils/string';

  import Subsection from '$lib/components/contents/details/fields/object/subsection.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
  import { unflattenMap } from '$lib/services/utils/object';

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

  const { name: fieldName } = $derived(fieldConfig);
  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`));
  /** @type {Record<string, any>[]} */
  const items = $derived(
    unflattenMap(
      Object.fromEntries(
        Object.entries(getValueMapSnapshot($entryDraft, locale))
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [`${fieldName}${_keyPath.slice(keyPath.length)}`, value]),
      ),
    )[fieldName] ?? [],
  );
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
