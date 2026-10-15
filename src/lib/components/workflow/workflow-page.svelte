<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, ConfirmationDialog, EmptyState, Group, Toast } from '@sveltia/ui';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import WorkflowEntryCard from '$lib/components/workflow/workflow-entry-card.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { getCollection } from '$lib/services/contents/collection';
  import { retainDeployPolling } from '$lib/services/deployments/poll';
  import {
    checkPublishedVersion,
    publishingBranches,
    unpublishedEntries,
    workflowDataReady,
  } from '$lib/services/workflow';
  import {
    COLUMN_LABELS,
    getDiscardMessages,
    getPublishMessages,
    groupEntriesByStatus,
    STATUS_UPDATE_MESSAGES,
  } from '$lib/services/workflow/board';
  import { deployingEntries } from '$lib/services/workflow/deploy';
  import { getDiscardDialogStrings, getPublishDialogStrings } from '$lib/services/workflow/dialogs';
  import {
    discardWorkflowEntry,
    publishWorkflowEntry,
    updateWorkflowStatus,
  } from '$lib/services/workflow/save';
  import {
    boardStages,
    getEntryStage,
    getWorkflowStages,
    workflowPageLabelKey,
  } from '$lib/services/workflow/stages';
  import { canMoveToStatus, canPublish } from '$lib/services/workflow/validate';
  import { getWorkflowErrorMessage } from '$lib/services/workflow/verify';

  /**
   * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
   * @import { ToastMessages } from '$lib/services/workflow/board';
   */

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

  /**
   * Whether an action is in flight for the given entry. A publish is recorded by the service as
   * well, because the merge can take minutes and outlive this page: a card for an entry whose
   * merge was started before the page was opened is busy all the same.
   * @param {UnpublishedEntry} entry Entry.
   * @returns {boolean} Result.
   */
  const isBusy = ({
    workflow: {
      pullRequest: { branch },
    },
  }) => busyBranches.includes(branch) || publishingBranches.current.includes(branch);

  // The entry can be published from another view, so the check depends on `allEntries`
  const publishedVersionExists = $derived(checkPublishedVersion(targetEntry));
  // For an entry awaiting deletion the two actions are reversed: the first one calls the removal
  // off, and the second one carries it out
  const targetIsDeletion = $derived(targetEntry?.workflow.status === 'pending_deletion');
  const discardDialogStrings = $derived(
    getDiscardDialogStrings({ pendingDeletion: targetIsDeletion, publishedVersionExists }),
  );
  const publishDialogStrings = $derived(getPublishDialogStrings({ deletion: targetIsDeletion }));

  /**
   * Get the stage the given entry is in, which decides the column it’s placed in.
   * @param {UnpublishedEntry} entry Entry.
   * @returns {WorkflowStatus} Stage.
   */
  const getStage = (entry) => getEntryStage(entry, getCollection(entry.workflow.collectionName));

  /**
   * Check whether the given entry can be moved to the given stage. The collections can be
   * configured with different stages, and an entry can only go to one of its own collection’s.
   * @param {UnpublishedEntry} entry Entry.
   * @param {WorkflowStatus} status Stage.
   * @returns {boolean} Result.
   */
  const isStageAvailable = (entry, status) =>
    getWorkflowStages(getCollection(entry.workflow.collectionName)).includes(status);

  // A pending deletion has a status of its own, so it never lands in a stage column. It’s listed
  // below the board instead, and its cards don’t drag: there are no stages to move it through
  const { columns, pendingDeletions } = $derived(
    groupEntriesByStatus(boardStages.current, unpublishedEntries.current, getStage),
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
    toastMessage = _(messages.info);
    showToast = true;

    try {
      await request;
      toastStatus = 'success';
      toastMessage = _(messages.success);
    } catch (/** @type {any} */ ex) {
      toastStatus = 'error';
      // A failure that trying again wouldn’t fix says why, e.g. a publish refused over what the
      // pull request holds, or another request open from the branch
      toastMessage = getWorkflowErrorMessage(ex, messages.error);
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      busyBranches = busyBranches.filter((_branch) => _branch !== branch);
    }

    // Show the toast again in case it has already been dismissed while the request was in flight
    showToast = true;
  };

  /**
   * Report that an action couldn’t be performed because the entry has validation errors. An entry
   * can be saved as a draft with its required fields left empty, so it has to be checked before it
   * moves towards being published.
   * @param {string} messageKey I18n string key of the message to show.
   */
  const reportValidationErrors = (messageKey) => {
    toastStatus = 'error';
    toastMessage = _(messageKey);
    showToast = true;
  };

  /**
   * Ask for confirmation before deleting the given entry, or calling its pending deletion off.
   * @param {UnpublishedEntry} entry Entry.
   */
  const confirmDelete = (entry) => {
    targetEntry = entry;
    showDeleteDialog = true;
  };

  /**
   * Ask for confirmation before publishing the given entry, or carrying out its pending deletion.
   * @param {UnpublishedEntry} entry Entry.
   */
  const confirmPublish = (entry) => {
    targetEntry = entry;
    showPublishDialog = true;
  };

  /**
   * Move the dragged entry to the given column, which changes the label on the pull request.
   * @param {WorkflowStatus} status New status.
   */
  const moveEntry = async (status) => {
    const entry = draggedEntry;

    draggedEntry = undefined;
    dropTarget = undefined;

    if (!entry || getStage(entry) === status || !isStageAvailable(entry, status)) {
      return;
    }

    if (!canMoveToStatus({ entry, status })) {
      reportValidationErrors('workflow.status_change_blocked');

      return;
    }

    await runAction(entry, updateWorkflowStatus(entry, status), STATUS_UPDATE_MESSAGES);
  };

  // Announce the page once the pull requests have been fetched, so the counts are accurate. It’s a
  // one-shot announcement like the other pages; a status change is reported with a toast instead.
  $effect(() => {
    if (announced || !workflowDataReady.current) {
      return;
    }

    announced = true;

    /**
     * Get the number of entries in the given column.
     * @param {WorkflowStatus} status Column status.
     * @returns {number | undefined} Count, or `undefined` if the board has no such column.
     */
    const count = (status) => columns.find((column) => column.status === status)?.entries.length;
    // The board always has a Drafts column
    const draft = /** @type {number} */ (count('draft'));
    const [review, ready] = [count('pending_review'), count('pending_publish')];
    const deletion = pendingDeletions.length;

    // A column the board doesn’t have is left out of the announcement rather than reported as
    // zero: there’s no Ready column for an Open Authoring contributor, no In Review column when the
    // review stage is left out, and no column but the drafts with Preview Workflow
    announcedPageStatus.current =
      review === undefined
        ? ready === undefined
          ? _('viewing_preview_workflow', { values: { draft, deletion } })
          : _('viewing_editorial_workflow_without_review', { values: { draft, ready, deletion } })
        : ready === undefined
          ? _('viewing_open_authoring_workflow', { values: { draft, review, deletion } })
          : _('viewing_editorial_workflow', { values: { draft, review, ready, deletion } });
  });
