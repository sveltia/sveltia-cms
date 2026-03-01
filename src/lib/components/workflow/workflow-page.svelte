<script>
  import { EmptyState, Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import WorkflowCard from '$lib/components/workflow/workflow-card.svelte';
  import { getAssociatedCollections } from '$lib/services/contents/entry';
  import {
    entriesByWorkflowStatus,
    isValidTransition,
    getEntryWorkflowStatus,
    isKnownEntry,
    transitionEntry,
    STATUS_LABEL_KEYS,
  } from '$lib/services/contents/workflow';

  /**
   * @import { WorkflowStatus } from '$lib/services/contents/workflow';
   */

  /**
   * @type {{ id: WorkflowStatus, labelKey: string }[]}
   */
  const columns = [
    { id: 'draft', labelKey: STATUS_LABEL_KEYS.draft },
    { id: 'in_review', labelKey: STATUS_LABEL_KEYS.in_review },
    { id: 'ready', labelKey: STATUS_LABEL_KEYS.ready },
  ];

  /** @type {WorkflowStatus | null} */
  let dragOverColumn = $state(null);

  /** @type {string | null} */
  let dragEntryId = $state(null);

  /**
   * Handle drop on a column.
   * @param {DragEvent} e Drag event.
   * @param {WorkflowStatus} targetStatus Target column status.
   */
  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    dragOverColumn = null;
    dragEntryId = null;

    const entryId = e.dataTransfer?.getData('text/plain');

    if (!entryId || !isKnownEntry(entryId)) {
      return;
    }

    const currentStatus = getEntryWorkflowStatus(entryId);

    if (currentStatus !== targetStatus && isValidTransition(currentStatus, targetStatus)) {
      transitionEntry(entryId, targetStatus);
    }
  };

  /**
   * Handle drag over a column. Shows visual feedback for valid/invalid drop targets.
   * @param {DragEvent} e Drag event.
   * @param {WorkflowStatus} targetStatus Target column status.
   */
  const handleDragOver = (e, targetStatus) => {
    e.preventDefault();

    // Check if this is a valid drop target for the dragged entry
    const canDrop =
      dragEntryId && isKnownEntry(dragEntryId)
        ? isValidTransition(getEntryWorkflowStatus(dragEntryId), targetStatus)
        : true; // Assume valid when we don't have the entry ID yet

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = canDrop ? 'move' : 'none';
    }

    dragOverColumn = canDrop ? targetStatus : null;
  };
</script>

<PageContainer aria-label={$_('editorial_workflow')}>
  {#snippet main()}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      role="none"
      class="columns"
      ondragstart={(e) => {
        const card = /** @type {HTMLElement} */ (e.target)?.closest?.('[data-entry-id]');
        dragEntryId = card?.dataset?.entryId ?? null;
      }}
      ondragend={() => {
        dragOverColumn = null;
        dragEntryId = null;
      }}
    >
      {#each columns as { id, labelKey } (id)}
        <Group
          class="column {dragOverColumn === id ? 'drag-over' : ''}"
          aria-labelledby="{id}-column-title"
        >
          <header role="none">
            <h3 role="none" id="{id}-column-title">{$_(labelKey)}</h3>
            <span class="count">{$entriesByWorkflowStatus[id]?.length ?? 0}</span>
          </header>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            role="list"
            class="card-list"
            ondrop={(e) => handleDrop(e, id)}
            ondragover={(e) => handleDragOver(e, id)}
            ondragleave={() => { dragOverColumn = null; }}
          >
            {#each $entriesByWorkflowStatus[id] ?? [] as entry (entry.id)}
              <WorkflowCard {entry} collection={getAssociatedCollections(entry)[0]} />
            {/each}
            {#if !$entriesByWorkflowStatus[id]?.length}
              <EmptyState>
                <span>{$_('no_entries_found')}</span>
              </EmptyState>
            {/if}
          </div>
        </Group>
      {/each}
    </div>
  {/snippet}
</PageContainer>

<style lang="scss">
  .columns {
    flex: auto;
    display: flex;
    gap: 4px;
    background-color: var(--sui-secondary-background-color); // same as toolbar

    @media (width < 768px) {
      flex-direction: column;
      gap: 0;
    }

    :global {
      .column {
        flex: auto;
        display: flex;
        flex-direction: column;
        width: calc(100% / 3);
        background-color: var(--sui-primary-background-color);
        transition: background-color 0.15s;

        @media (width < 768px) {
          width: 100%;
          height: calc(100% / 3);
        }

        &.drag-over {
          background-color: var(--sui-hover-background-color, rgb(0 0 0 / 4%));
        }
      }
    }

    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      height: 40px;
      background-color: var(--sui-tertiary-background-color);

      h3 {
        font-size: var(--sui-font-size-x-large);
      }
    }
  }

  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background-color: var(--sui-control-border-color);
    font-size: var(--sui-font-size-small);
    color: var(--sui-secondary-foreground-color);
  }

  .card-list {
    flex: auto;
    overflow-y: auto;
    padding: 4px;
  }
</style>
