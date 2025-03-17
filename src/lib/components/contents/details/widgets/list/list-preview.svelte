<!--
  @component
  Implement the preview for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { sleep } from '@sveltia/utils/misc';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import Subsection from '$lib/components/contents/details/widgets/object/subsection.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { WidgetPreviewProps } from '$lib/typedefs/private';
   * @import { ListField } from '$lib/typedefs/public';
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
    currentValue,
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
  const hasSubFields = $derived(!!(field ?? fields ?? types));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`));
  const listFormatter = $derived(getListFormatter(locale));
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

{#if hasSubFields}
  <!-- eslint-disable-next-line no-unused-vars -->
  {#each items as item, index}
    {@const subFieldName = Array.isArray(types)
      ? $entryDraft?.currentValues[locale][`${keyPath}.${index}.${typeKey}`]
      : undefined}
    {@const typeConfig = types?.find(({ name }) => name === subFieldName)}
    {@const label = typeConfig ? typeConfig.label || typeConfig.name : undefined}
    {@const subFields = subFieldName
      ? (typeConfig?.fields ?? [])
      : (fields ?? (field ? [field] : []))}
    <Subsection {label}>
      {#each subFields as subField (subField.name)}
        {#await sleep(0) then}
          <FieldPreview
            keyPath={field ? `${keyPath}.${index}` : `${keyPath}.${index}.${subField.name}`}
            {locale}
            fieldConfig={subField}
          />
        {/await}
      {/each}
    </Subsection>
  {/each}
{:else if Array.isArray(currentValue) && currentValue.length}
  <p lang={locale} dir="auto">{listFormatter.format(currentValue)}</p>
{/if}
