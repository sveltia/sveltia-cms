<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, EmptyState, Group, Toast } from '@sveltia/ui';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import WorkflowEntryCard from '$lib/components/workflow/workflow-entry-card.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { allEntries } from '$lib/services/contents';
  import { retainDeployPolling } from '$lib/services/deployments/poll';
  import {
    hasPublishedVersion,
    unpublishedEntries,
    workflowDataReady,
  } from '$lib/services/workflow';
  import { WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';
  import { openAuthoring, workflowStages } from '$lib/services/workflow/open-authoring';
  import {
    discardWorkflowEntry,
    publishWorkflowEntry,
    updateWorkflowStatus,
  } from '$lib/services/workflow/save';

  /**
   * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
   */

  /**
   * Column headings. The `drafts` heading is plural, unlike the singular status label used in the
   * entry editor’s status button.
   * @type {Record<WorkflowStatus, string>}
   */
  const COLUMN_LABELS = { ...WORKFLOW_STATUS_LABELS, draft: 'status.drafts' };

  /**
   * @typedef {object} ToastMessages
   * @property {string} info I18n string key shown while the action is in progress.
   * @property {string} success I18n string key shown once the action has completed.
   * @property {string} error I18n string key shown when the action has failed.
   */

  /** @type {ToastMessages} */
  const STATUS_UPDATE_MESSAGES = {
    info: 'workflow.updating_status',
    success: 'workflow.status_updated',
    error: 'workflow.status_change_failed',
  };

  /** @type {ToastMessages} */
  const DELETION_MESSAGES = {
    info: 'workflow.deleting_entry',
    success: 'workflow.entry_deleted',
    error: 'deleting_entry_failed',
  };

  /** @type {ToastMessages} */
  const CANCELLATION_MESSAGES = {
    info: 'workflow.cancelling_deletion',
    success: 'workflow.deletion_cancelled',
    error: 'workflow.cancelling_deletion_failed',
  };

  /** @type {ToastMessages} */
  const PUBLISHING_MESSAGES = {
    info: 'workflow.publishing_entry',
    success: 'workflow.entry_published',
    error: 'workflow.publishing_entry_failed',
  };

  // `$state.raw` rather than `$state`, because the latter deeply proxies the entry, and the proxy
  // would end up back in the store when the status is saved. `structuredClone()` throws on a proxy,
  // so the entry editor would then fail to open the entry
  /** @type {UnpublishedEntry | undefined} */
  let draggedEntry = $state.raw();
  /** @type {WorkflowStatus | undefined} */
  let dropTarget = $state();
  /**
   * Entry targeted by the Delete or Publish confirmation dialog. Kept raw for the same reason as
   * {@link draggedEntry}.
   * @type {UnpublishedEntry | undefined}
   */
  let targetEntry = $state.raw();
  let showDeleteDialog = $state(false);
  let showPublishDialog = $state(false);
  /** @type {'info' | 'success' | 'error'} */
  let toastStatus = $state('info');
  let toastMessage = $state('');
  let showToast = $state(false);
  /**
   * Branches of the entries with an action in flight. `$state.raw` because the list is replaced
   * rather than mutated.
   * @type {string[]}
   */
  let busyBranches = $state.raw([]);

  // `$allEntries` is a dependency, because the entry can be published from another view
  const publishedVersionExists = $derived(
    !!targetEntry && !!$allEntries && hasPublishedVersion(targetEntry),
  );
  // For an entry awaiting deletion the two actions are reversed: the first one calls the removal
  // off, and the second one carries it out
  const targetIsDeletion = $derived(targetEntry?.workflow.status === 'pending_deletion');

  // A pending deletion has a status of its own, so it never lands in a stage column. It’s listed
  // below the board instead, and its cards don’t drag: there are no stages to move it through
  const columns = $derived(
    $workflowStages.map((status) => ({
      status,
      entries: $unpublishedEntries.filter((entry) => entry.workflow.status === status),
    })),
  );
  const pendingDeletions = $derived(
    $unpublishedEntries.filter(({ workflow }) => workflow.status === 'pending_deletion'),
  );

  // Keep the deploy state fresh while the board is open, so a preview link turns live as soon as
  // its build finishes. One hold covers every card, because the lookup batches across all the open
  // pull requests. The release function is returned synchronously; awaiting anything first would
  // lose the handle and leak the hold
  $effect(() => retainDeployPolling());

  /** Whether the page has already been announced, so a later status change doesn’t repeat it. */
  let announced = false;

  /**
   * Report the progress and the result of an Editorial Workflow action with a toast notification.
   * The entry’s controls stay disabled until the request settles, so a second action can’t be
   * started against the same pull request while the first one is still in flight.
   * @param {UnpublishedEntry} entry Entry the action applies to.
   * @param {Promise<any>} request Request being performed.
   * @param {ToastMessages} messages I18n string keys for each state.
   */
  const runAction = async (entry, request, messages) => {
    // Key the busy state on the branch rather than the entry object, which is replaced in the store
    // once the request completes
    const { branch } = entry.workflow.pullRequest;

    busyBranches = [...busyBranches, branch];
    toastStatus = 'info';
    toastMessage = messages.info;
    showToast = true;

    try {
      await request;
      toastStatus = 'success';
      toastMessage = messages.success;
    } catch (/** @type {any} */ ex) {
      toastStatus = 'error';
      toastMessage = messages.error;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      busyBranches = busyBranches.filter((_branch) => _branch !== branch);
    }

    // Show the toast again in case it has already been dismissed while the request was in flight
    showToast = true;
  };

  /**
   * Move the dragged entry to the given column, which changes the label on the pull request.
   * @param {WorkflowStatus} status New status.
   */
  const moveEntry = async (status) => {
    const entry = draggedEntry;

    draggedEntry = undefined;
    dropTarget = undefined;

    if (!entry || entry.workflow.status === status) {
      return;
    }

    await runAction(entry, updateWorkflowStatus(entry, status), STATUS_UPDATE_MESSAGES);
  };

  // Announce the page once the pull requests have been fetched, so the counts are accurate. It’s a
  // one-shot announcement like the other pages; a status change is reported with a toast instead.
  $effect(() => {
    if (announced || !$workflowDataReady) {
      return;
    }

    announced = true;

    const [draft, review, ready = 0] = columns.map(({ entries }) => entries.length);
    const deletion = pendingDeletions.length;

    // The board has no Ready column for an Open Authoring contributor, so its count is left out of
    // the announcement rather than reported as zero
    $announcedPageStatus = $openAuthoring
      ? _('viewing_open_authoring_workflow', { values: { draft, review, deletion } })
      : _('viewing_editorial_workflow', { values: { draft, review, ready, deletion } });
  });
</script>

<PageContainer aria-label={_('editorial_workflow')}>
  {#snippet main()}
    {#if !$workflowDataReady}
      <EmptyState>
        <span role="none">{_('loading_entries', { values: { count: 2 } })}</span>
      </EmptyState>
    {:else}
      <!-- The page container lays its children out in a row, so the board and the list below it
      need a column wrapper of their own -->
      <!-- The column count varies: an Open Authoring contributor can’t publish, so the board
      leaves out the stage that says an entry is ready to go live -->
      <div role="none" class="board" style:--column-count={columns.length}>
        <div role="none" class="columns">
          {#each columns as { status, entries } (status)}
            <Group class="column" aria-labelledby="{status}-column-title">
              <header role="none">
                <h3 role="none" id="{status}-column-title">{_(COLUMN_LABELS[status])}</h3>
              </header>
              <div
                role="list"
                class="entries"
                class:drop-target={dropTarget === status}
                aria-label={_(COLUMN_LABELS[status])}
                ondragover={(/** @type {DragEvent} */ event) => {
                  if (!draggedEntry) {
                    return;
                  }

                  event.preventDefault();

                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                  }

                  dropTarget = status;
                }}
                ondragleave={() => {
                  if (dropTarget === status) {
                    dropTarget = undefined;
                  }
                }}
                ondrop={(/** @type {DragEvent} */ event) => {
                  event.preventDefault();
                  moveEntry(status);
                }}
              >
                {#each entries as entry (entry.id)}
                  <WorkflowEntryCard
                    {entry}
                    busy={busyBranches.includes(entry.workflow.pullRequest.branch)}
                    dragging={draggedEntry?.id === entry.id}
                    onDragStart={() => {
                      draggedEntry = entry;
                    }}
                    onDragEnd={() => {
                      draggedEntry = undefined;
                      dropTarget = undefined;
                    }}
                    onDelete={() => {
                      targetEntry = entry;
                      showDeleteDialog = true;
                    }}
                    onPublish={() => {
                      targetEntry = entry;
                      showPublishDialog = true;
                    }}
                  />
                {:else}
                  <EmptyState>
                    <span role="none">{_('workflow.no_entries')}</span>
                  </EmptyState>
                {/each}
              </div>
            </Group>
          {/each}
        </div>
        <!-- Only rendered when something is pending, so the board keeps the height otherwise -->
        {#if pendingDeletions.length}
          <div role="none" class="deletions">
            <Group class="group" aria-labelledby="deletions-title">
              <header role="none">
                <h3 role="none" id="deletions-title">{_('status.pending_deletion')}</h3>
              </header>
              <div role="list" class="entries" aria-label={_('status.pending_deletion')}>
                {#each pendingDeletions as entry (entry.id)}
                  <WorkflowEntryCard
                    {entry}
                    busy={busyBranches.includes(entry.workflow.pullRequest.branch)}
                    onDelete={() => {
                      targetEntry = entry;
                      showDeleteDialog = true;
                    }}
                    onPublish={() => {
                      targetEntry = entry;
                      showPublishDialog = true;
                    }}
                  />
                {/each}
              </div>
            </Group>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}
</PageContainer>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={targetIsDeletion
    ? _('workflow.cancel_deletion')
    : publishedVersionExists
      ? _('workflow.discard_changes')
      : _('delete_entries', { values: { count: 1 } })}
  okLabel={_(
    targetIsDeletion ? 'workflow.cancel_deletion' : publishedVersionExists ? 'discard' : 'delete',
  )}
  onOk={async () => {
    const entry = targetEntry;

    if (entry) {
      await runAction(
        entry,
        discardWorkflowEntry(entry),
        targetIsDeletion ? CANCELLATION_MESSAGES : DELETION_MESSAGES,
      );
    }
  }}
>
  {_(
    targetIsDeletion
      ? 'workflow.confirm_cancelling_deletion'
      : publishedVersionExists
        ? 'workflow.confirm_discarding_entry_changes'
        : 'workflow.confirm_deleting_unpublished_entry',
  )}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showPublishDialog}
  title={targetIsDeletion
    ? _('delete_entries', { values: { count: 1 } })
    : _('workflow.publish_entry')}
  okLabel={_(targetIsDeletion ? 'delete' : 'publish')}
  onOk={async () => {
    const entry = targetEntry;

    if (entry) {
      await runAction(
        entry,
        publishWorkflowEntry(entry),
        targetIsDeletion ? DELETION_MESSAGES : PUBLISHING_MESSAGES,
      );
    }
  }}
>
  {_(
    targetIsDeletion ? 'workflow.confirm_completing_deletion' : 'workflow.confirm_publishing_entry',
  )}
</ConfirmationDialog>

<!-- The `id` makes the auto-hide timer restart when the message changes -->
{#if toastMessage}
  <Toast id={toastMessage} bind:show={showToast}>
    <Alert status={toastStatus}>{_(toastMessage)}</Alert>
  </Toast>
{/if}

<style>
  /*
   * Entries awaiting removal, listed below the board rather than as a fourth column: they have no
   * stages to move through, and a column would take a quarter of the width for something rare
   */

  .board {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .deletions {
    flex: none;
    display: flex;
    flex-direction: column;
    max-height: 33%;
    border-block-start: 1px solid var(--sui-secondary-border-color);
    background-color: var(--sui-primary-background-color);

    :global {
      .group {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    }

    header {
      display: flex;
      align-items: center;
      padding: 0 16px;
      height: 40px;
      background-color: var(--sui-tertiary-background-color);

      h3 {
        font-size: var(--sui-font-size-x-large);
      }
    }

    /* Mirror the board’s track count, so a card here is the same size as one in a column */
    .entries {
      display: grid;
      grid-template-columns: repeat(var(--column-count), 1fr);
      gap: 8px;
      padding: 8px;
      overflow-y: auto;

      @media (width < 768px) {
        grid-template-columns: 1fr;
      }
    }
  }

  .columns {
    flex: auto;
    display: flex;
    gap: 4px;
    background-color: var(--sui-secondary-background-color); /* same as toolbar */

    @media (width < 768px) {
      flex-direction: column;
      gap: 0;
    }

    :global {
      .column {
        flex: auto;
        display: flex;
        flex-direction: column;
        width: calc(100% / var(--column-count));
        background-color: var(--sui-primary-background-color);

        @media (width < 768px) {
          width: 100%;
          height: calc(100% / var(--column-count));
        }
      }
    }

    header {
      flex: none;
      display: flex;
      align-items: center;
      padding: 0 16px;
      height: 40px;
      background-color: var(--sui-tertiary-background-color);

      h3 {
        font-size: var(--sui-font-size-x-large);
      }
    }

    .entries {
      flex: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      overflow-y: auto;

      &.drop-target {
        background-color: var(--sui-selected-background-color);
      }
    }
  }
</style>
