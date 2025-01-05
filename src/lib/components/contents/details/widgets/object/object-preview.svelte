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
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {ObjectField}
   */
  export let fieldConfig;
  /**
   * @type {object}
   */
  // svelte-ignore unused-export-let
  export let currentValue;

  $: ({
    // Widget-specific options
    fields,
    types,
    typeKey = 'type',
  } = fieldConfig);
  $: valueMap = $entryDraft?.currentValues[locale] ?? {};
  $: hasValues = Object.entries(valueMap).some(
    ([_keyPath, value]) => !!_keyPath.startsWith(`${keyPath}.`) && !!value,
  );
  $: hasVariableTypes = Array.isArray(types);
  $: typeKeyPath = `${keyPath}.${typeKey}`;
  $: typeConfig = hasVariableTypes
    ? types?.find(({ name }) => name === valueMap[typeKeyPath])
    : undefined;
  $: label = typeConfig ? typeConfig.label || typeConfig.name : undefined;
  $: subFields = (hasVariableTypes ? typeConfig?.fields : fields) ?? [];
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
