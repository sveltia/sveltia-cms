<script>
  import { sleep } from '@sveltia/utils/misc';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @type {LocaleCode}
   */
  export let locale;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));

  $: fields = collectionFile?.fields ?? collection?.fields ?? [];
</script>

{#each fields as fieldConfig (fieldConfig.name)}
  {#await sleep(0) then}
    <FieldEditor keyPath={fieldConfig.name} {locale} {fieldConfig} />
  {/await}
{/each}
