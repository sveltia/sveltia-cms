<script>
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';

  /**
   * @type {LocaleCode}
   */
  export let locale;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));

  $: fields = collectionFile?.fields ?? collection?.fields;
</script>

<div>
  {#each fields as fieldConfig (fieldConfig.name)}
    <FieldPreview keyPath={fieldConfig.name} {locale} {fieldConfig} />
  {/each}
</div>

<style lang="scss">
  div {
    padding: 8px 16px;
  }
</style>
