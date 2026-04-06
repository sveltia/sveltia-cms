<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getBacklinks } from '$lib/services/contents/entry/backlinks';

  /**
   * @import { EntryBacklink } from '$lib/types/private';
   */

  /** @type {EntryBacklink[]} */
  const backlinks = $derived.by(() => {
    const draft = $entryDraft;

    if (!draft?.originalEntry) {
      return [];
    }

    return getBacklinks({
      collectionName: draft.collectionName,
      fileName: draft.fileName,
      entry: draft.originalEntry,
    });
  });

  /**
   * @typedef {{ collectionLabel: string, items: EntryBacklink[] }} EntryBacklinkGroup
   */

  /** @type {EntryBacklinkGroup[]} */
  const groupedEntries = $derived.by(() => {
    /** @type {EntryBacklinkGroup[]} */
    const groups = [];

    backlinks.forEach((ref) => {
      const existing = groups.find((g) => g.collectionLabel === ref.collectionLabel);

      if (existing) {
        existing.items.push(ref);
      } else {
        groups.push({ collectionLabel: ref.collectionLabel, items: [ref] });
      }
    });

    return groups;
  });
</script>

<PanelContainer title={_('entry_sidebar.backlinks.title')}>
  {#if backlinks.length > 0}
    {#each groupedEntries as { collectionLabel, items } (collectionLabel)}
      <section class="collection" role="group">
        <h4>{collectionLabel}</h4>
        {#each items as ref (ref.entry.id)}
          <Button
            class="ref"
            variant="ghost"
            onclick={() => {
              goto(`/collections/${ref.collectionName}/entries/${ref.entry.subPath}`, {
                transitionType: 'forwards',
              });
            }}
          >
            <span class="summary">{ref.summary}</span>
          </Button>
        {/each}
      </section>
    {/each}
  {:else}
    <div class="empty">{_('entry_sidebar.backlinks.no_entries')}</div>
  {/if}
</PanelContainer>

<style lang="scss">
  .collection {
    padding: 4px;

    &:not(:first-child) {
      border-top: 2px solid var(--sui-secondary-background-color);
    }
  }
</style>
