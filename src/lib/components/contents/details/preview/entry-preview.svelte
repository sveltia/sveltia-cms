<script>
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @typedef {object} Props
   * @property {LocaleCode} locale - Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const { collection, collectionFile } = $derived($entryDraft ?? /** @type {EntryDraft} */ ({}));
  const fields = $derived(collectionFile?.fields ?? collection?.fields ?? []);
</script>

<div role="document" aria-label={$_('content_preview')}>
  {#each fields as fieldConfig (fieldConfig.name)}
    {#await sleep(0) then}
      <FieldPreview keyPath={fieldConfig.name} {locale} {fieldConfig} />
    {/await}
  {/each}
</div>

<style lang="scss">
  div {
    padding: 8px 16px;
  }
</style>
