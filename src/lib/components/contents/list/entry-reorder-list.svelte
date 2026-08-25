<!--
  @component
  Render the entry list in reorder mode. Each group is shown as its own `GridBody` with
  drag-and-drop reordering. The flattened ordered entries are published to the `reorderedEntries`
  store so the toolbar Save button can read it.

  There is normally a single, unnamed group because entering reorder mode clears the active
  grouping. A collection using `reorder: { group: '…' }` is grouped by the named view group instead,
  in which case dragging is locked within a group: entries are renumbered group by group, and moving
  an entry across groups wouldn’t update the field that determines which group it belongs to.
-->
<script>
  import { GridBody } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';

  import EntryReorderListItem from '$lib/components/contents/list/entry-reorder-list-item.svelte';
  import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
  import { sortEntriesByOrderField } from '$lib/services/contents/collection/entries/reorder';
  import {
    entryGroups,
    listedEntryIndexMap,
    reorderDirty,
    reorderedEntries,
  } from '$lib/services/contents/collection/view';
  import { getDropIndex, getMoveTarget, moveListItem } from '$lib/services/utils/drag-sorting';

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
   * The group name and entry order as they were when the current drag started, so that an abandoned
   * drag can put the entries back, and so drops in any other group can be rejected. `undefined`
   * while no drag is in progress.
   * @type {{ name: string, entries: Entry[] } | undefined}
   */
  let dragOrigin = $state();

  /**
   * The entry currently being dragged.
   * @type {Entry | undefined}
   */
  let draggedEntry = $state();

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
   * Move an entry within a group from one index to another, and mark the new order as unsaved.
   * This is the committed move behind the Move Up / Move Down buttons; a drag previews the move
   * first and only commits it on drop.
   * @param {string} groupName Group name.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   */
  const moveEntry = (groupName, from, to) => {
    if (from === to) return;

    reorderGroups[groupName] = moveListItem(reorderGroups[groupName] ?? [], from, to);
    reorderDirty.set(true);
    publishOrder();
  };

  /**
   * End the current drag, either keeping the previewed order or restoring the one from before it.
   *
   * `drop` fires before `dragend`, so a completed drop clears the origin here and the `dragend`
   * that follows finds nothing left to undo.
   * @param {boolean} commit Whether to keep the previewed order.
   */
  const finishDrag = (commit) => {
    if (dragOrigin) {
      const { name, entries } = dragOrigin;

      if (commit) {
        // The pointer may well have returned to where it started, in which case nothing moved
        if ((reorderGroups[name] ?? []).some((entry, index) => entry.id !== entries[index]?.id)) {
          reorderDirty.set(true);
          publishOrder();
        }
      } else {
        reorderGroups[name] = entries;
      }
    }

    dragOrigin = undefined;
    draggedEntry = undefined;
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
          <!--
            The row is written out here rather than with `<GridRow>` because `animate:` only works
            on an element at the top level of a keyed `each` block, never on a component. Dragging
            reorders `reorderGroups` as the pointer moves, so the other rows slide out of the way
            and the gap the entry would land in follows the pointer.
          -->
          <div
            role="row"
            class="sui grid-row"
            class:drag-source={draggedEntry?.id === entry.id}
            tabindex="0"
            aria-rowindex={$listedEntryIndexMap.get(entry.id) ?? -1}
            aria-selected="false"
            draggable="true"
            ondragstart={(/** @type {DragEvent} */ event) => {
              dragOrigin = { name, entries: [...localEntries] };
              draggedEntry = entry;

              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
              }
            }}
            ondragover={(/** @type {DragEvent & { currentTarget: HTMLElement }} */ event) => {
              // Reject the drop when it targets another group, so the browser shows a “no drop”
              // cursor. This also rejects anything dragged in from outside the list, where there is
              // no drag origin at all.
              const accepted = name === dragOrigin?.name;

              if (accepted) {
                event.preventDefault();

                const list = reorderGroups[name] ?? [];
                const from = list.findIndex(({ id }) => id === draggedEntry?.id);

                const to = getMoveTarget({
                  dragIndex: from,
                  dropIndex: getDropIndex({
                    index,
                    clientY: event.clientY,
                    rect: event.currentTarget.getBoundingClientRect(),
                  }),
                });

                if (to !== undefined) {
                  reorderGroups[name] = moveListItem(list, from, to);
                }
              }

              if (event.dataTransfer) {
                event.dataTransfer.dropEffect = accepted ? 'move' : 'none';
              }
            }}
            ondrop={(/** @type {DragEvent} */ event) => {
              event.preventDefault();
              // `AppShell` accepts every drop so the browser doesn’t navigate away from a stray
              // file, which means a drop rejected above can still land here. Releasing over another
              // group shows the “no drop” cursor, so it has to put the entries back rather than
              // commit the arrangement the pointer left behind.
              finishDrag(name === dragOrigin?.name);
            }}
            ondragend={() => {
              finishDrag(false);
            }}
            animate:flip={{ duration: 200 }}
          >
            <EntryReorderListItem
              {collection}
              {entry}
              {viewType}
              canMoveUp={index > 0}
              canMoveDown={index < localEntries.length - 1}
              onMoveUp={() => {
                if (index > 0) moveEntry(name, index, index - 1);
              }}
              onMoveDown={() => {
                if (index < localEntries.length - 1) moveEntry(name, index, index + 1);
              }}
            />
          </div>
        {/each}
      </GridBody>
    {/await}
  {/each}
</div>

<style>
  .wrapper {
    :global {
      /* The rows aren’t `<GridRow>` components, so they don’t get its scoped layout rules */
      .grid-row {
        display: table-row;
        height: var(--sui-primary-row-height);
      }

      /* The dragged row is left as a faint placeholder marking the gap it would drop into. The
        pointer already carries the browser’s own drag image of it, so showing it twice at full
        strength would just be confusing. */

      .grid-row.drag-source {
        opacity: 0.25;
        cursor: grabbing;
      }

      .grid-row[draggable='true']:not(.drag-source) {
        cursor: grab;
      }
    }
  }
</style>
