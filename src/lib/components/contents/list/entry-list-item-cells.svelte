<!--
  @component
  Shared cells (checkbox, thumbnail image, title) used by both the read-only entry list row and the
  reorder list row.
-->
<script>
  import { locale as appLocale } from '@sveltia/i18n';
  import { Checkbox, GridCell, Icon, TruncatedText } from '@sveltia/ui';

  import Image from '$lib/components/assets/shared/image.svelte';
  import { selectedEntryIdSet } from '$lib/services/contents/collection/entries';
  import {
    getIndexFile,
    isCollectionIndexFile,
  } from '$lib/services/contents/collection/entries/index-file';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   * @property {boolean} [showCheckbox] Whether to render the selection checkbox cell. Defaults to
   * `false`; the read-only list row passes `true`, while the reorder row leaves it off.
   * @property {(selected: boolean) => void} [onSelect] Selection change handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    showCheckbox = false,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if showCheckbox && !($isSmallScreen || $isMediumScreen)}
  <GridCell class="checkbox">
    <Checkbox
      role="none"
      tabindex="-1"
      checked={$selectedEntryIdSet.has(entry.id)}
      onChange={({ detail: { checked } }) => {
        onSelect?.(checked);
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
      {#key appLocale.current}
        {@html getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true })}
      {/key}
      {#if isCollectionIndexFile(collection, entry)}
        <Icon name={getIndexFile(collection)?.icon} class="home" />
      {/if}
    </TruncatedText>
  </div>
</GridCell>

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
