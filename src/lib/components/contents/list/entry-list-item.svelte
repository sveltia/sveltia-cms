<script>
  import { Checkbox, GridCell, GridRow, Icon, TruncatedText } from '@sveltia/ui';
  import { locale as appLocale } from 'svelte-i18n';
  import Image from '$lib/components/assets/shared/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import {
    getIndexFileIcon,
    isCollectionIndexFile,
  } from '$lib/services/contents/collection/index-file';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { Entry, EntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {EntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Update the entry selection.
   * @param {boolean} selected Whether the current entry item is selected.
   */
  const updateSelection = (selected) => {
    selectedEntries.update((entries) => {
      const index = entries.indexOf(entry);

      if (selected && index === -1) {
        entries.push(entry);
      }

      if (!selected && index > -1) {
        entries.splice(index, 1);
      }

      return entries;
    });
  };
</script>

<GridRow
  aria-rowindex={$listedEntries.indexOf(entry)}
  onChange={(event) => {
    updateSelection(event.detail.selected);
  }}
  onclick={() => {
    goto(`/collections/${collection.name}/entries/${entry.subPath}`, {
      transitionType: 'forwards',
    });
  }}
>
  {#if !($isSmallScreen || $isMediumScreen)}
    <GridCell class="checkbox">
      <Checkbox
        role="none"
        tabindex="-1"
        checked={$selectedEntries.includes(entry)}
        onChange={({ detail: { checked } }) => {
          updateSelection(checked);
        }}
      />
    </GridCell>
  {/if}
  {#if collection._thumbnailFieldNames.length}
    <GridCell class="image">
      {#await getEntryThumbnail(collection, entry) then src}
        {#if src}
          <Image {src} variant={viewType === 'list' ? 'icon' : 'tile'} cover />
        {/if}
      {/await}
    </GridCell>
  {/if}
  <GridCell class="title">
    <div role="none" class="label">
      <TruncatedText lines={2}>
        {#key $appLocale}
          {@html getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true })}
        {/key}
        {#if isCollectionIndexFile(collection, entry)}
          <Icon name={getIndexFileIcon(collection)} class="home" />
        {/if}
      </TruncatedText>
    </div>
  </GridCell>
</GridRow>

<style lang="scss">
  .label {
    :global {
      .icon.home {
        opacity: 0.5;
        font-size: 20px;
        vertical-align: -4px;
      }
    }
  }
</style>