</script>

<PageContainer aria-label={_(workflowPageLabelKey.current)}>
  {#snippet main()}
    {#if !workflowDataReady.current}
      <EmptyState>
        <span role="none">{_('loading_entries', { values: { count: 2 } })}</span>
      </EmptyState>
    {:else}
      <!-- The page container lays its children out in a row, so the board and the list below it
      need a column wrapper of their own -->
      <!-- The column count varies: an Open Authoring contributor can’t publish, so the board
      leaves out the stage that says an entry is ready to go live -->
      <div
        role="none"
        class="board"
        class:single={columns.length === 1}
        style:--column-count={columns.length}
      >
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
                  if (!draggedEntry || !isStageAvailable(draggedEntry, status)) {
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
                    busy={isBusy(entry)}
                    dragging={draggedEntry?.id === entry.id}
                    onDragStart={() => {
                      draggedEntry = entry;
                    }}
                    onDragEnd={() => {
                      draggedEntry = undefined;
                      dropTarget = undefined;
                    }}
                    onDelete={() => confirmDelete(entry)}
                    onPublish={() => confirmPublish(entry)}
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
          <div role="none" class="tray">
            <Group class="group" aria-labelledby="deletions-title">
              <header role="none">
                <h3 role="none" id="deletions-title">{_('status.pending_deletion')}</h3>
              </header>
              <div role="list" class="entries" aria-label={_('status.pending_deletion')}>
                {#each pendingDeletions as entry (entry.id)}
                  <WorkflowEntryCard
                    {entry}
                    busy={isBusy(entry)}
                    onDelete={() => confirmDelete(entry)}
                    onPublish={() => confirmPublish(entry)}
                  />
                {/each}
              </div>
            </Group>
          </div>
        {/if}
        <!-- Merged changes the site hasn’t caught up with yet. A deletion is gone from the entry
        list once merged, so this is the only place left to say the site still has it -->
        {#if deployingEntries.current.length}
          <div role="none" class="tray">
            <Group class="group" aria-labelledby="deploying-title">
              <header role="none">
                <h3 role="none" id="deploying-title">{_('status.deploying')}</h3>
              </header>
              <div role="list" class="entries" aria-label={_('status.deploying')}>
                {#each deployingEntries.current as { entry } (entry.workflow.pullRequest.branch)}
                  <WorkflowEntryCard {entry} deploying />
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
  title={discardDialogStrings.title}
  okLabel={discardDialogStrings.label}
  onOk={async () => {
    const entry = targetEntry;

    /* v8 ignore next 7 -- the dialog is only opened for an entry */
    if (entry) {
      await runAction(entry, discardWorkflowEntry(entry), getDiscardMessages(targetIsDeletion));
    }
  }}
>
  {discardDialogStrings.message}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showPublishDialog}
  title={publishDialogStrings.title}
  okLabel={publishDialogStrings.label}
  onOk={async () => {
    const entry = targetEntry;

    /* v8 ignore next 3 -- the dialog is only opened for an entry */
    if (!entry) {
      return;
    }

    if (!canPublish({ entry })) {
      reportValidationErrors('workflow.publish_blocked');

      return;
    }

    await runAction(entry, publishWorkflowEntry(entry), getPublishMessages(targetIsDeletion));
  }}
>
  {publishDialogStrings.message}
</ConfirmationDialog>

<!-- The `id` makes the auto-hide timer restart when the message changes -->
{#if toastMessage}
  <Toast id={toastMessage} bind:show={showToast}>
    <Alert status={toastStatus}>{toastMessage}</Alert>
  </Toast>
{/if}

<style>
  /*
   * Entries awaiting removal, and merged ones the site hasn’t caught up with, are listed in trays
   * below the board rather than as extra columns: they have no stages to move through, and a
   * column would take a share of the width for something rare
   */

  .board {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /*
   * With a single column, as with Preview Workflow, the cards would be stretched across the page,
   * so they’re laid out in a grid instead, both in the column and in the trays below it
   */

  .board.single .entries {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    align-content: start;
  }

  .tray {
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
