<script>
  import { sleep } from '@sveltia/utils/misc';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived($entryDraft?.fields ?? []);
</script>

{#each fields as fieldConfig (fieldConfig.name)}
  {#await sleep() then}
    <FieldEditor keyPath={fieldConfig.name} {locale} {fieldConfig} />
  {/await}
{/each}
