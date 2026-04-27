<!--
  @component
  Render the entry list in reorder mode. Each group is shown as its own `GridBody` with
  drag-and-drop reordering. The flattened ordered entries are published to the `reorderedEntries`
  store so the toolbar Save button can read it.
-->
<script>
  import { GridBody } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount } from 'svelte';

  import EntryReorderListItem from '$lib/components/contents/list/entry-reorder-list-item.svelte';
  import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
  import { sortEntriesByOrderField } from '$lib/services/contents/collection/entries/reorder';
  import {
    entryGroups,
    reorderDirty,
    reorderedEntries,
  } from '$lib/services/contents/collection/view';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected entry collection.
   * @property {ViewType} viewType View type passed through to entry items.
   */

  /** @type {Props} */
  const { collection, viewType } = $props();

  /**
   * Mutable per-group entry lists maintained during reorder mode.
   * @type {{ [groupName: string]: Entry[] }}
   */
  let reorderGroups = $state({});

  /**
   * Name of the group that contains the currently dragged entry.
   * @type {string}
   */
  let dragGroupName = $state('');

  /**
   * Index of the entry currently being dragged within its group.
   * @type {number | undefined}
   */
  let dragIndex = $state(undefined);

  /**
   * Insertion position during drag: the dragged entry will be placed *before* this index.
   * @type {number | undefined}
   */
  let dropIndex = $state(undefined);

  /**
   * Sync the flattened ordered entries back to the shared store so the toolbar Save button can read
   * it.
   * @param {{ [groupName: string]: Entry[] }} groups Per-group entry lists. Defaults to the current
   * {@link reorderGroups}.
   */
  const publishOrder = (groups = reorderGroups) => {
    reorderedEntries.set($entryGroups.flatMap(({ name, entries }) => groups[name] ?? entries));
  };

  /**
   * Move an entry within a group from one index to another.
   * @param {string} groupName Group name.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   */
  const moveEntry = (groupName, from, to) => {
    if (from === to) return;

    const group = [...(reorderGroups[groupName] ?? [])];
    const [item] = group.splice(from, 1);

    group.splice(to, 0, item);
    reorderGroups[groupName] = group;
    reorderDirty.set(true);
    publishOrder();
  };

  // Snapshot the entry groups exactly once when this component mounts (i.e. when the user enters
  // reorder mode). Any subsequent reactive updates to `$entryGroups` — for example, a background
  // refresh after another tab’s commit — must not clobber the user’s in-progress drag arrangement.
  // The reorder UI takes ownership of the list until Save or Cancel. `onMount` runs once and never
  // re-subscribes, which is exactly the lifetime we need here (vs. `$effect` + `untrack`).
  onMount(() => {
    // Exclude the index file (e.g. Hugo `_index.md`) from reorder: it is always pinned to the top
    // of the list regardless of its `order` value, so dragging it has no effect.
    const indexFileName = getIndexFile(collection)?.name;

    const initial = Object.fromEntries(
      $entryGroups.map(({ name, entries }) => [
        name,
        sortEntriesByOrderField(
          indexFileName ? entries.filter((entry) => entry.slug !== indexFileName) : entries,
          collection,
        ),
      ]),
    );

    reorderGroups = initial;
    publishOrder(initial);
  });
</script>

<div role="none" class="wrapper">
  {#each $entryGroups as { name, entries } (name)}
    {#await sleep() then}
      <GridBody label={name !== '*' ? name : undefined}>
        {@const localEntries = reorderGroups[name] ?? entries}
        {#each localEntries as entry, index (entry.id)}
          <EntryReorderListItem
            {collection}
            {entry}
            {viewType}
            dragging={dragIndex === index && dragGroupName === name}
            dropBefore={dropIndex === index &&
              dragGroupName === name &&
              dragIndex !== index &&
              dragIndex !== index - 1}
            dropAfter={dropIndex === localEntries.length &&
              index === localEntries.length - 1 &&
              dragGroupName === name &&
              dragIndex !== localEntries.length - 1}
            canMoveUp={index > 0}
            canMoveDown={index < localEntries.length - 1}
            onDragStart={() => {
              dragGroupName = name;
              dragIndex = index;
            }}
            onDragOver={(/** @type {number} */ clientY, /** @type {DOMRect} */ rect) => {
              dragGroupName = name;
              dropIndex = clientY < rect.top + rect.height / 2 ? index : index + 1;
            }}
            onDrop={() => {
              if (
                dragIndex !== undefined &&
                dropIndex !== undefined &&
                dropIndex !== dragIndex &&
                dropIndex !== dragIndex + 1
              ) {
                moveEntry(name, dragIndex, dropIndex > dragIndex ? dropIndex - 1 : dropIndex);
              }

              dragIndex = undefined;
              dropIndex = undefined;
            }}
            onDragEnd={() => {
              dragIndex = undefined;
              dropIndex = undefined;
            }}
            onMoveUp={() => {
              if (index > 0) moveEntry(name, index, index - 1);
            }}
            onMoveDown={() => {
              if (index < localEntries.length - 1) moveEntry(name, index, index + 1);
            }}
          />
        {/each}
      </GridBody>
    {/await}
  {/each}
</div>

<style lang="scss">
  .wrapper {
    :global {
      .grid-row.drag-source {
        opacity: 0.4;
        cursor: grabbing;
      }

      .grid-row[draggable='true']:not(.drag-source) {
        cursor: grab;
      }

      .grid-row.drop-before .grid-cell {
        border-top: 3px solid var(--sui-primary-accent-color) !important;
      }

      .grid-row.drop-after .grid-cell {
        border-bottom: 3px solid var(--sui-primary-accent-color) !important;
      }
    }
  }
</style>
