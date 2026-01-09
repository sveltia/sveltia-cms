<!--
  @component
  Implement the preview for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { isObject } from '@sveltia/utils/object';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import Subsection from '$lib/components/contents/details/fields/object/subsection.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getListFieldInfo } from '$lib/services/contents/fields/list/helper';

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
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const { name: fieldName } = $derived(fieldConfig);
  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`));
  const items = $derived(
    unflatten(
      Object.fromEntries(
        Object.entries($state.snapshot($entryDraft?.currentValues[locale]) ?? {})
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
      ),
    )[fieldName] ?? [],
  );
</script>

{#each items as item, index (isObject(item) ? (item.__sc_item_id ?? index) : index)}
  <VisibilityObserver>
    {@const itemKeyPath = `${keyPath}.${index}`}
    {@const subFieldName = Array.isArray(types)
      ? $entryDraft?.currentValues[locale][`${itemKeyPath}.${typeKey}`]
      : undefined}
    {@const typeConfig = types?.find(({ name }) => name === subFieldName)}
    {@const label = typeConfig ? typeConfig.label || typeConfig.name : undefined}
    {@const subFields = subFieldName
      ? (typeConfig?.fields ?? [])
      : (fields ?? (field ? [field] : []))}
    <Subsection {label}>
      {#each subFields as subField (subField.name)}
        <VisibilityObserver>
          <FieldPreview
            keyPath={hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${subField.name}`}
            typedKeyPath={hasVariableTypes
              ? `${keyPath}.*<${subFieldName}>.${subField.name}`
              : `${keyPath}.*.${subField.name}`}
            {locale}
            fieldConfig={subField}
          />
        </VisibilityObserver>
      {/each}
    </Subsection>
  </VisibilityObserver>
{/each}
