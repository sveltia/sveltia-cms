<!--
  @component
  Implement the preview for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
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

  $: ({ fields } = fieldConfig);
  $: valueMap = $entryDraft?.currentValues[locale] ?? {};
  $: hasValues = Object.keys(valueMap).some((_keyPath) => _keyPath.startsWith(`${keyPath}.`));
</script>

{#if hasValues}
  <section class="subsection">
    {#each fields as subField (subField.name)}
      <FieldPreview keyPath={[keyPath, subField.name].join('.')} {locale} fieldConfig={subField} />
    {/each}
  </section>
{/if}
