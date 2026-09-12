<!--
  @component
  “Used in” section of the asset info panel, listing the entries that reference the asset with
  links to the entry editor. Shared by repository assets and assets on external locations.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import { goto } from '$lib/services/app/navigation';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import {
    getCollectionFileLabel,
    getCollectionFilesByEntry,
  } from '$lib/services/contents/collection/files';
  import { getAssociatedCollections } from '$lib/services/contents/entry';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Entry[] | undefined} entries Entries using the asset. `undefined` while the
   * information is being fetched.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entries,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#snippet usedEntryLink(
  /** @type {Record<string, string>} */ { link, collectionLabel, entryLabel },
)}
  <p>
    <Button role="link" variant="link" onclick={() => goto(link, { transitionType: 'forwards' })}>
      <span role="none">{collectionLabel} › {entryLabel}</span>
    </Button>
  </p>
{/snippet}

<section>
  <h4>{_('used_in')}</h4>
  {#if !entries}
    <p>{_('loading')}</p>
  {:else}
    {#each entries as entry (entry.id)}
      {#each getAssociatedCollections(entry) as collection (collection.name)}
        {#key appLocale.current}
          {@const collectionLabel = getCollectionLabel(collection)}
          {#each getCollectionFilesByEntry(collection, entry) as file (file.name)}
            {@render usedEntryLink({
              link: `/collections/${collection.name}/entries/${file.name}`,
              collectionLabel,
              entryLabel: getCollectionFileLabel(file),
            })}
          {:else}
            {@render usedEntryLink({
              link: `/collections/${collection.name}/entries/${entry.subPath}`,
              collectionLabel,
              entryLabel: getEntrySummary(collection, entry, { useTemplate: true }),
            })}
          {/each}
        {/key}
      {/each}
    {:else}
      <p>{_('sort_keys.none')}</p>
    {/each}
  {/if}
</section>
