<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import {
    Alert,
    AlertDialog,
    Button,
    ConfirmationDialog,
    Divider,
    Menu,
    MenuButton,
    MenuItem,
    Spacer,
    SplitButton,
    Toast,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import ResetDialog from '$lib/components/contents/details/editor/reset-dialog.svelte';
  import ResetMenuItems from '$lib/components/contents/details/editor/reset-menu-items.svelte';
  import ValidationErrorsToast from '$lib/components/contents/details/editor/validation-errors-toast.svelte';
  import ViewMenuItems from '$lib/components/contents/details/editor/view-menu-items.svelte';
  import EntryRemoval from '$lib/components/contents/details/entry-removal.svelte';
  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import SaveConflictDialog from '$lib/components/contents/details/save-conflict-dialog.svelte';
  import EntryStatusMenu from '$lib/components/workflow/entry-status-menu.svelte';
  import PublishEntryButton from '$lib/components/workflow/publish-entry-button.svelte';
  import { getEntryEditorBackPath, goBack, goto, overlayTitle } from '$lib/services/app/navigation';
  import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
  import { isDraftReadonly } from '$lib/services/config/readonly';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { getCollectionFileLabel } from '$lib/services/contents/collection/files';
  import { isNestedCollection, nestedFilterPath } from '$lib/services/contents/collection/nested';
  import { collectionState } from '$lib/services/contents/collection/view';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { canResetEntry } from '$lib/services/contents/draft/update/reset';
  import { activeInlineEditors, copyFromLocaleToast } from '$lib/services/contents/editor';
  import { fieldUpdatePending } from '$lib/services/contents/editor/pending';
  import { createResetMenuState } from '$lib/services/contents/editor/reset-menu.svelte';
  import { duplicateEntryDraft, saveEntryDraftFlow } from '$lib/services/contents/editor/save';
  import { getSidebarPanels, showSidebarPanel } from '$lib/services/contents/editor/sidebar';
  import { canUpdateSlug } from '$lib/services/contents/editor/slug';
  import { getEntryToolbarState } from '$lib/services/contents/editor/toolbar';
  import { getEntryRelativeAssets } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
  import { deployPollTimedOut } from '$lib/services/deployments';
  import { recheckDeployments, retainDeployPolling } from '$lib/services/deployments/poll';
  import { isSearchResultsPath } from '$lib/services/search/navigation';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import {
    checkPublishedVersion,
    getUnpublishedEntryByDraft,
    isDirectPublishAllowed,
    isPendingDeletion,
    isWorkflowEnabled,
    workflowEnabled,
  } from '$lib/services/workflow';
  import { getDiscardDialogStrings } from '$lib/services/workflow/dialogs';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
   * @import { WorkflowStatus } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable controls other than the Back button.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  let showValidationToast = $state(false);
  // Number of invalid fields when the last save failed validation. A snapshot rather than a live
  // count: the fields are revalidated as they’re corrected, and a toast counting down to “0 fields
  // have errors” while it’s still on screen would be confusing
  let errorCount = $state(0);
  let showReviewDialog = $state(false);
  /**
   * Stage the review prompt offers to move the entry just saved to.
   * @type {WorkflowStatus | undefined}
   */
  let reviewStage = $state();
  /**
   * Resolver for the review prompt, so the save can wait for the answer.
   * @type {((sendForReview: boolean) => void) | undefined}
   */
  let resolveReviewPrompt = $state();
  let showConflictDialog = $state(false);
  /**
   * Someone else’s change to the entry that the last save attempt would have overwritten, along
   * with the options of that attempt, so the save can be repeated as asked once the user agrees.
   * @type {{ conflict: EntryConflict, skipCI: boolean | undefined, publish: boolean } | undefined}
   */
  let saveConflict = $state();
  let showErrorDialog = $state(false);
  let errorMessage = $state('');
  let saving = $state(false);
  /** Whether the entry being saved is also being published, bypassing the review. */
  let publishing = $state(false);
  let deleting = $state(false);
  /** Whether the entry is being duplicated, which takes a moment when it has assets to copy. */
  let duplicating = $state(false);
  /** @type {MenuButton | undefined} */
  let menuButton = $state();
  /** @type {EntryRemoval | undefined} */
  let entryRemoval = $state();
  const resetMenu = createResetMenuState(() => {
    const draft = entryDraft.current;

    return {
      restore: !!draft && canResetEntry({ draft, restore: true }),
      clear: !!draft && canResetEntry({ draft }),
    };
  });

  const notFound = $derived(entryDraft.current === undefined);
  const isNew = $derived(entryDraft.current?.isNew ?? true);
  const isIndexFile = $derived(!!entryDraft.current?.isIndexFile);
  const collection = $derived(entryDraft.current?.collection);
  const collectionFile = $derived(entryDraft.current?.collectionFile);
  const originalEntry = $derived(entryDraft.current?.originalEntry);
  const { defaultLocale } = $derived(getDraftI18nConfig(entryDraft.current));
  const collectionName = $derived(collection?.name);
  const fileName = $derived(collectionFile?.name);
  /* v8 ignore start -- only read for an existing entry, which has a collection */
  // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
  const collectionLabel = $derived(
    appLocale.current && collection ? getCollectionLabel(collection) : '',
  );
  /* v8 ignore stop */
  const collectionLabelSingular = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && collection ? getCollectionLabel(collection, { useSingular: true }) : '',
  );
  /* v8 ignore start -- only read for an existing entry, which has a collection */
  const entrySummary = $derived(
    collectionFile
      ? getCollectionFileLabel(collectionFile)
      : collection && originalEntry && appLocale.current
        ? getEntrySummary(collection, originalEntry)
        : '',
  );
  /* v8 ignore stop */
  // Heading of the toolbar, also used as the document title while the editor is open
  const title = $derived(
    notFound
      ? ''
      : isNew
        ? _('create_entry_title', { values: { name: collectionLabelSingular } })
        : `${collectionLabel} › ${entrySummary}`,
  );

  $effect(() => {
    overlayTitle.current = title;

    return () => {
      overlayTitle.current = '';
    };
  });
  // Saving, deleting or duplicating takes a moment and navigates away when it’s done, so the whole
  // control group is locked meanwhile rather than just the button that started it
  const busy = $derived(saving || deleting || duplicating);
  const controlsDisabled = $derived(disabled || busy);
  // A change still on its way to the draft counts, so a save can be started right after it
  const modified = $derived(isNew || entryDraft.modified || fieldUpdatePending.current);
  const associatedAssets = $derived(
    collectionName && originalEntry
      ? getEntryRelativeAssets({ entry: originalEntry, collectionName, fileName })
      : [],
  );
  // Look the entry up in the store rather than using `originalEntry` directly, so the status button
  // stays in sync when the status is changed elsewhere, e.g. on the Editorial Workflow page
  const unpublishedEntry = $derived(
    workflowEnabled.current && collectionName
      ? getUnpublishedEntryByDraft({ collectionName, fileName, originalEntry })
      : undefined,
  );
  // The entry can be published from another view, so the check depends on `allEntries`
  const publishedVersionExists = $derived(checkPublishedVersion(unpublishedEntry));
  const pendingDeletion = $derived(isPendingDeletion(unpublishedEntry));
  const readonly = $derived(isDraftReadonly(entryDraft.current));
  const { useWorkflow, discardsDraft, locked, canDuplicate, removalMenuItems } = $derived(
    getEntryToolbarState({
      collection,
      collectionFile,
      isIndexFile,
      hasPullRequest: !!unpublishedEntry,
      workflowEnabled: isWorkflowEnabled(collection),
      publishedVersionExists,
      pendingDeletion,
      readonly,
      openAuthoring: openAuthoring.current,
      creationDisabled: collectionState.current.creationDisabled,
    }),
  );
  // A workflow draft can also be saved and published in one go, if the publish mode allows it
  const directPublish = $derived(
    useWorkflow && isDirectPublishAllowed(collection, unpublishedEntry),
  );
  // The review prompt hands the entry over for review, or marks it ready when there’s no review
  const reviewDialogLabel = $derived(
    _(reviewStage === 'pending_publish' ? 'workflow.mark_as_ready' : 'workflow.send_for_review'),
  );
  // The menu item either throws the pull request away or deletes the entry outright, depending on
  // whether it has been published
  const discardItemStrings = $derived(
    getDiscardDialogStrings({ pendingDeletion, publishedVersionExists }),
  );

  // Keep the deploy state fresh while the editor is open, so a build that finishes in the
  // background turns the preview link live without the user reloading. The release function is
  // returned synchronously; awaiting anything first would lose the handle and leak the hold
  $effect(() => retainDeployPolling());

  /**
   * Go back to the previous page: the search results if the entry was opened from them, or the
   * path given by `getEntryEditorBackPath()` otherwise.
   */
  const _goBack = () => {
    const dirPath = collection && isNestedCollection(collection) ? nestedFilterPath.current : '';

    goBack(getEntryEditorBackPath({ collectionName, dirPath }), {
      returnTo: isSearchResultsPath,
    });
  };

  /**
   * Ask whether the entry just saved should be moved to the given stage, e.g. handed over for
   * review, and wait for the answer.
   * @param {WorkflowStatus} stage Next stage.
   * @returns {Promise<boolean>} `true` if the user wants to move it.
   */
  const askForReview = (stage) =>
    new Promise((resolve) => {
      reviewStage = stage;
      resolveReviewPrompt = resolve;
      showReviewDialog = true;
    });

  /**
   * Check whether the entry is saved to a pull request. Read once the entry is saved, as saving it
   * may have opened a pull request.
   * @returns {boolean} Result.
   */
  const isWorkflowUsed = () => useWorkflow;

  /**
   * Check whether the editor is to be closed once the entry is saved.
   * @returns {boolean} Result.
   */
  const isCloseOnSaveEnabled = () => prefs.closeOnSave ?? true;

  /**
   * Save the entry draft.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
   * @param {boolean} [options.overwrite] Whether to save over someone else’s change to the entry,
   * once the user has been asked.
   * @param {boolean} [options.publish] Whether to publish the entry along with the save, bypassing
   * the review.
   */
  const save = async ({ skipCI = undefined, overwrite = false, publish = false } = {}) => {
    const draft = entryDraft.current;

    if (!collection || !draft) {
      return;
    }

    saving = true;
    publishing = publish;

    try {
      const outcome = await saveEntryDraftFlow({
        entryDraft,
        useWorkflow: isWorkflowUsed,
        skipCI,
        overwrite,
        publish,
        askForReview,
        closeOnSave: isCloseOnSaveEnabled,
      });

      if (outcome.type === 'saved') {
        if (outcome.statusError !== undefined) {
          showErrorDialog = true;
          errorMessage = outcome.statusError;
        }

        if (outcome.path) {
          goto(outcome.path, { replaceState: true, notifyChange: false });
        }

        if (outcome.next === 'close') {
          _goBack();
          entryDraft.current = null;
        } else if (outcome.next === 'reset') {
          createDraft({
            entryDraft,
            collection,
            collectionFile,
            originalEntry: outcome.savedEntry,
            extraValues: draft.extraValues,
            expanderStates: draft.expanderStates,
          });
        }
      } else if (outcome.type === 'invalid') {
        errorCount = outcome.errorCount;
        showValidationToast = true;
      } else if (outcome.type === 'conflict') {
        // Someone else has changed the entry since it was opened; let the user decide
        saveConflict = { conflict: outcome.conflict, skipCI, publish };
        showConflictDialog = true;
      } else if (outcome.type === 'error') {
        showErrorDialog = true;
        errorMessage = outcome.message;
      }
    } finally {
      saving = false;
      publishing = false;
    }
  };
