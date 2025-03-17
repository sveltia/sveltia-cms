<!--
  @component
  Implement the preview for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import { sleep } from '@sveltia/utils/misc';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import Subsection from '$lib/components/contents/details/widgets/object/subsection.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Widget-specific options
    fields,
    types,
    typeKey = 'type',
  } = $derived(fieldConfig);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale]) ?? {});
  const hasValues = $derived(
    Object.entries(valueMap).some(
      ([_keyPath, value]) => !!_keyPath.startsWith(`${keyPath}.`) && !!value,
    ),
  );
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const typeConfig = $derived(
    hasVariableTypes ? types?.find(({ name }) => name === valueMap[typeKeyPath]) : undefined,
  );
  const label = $derived(typeConfig ? typeConfig.label || typeConfig.name : undefined);
  const subFields = $derived((hasVariableTypes ? typeConfig?.fields : fields) ?? []);
</script>

{#if hasValues}
  <Subsection {label}>
    {#each subFields as subField (subField.name)}
      {#await sleep(0) then}
        <FieldPreview
          keyPath={[keyPath, subField.name].join('.')}
          {locale}
          fieldConfig={subField}
        />
      {/await}
    {/each}
  </Subsection>
{/if}
