<!--
  @component
  Thumbnail of an entry, as shown in the entry list, the search results and the Editorial Workflow
  page. Nothing is rendered for an entry without one. The thumbnail is loaded right away if it’s in
  view, or once it has scrolled into view and stayed there for a moment, so the rows a long list is
  scrolled past don’t queue up thumbnails ahead of the ones the user stops at. Its object URL is
  released
  when the entry changes or the thumbnail is removed, so a long list doesn’t keep every thumbnail it
  has ever shown in memory.
-->
<script>
  import Image from '$lib/components/assets/shared/image.svelte';
  import { loadEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { whenThumbnailShown } from '$lib/services/utils/visibility';

  /**
   * @import { Entry, InternalEntryCollection } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Entry’s collection.
   * @property {Entry} entry Entry.
   * @property {'icon' | 'tile'} variant Image variant.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    variant,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Hidden element whose parent, the cell or card holding the thumbnail, is observed to tell when
   * the thumbnail comes into view: there is no thumbnail to observe until it has been loaded. The
   * anchor itself is hidden so it takes no part in the layout, and has no box to observe.
   * @type {HTMLElement | undefined}
   */
  let anchor = $state();

  /**
   * The loaded thumbnail along with the entry it belongs to. A thumbnail is only shown for its own
   * entry, so a row given another entry stops showing the previous one right away, without the
   * effect below having to reset anything: a state write from an effect, or from its teardown, is
   * costly with thousands of rows.
   * @type {{ entry: Entry, src: string } | undefined}
   */
  let loaded = $state.raw();

  const src = $derived(loaded?.entry === entry ? loaded.src : undefined);

  $effect(() => {
    const container = anchor?.parentElement;

    /* v8 ignore next 3 -- the anchor is bound and mounted before the effect runs */
    if (!container) {
      return undefined;
    }

    const _collection = collection;
    const _entry = entry;
    /** @type {(() => void) | undefined} */
    let release;

    const cancel = whenThumbnailShown(container, () => {
      release = loadEntryThumbnail(_collection, _entry, (url) => {
        loaded = { entry: _entry, src: url };
      });
    });

    return () => {
      cancel();
      release?.();
    };
  });
</script>

<span role="none" hidden bind:this={anchor}></span>
{#if src}
  <!-- The thumbnail is only loaded once it’s about to be seen, so it’s shown right away -->
  <Image {src} {variant} cover loading="eager" />
{/if}