</script>

{#snippet overflowButtons()}
  {#if !disabled && collection && originalEntry}
    <PreviewLinkButton
      entry={originalEntry}
      locale={defaultLocale}
      {collection}
      {collectionFile}
      pullRequest={unpublishedEntry?.workflow?.pullRequest}
      iconic={!env.isLargeScreen}
      as={env.isSmallScreen ? 'menuitem' : 'button'}
    />
  {/if}
{/snippet}

<Toolbar variant="primary" ariaLabel={_('primary')}>
  <BackButton
    aria-label={_('cancel_editing')}
    useShortcut={prefs.closeWithEscape && !activeInlineEditors.current}
    onclick={() => {
      _goBack();
    }}
  />
  {#if env.isSmallScreen}
    <Spacer flex />
  {:else}
    <h2 role="none">
      {#if !notFound}
        <TruncatedText>
          {#if isNew}
            {title}
          {:else}
            <bdi>{collectionLabel}</bdi> › <bdi>{entrySummary}</bdi>
          {/if}
        </TruncatedText>
      {/if}
    </h2>
  {/if}
  {#if !env.isSmallScreen}
    {@render overflowButtons()}
  {/if}
  {#if unpublishedEntry && !locked}
    <EntryStatusMenu entry={unpublishedEntry} disabled={controlsDisabled} />
  {/if}
  {#if locked}
    <!-- Nothing to save: the entry is read-only, or shown for reference until the deletion is
    carried out -->
  {:else if skipCIConfigured.current && !useWorkflow}
    <SplitButton
      variant="primary"
      label={_(
        skipCIEnabled.current ? (saving ? 'saving' : 'save') : saving ? 'publishing' : 'publish',
      )}
      disabled={controlsDisabled || !modified}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    >
      {#snippet popup()}
        <!-- Show the opposite option: if automatic deployments are enabled, allow to disable it -->
        <Menu>
          <MenuItem
            label={_(skipCIEnabled.current ? 'save_and_publish' : 'save_without_publishing')}
            onclick={() => {
              save({ skipCI: !skipCIEnabled.current });
            }}
          />
        </Menu>
      {/snippet}
    </SplitButton>
  {:else if directPublish}
    <!-- Saving keeps the entry as a draft for review, while the popup item publishes it now -->
    <SplitButton
      variant="primary"
      label={_(saving ? (publishing ? 'publishing' : 'saving') : 'save')}
      disabled={controlsDisabled || !modified}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    >
      {#snippet popup()}
        <Menu>
          <MenuItem
            label={_('save_and_publish')}
            onclick={() => {
              // A change published directly has to be deployed, whatever the `skip_ci` option says
              save({ publish: true, skipCI: false });
            }}
          />
        </Menu>
      {/snippet}
    </SplitButton>
  {:else}
    <Button
      variant="primary"
      label={_(saving ? 'saving' : 'save')}
      disabled={controlsDisabled || !modified}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    />
  {/if}
  {#if unpublishedEntry && !readonly}
    <PublishEntryButton entry={unpublishedEntry} disabled={controlsDisabled} {modified} />
  {/if}
  <MenuButton
    disabled={controlsDisabled}
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={_('show_editor_options')}
    onclick={resetMenu.update}
    onkeydown={resetMenu.update}
    bind:this={menuButton}
  >
    {#snippet popup()}
      <Menu ariaLabel={_('editor_options')}>
        {#if env.isSmallScreen}
          {@render overflowButtons()}
          <!-- The sidebar doesn’t fit on a small screen, so its panels open in a bottom sheet. The
            menu can’t be opened while the toolbar is disabled -->
          {#if !notFound}
            {#each getSidebarPanels(entryDraft.current) as { key, disabled: panelDisabled } (key)}
              <MenuItem
                label={_(`entry_sidebar.${key}.title`)}
                disabled={panelDisabled}
                onclick={() => {
                  showSidebarPanel(key);
                }}
              />
            {/each}
            <Divider />
          {/if}
        {/if}
        {#if !disabled && !isNew}
          {#if canDuplicate}
            <MenuItem
              variant="ghost"
              disabled={controlsDisabled}
              label={_('duplicate')}
              aria-label={_('duplicate_entry')}
              onclick={async () => {
                duplicating = true;

                // The URL is updated only once the duplicate is in place
                const path = await duplicateEntryDraft(entryDraft);

                duplicating = false;

                if (path) {
                  goto(path, {
                    replaceState: true,
                    notifyChange: false,
                    transitionType: 'forwards',
                  });
                }
              }}
            />
          {/if}
          {#if removalMenuItems.discard}
            <MenuItem
              variant="ghost"
              disabled={controlsDisabled}
              label={discardItemStrings.label}
              aria-label={discardItemStrings.title}
              onclick={() => {
                if (publishedVersionExists) {
                  entryRemoval?.confirmDiscard();
                } else {
                  entryRemoval?.confirmDelete();
                }
              }}
            />
          {/if}
        {/if}
        {#if removalMenuItems.delete}
          <MenuItem
            label={_('delete')}
            onclick={() => {
              entryRemoval?.confirmDelete();
            }}
          />
        {/if}
        <!-- A shortcut to the Slug panel, which a small screen lists above along with the other
          sidebar panels -->
        {#if !env.isSmallScreen}
          <MenuItem
            label={_('edit_slug')}
            disabled={!canUpdateSlug(entryDraft.current)}
            onclick={() => {
              showSidebarPanel('slug');
            }}
          />
        {/if}
        <!-- A small screen lists the sidebar panels above, ending with a separator of their own -->
        <ResetMenuItems
          scope="entry"
          separator={!env.isSmallScreen || (!disabled && !isNew)}
          available={{
            revert: modified && !locked,
            restore: resetMenu.availability.restore && !locked,
            clear: resetMenu.availability.clear && !locked,
          }}
          onSelect={resetMenu.select}
        />
        {#if deployPollTimedOut.current}
          <Divider />
          <MenuItem
            label={_('deploy_preview.check_again')}
            onclick={() => {
              recheckDeployments();
            }}
          />
        {/if}
        {#if env.isLargeScreen}
          <ViewMenuItems />
        {/if}
      </Menu>
    {/snippet}
  </MenuButton>
</Toolbar>

<ValidationErrorsToast
  bind:show={showValidationToast}
  count={errorCount}
  onShowErrors={() => {
    showSidebarPanel('validation');
  }}
/>

<Toast id={copyFromLocaleToast.current.id} bind:show={copyFromLocaleToast.current.show}>
  {@const { status, message, count, sourceLanguage } = copyFromLocaleToast.current}
  <Alert {status}>
    {_(`editor.${message}`, {
      values: {
        count,
        source: sourceLanguage ? (getLocaleLabel(sourceLanguage) ?? sourceLanguage) : '',
      },
    })}
  </Alert>
</Toast>

<ResetDialog
  bind:open={resetMenu.dialogOpen}
  action={resetMenu.action}
  onClose={() => {
    menuButton?.focus();
  }}
/>

<ConfirmationDialog
  bind:open={showReviewDialog}
  title={reviewDialogLabel}
  okLabel={reviewDialogLabel}
  cancelLabel={_('later')}
  onOk={() => {
    resolveReviewPrompt?.(true);
  }}
  onClose={() => {
    // Covers the Later button, the Escape key and any other way out. Sending has already settled
    // the prompt, so this leaves it alone
    resolveReviewPrompt?.(false);
  }}
>
  {_(
    reviewStage === 'pending_publish'
      ? 'workflow.confirm_marking_as_ready'
      : 'workflow.confirm_sending_for_review',
  )}
</ConfirmationDialog>

<EntryRemoval
  bind:this={entryRemoval}
  bind:deleting
  {collection}
  {collectionFile}
  {originalEntry}
  {unpublishedEntry}
  {associatedAssets}
  {discardsDraft}
  {useWorkflow}
  {pendingDeletion}
  onDone={() => {
    _goBack();
  }}
  onClose={() => {
    menuButton?.focus();
  }}
/>

<SaveConflictDialog
  bind:open={showConflictDialog}
  conflict={saveConflict?.conflict}
  onOverwrite={async () => {
    await save({ skipCI: saveConflict?.skipCI, overwrite: true, publish: saveConflict?.publish });
  }}
  onClose={() => {
    menuButton?.focus();
  }}
/>

<!-- @todo make the error message more informative -->
<AlertDialog
  bind:open={showErrorDialog}
  title={_('saving_entry.error.title')}
  onClose={() => {
    menuButton?.focus();
  }}
>
  {_('saving_entry.error.description')}
  {#if errorMessage}
    <div role="none" class="error">
      {errorMessage}
    </div>
  {/if}
</AlertDialog>

<style>
  .error {
    margin-top: 8px;
    border-radius: var(--sui-control-medium-border-radius);
    padding: 12px;
    background-color: var(--sui-secondary-background-color);
    font-size: var(--sui-font-size-default);
    line-height: 1.5;
  }
</style>
