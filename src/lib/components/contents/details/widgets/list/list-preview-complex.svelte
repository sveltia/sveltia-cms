<!--
  @component
  Implement the preview for the List widget with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
-->
<script>
  import { isObject } from '@sveltia/utils/object';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import Subsection from '$lib/components/contents/details/widgets/object/subsection.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[] | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    name: fieldName,
    // Widget-specific options
    field,
    fields,
    types,
    typeKey = 'type',
  } = $derived(fieldConfig);
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
        {@const subFieldKeyPath = field ? itemKeyPath : `${itemKeyPath}.${subField.name}`}
        <VisibilityObserver>
          <FieldPreview
            keyPath={subFieldKeyPath}
            typedKeyPath={subFieldName
              ? field
                ? `${keyPath}.*<${subFieldName}>`
                : `${keyPath}.*<${subFieldName}>.${subField.name}`
              : subFieldKeyPath}
            {locale}
            fieldConfig={subField}
          />
        </VisibilityObserver>
      {/each}
    </Subsection>
  </VisibilityObserver>
{/each}
