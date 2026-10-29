<script>
  import { _ } from '@sveltia/i18n';
  import {
    Alert,
    Button,
    ConfirmationDialog,
    EmptyState,
    Group,
    Icon,
    Spacer,
    Toast,
    Toolbar,
  } from '@sveltia/ui';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import WorkflowEntryCard from '$lib/components/workflow/workflow-entry-card.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { retainDeployPolling } from '$lib/services/deployments/poll';
  import {
    checkPublishedVersion,
    getUnpublishedEntryById,
    isPendingDeletion,
    publishingBranches,
    unpublishedEntries,
    workflowDataReady,
  } from '$lib/services/workflow';
  import {
    COLUMN_LABELS,
    getBoardAnnouncement,
    getDiscardMessages,
    getPublishMessages,
    groupEntriesByStatus,
    REFRESH_MESSAGES,
    STATUS_UPDATE_MESSAGES,
  } from '$lib/services/workflow/board';
  import { deployingEntries } from '$lib/services/workflow/deploy';
  import { getDiscardDialogStrings, getPublishDialogStrings } from '$lib/services/workflow/dialogs';
  import { reloadUnpublishedEntries } from '$lib/services/workflow/load';
  import {
    discardWorkflowEntry,
    publishReviewedEntry,
    updateWorkflowStatus,
  } from '$lib/services/workflow/save';
  import {
    boardStages,
    getStageOfEntry,
    isStageAvailable,
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
  /** Whether the pull requests are being read again at the user’s request. */
  let refreshing = $state(false);

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

  // A pending deletion has a status of its own, so it never lands in a stage column. It’s listed
  // below the board instead, and its cards don’t drag: there are no stages to move it through
  const { columns, pendingDeletions } = $derived(
    groupEntriesByStatus(boardStages.current, unpublishedEntries.current, getStageOfEntry),
  );
  const deploying = $derived(deployingEntries.current);

  // Keep the deploy state fresh while the board is open, so a preview link turns live as soon as
  // its build finishes. One hold covers every card, because the lookup batches across all the open
  // pull requests. The release function is returned synchronously; awaiting anything first would
  // lose the handle and leak the hold
  $effect(() => retainDeployPolling());

  /** Whether the page has already been announced, so a later status change doesn’t repeat it. */
  let announced = false;

  /**
   * Show the given message with a toast notification.
   * @param {'info' | 'success' | 'error'} status Status of the message.
   * @param {string} message Localized message.
   */
  const notify = (status, message) => {
    toastStatus = status;
    toastMessage = message;
    showToast = true;
  };

  /**
   * Report the progress and the result of a request with a toast notification.
   * @param {Promise<any>} request Request being performed.
   * @param {ToastMessages} messages I18n string keys for each state.
   * @param {() => void} onSettled Function called once the request has settled.
   * @param {(ex: any) => string} [getErrorMessage] Function returning the localized message for
   * the given failure. The `error` message by default.
   */
  const reportRequest = async (
    request,
    messages,
    onSettled,
    getErrorMessage = () => _(messages.error),
  ) => {
    notify('info', _(messages.info));

    // The toast is shown again with the result in case it has already been dismissed while the
    // request was in flight
    try {
      await request;
      notify('success', _(messages.success));
    } catch (/** @type {any} */ ex) {
      notify('error', getErrorMessage(ex));
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      onSettled();
    }
  };

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

    await reportRequest(
      request,
      messages,
      () => {
        busyBranches = busyBranches.filter((_branch) => _branch !== branch);
      },
      // A failure that trying again wouldn’t fix says why, e.g. a publish refused over what the
      // pull request holds, or another request open from the branch
      (ex) => getWorkflowErrorMessage(ex, messages.error),
    );
  };

  /**
   * Read the pull requests again, to pick up what anyone else has changed since the board was
   * loaded, without waiting for the next scheduled check, and report the result with a toast
   * notification. A reload already in flight, such as a scheduled check, may have listed the pull
   * requests before the button was clicked, so the board is reloaded again after it rather than
   * joining it.
   */
  const refresh = async () => {
    refreshing = true;

    await reportRequest(reloadUnpublishedEntries({ fresh: true }), REFRESH_MESSAGES, () => {
      refreshing = false;
    });
  };

  /**
   * Report that an action couldn’t be performed because the entry has validation errors. An entry
   * can be saved as a draft with its required fields left empty, so it has to be checked before it
   * moves towards being published.
   * @param {string} messageKey I18n string key of the message to show.
   */
  const reportValidationErrors = (messageKey) => {
    notify('error', _(messageKey));
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
    const entry = getUnpublishedEntryById(draggedEntry?.id);

    draggedEntry = undefined;
    dropTarget = undefined;

    if (!entry || getStageOfEntry(entry) === status || !isStageAvailable(entry, status)) {
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

    const { key, values } = getBoardAnnouncement(columns, pendingDeletions);

    announcedPageStatus.current = _(key, { values });
  });
</script>

<PageContainer aria-label={_(workflowPageLabelKey.current)}>
  {#snippet main()}
    <PageContainerMainArea aria-label={_(workflowPageLabelKey.current)}>
      {#snippet primaryToolbar()}
        <Toolbar variant="primary">
          <h2 role="none">{_(workflowPageLabelKey.current)}</h2>
          <Spacer flex />
          <Button
            variant="ghost"
            iconic
            aria-label={_('workflow.refresh')}
            disabled={!workflowDataReady.current || refreshing}
            onclick={refresh}
          >
            {#snippet startIcon()}
              <Icon name="refresh" />
            {/snippet}
          </Button>
        </Toolbar>
      {/snippet}
      {#snippet mainContent()}
        {#if !workflowDataReady.current}
          <EmptyState>
            <span role="none">{_('loading_entries', { values: { count: 2 } })}</span>
          </EmptyState>
        {:else}
          <!-- The board and the trays below it share a wrapper carrying the column count, which
          varies: an Open Authoring contributor can’t publish, so the board leaves out the stage
          that says an entry is ready to go live -->
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
            <!-- Only rendered when something is pending, so the board keeps the height
            otherwise -->
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
            <!-- Merged changes the site hasn’t caught up with yet. A deletion is gone from the
            entry list once merged, so this is the only place left to say the site still has it -->
            {#if deploying.length}
              <div role="none" class="tray">
                <Group class="group" aria-labelledby="deploying-title">
                  <header role="none">
                    <h3 role="none" id="deploying-title">{_('status.deploying')}</h3>
                  </header>
                  <div role="list" class="entries" aria-label={_('status.deploying')}>
                    {#each deploying as { entry } (entry.workflow.pullRequest.branch)}
                      <WorkflowEntryCard {entry} deploying />
                    {/each}
                  </div>
                </Group>
              </div>
            {/if}
          </div>
        {/if}
      {/snippet}
    </PageContainerMainArea>
  {/snippet}
</PageContainer>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={discardDialogStrings.title}
  okLabel={discardDialogStrings.label}
  onOk={async () => {
    const entry = getUnpublishedEntryById(targetEntry?.id);

    if (entry) {
      await runAction(
        entry,
        discardWorkflowEntry(entry),
        getDiscardMessages(isPendingDeletion(entry)),
      );
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
    const entry = getUnpublishedEntryById(targetEntry?.id);

    if (!entry) {
      return;
    }

    if (!canPublish({ entry })) {
      reportValidationErrors('workflow.publish_blocked');

      return;
    }

    await runAction(
      entry,
      // Pinned to the version the dialog was opened for
      publishReviewedEntry(entry, targetEntry),
      getPublishMessages(isPendingDeletion(entry)),
    );
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
