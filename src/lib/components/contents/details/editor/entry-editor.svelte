<script>
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/editor';

  /**
   * @type {LocaleCode}
   */
  export let locale;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));

  $: fields = collectionFile?.fields ?? collection?.fields;
</script>

<div lang={locale}>
  {#each fields as fieldConfig (fieldConfig.name)}
    <FieldEditor keyPath={fieldConfig.name} {locale} {fieldConfig} />
  {/each}
</div>
