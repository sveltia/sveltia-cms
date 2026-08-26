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
    MenuItemCheckbox,
    Spacer,
    SplitButton,
    Toast,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import EditSlugDialog from '$lib/components/contents/details/edit-slug-dialog.svelte';
  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import EntryStatusMenu from '$lib/components/workflow/entry-status-menu.svelte';
  import PublishEntryButton from '$lib/components/workflow/publish-entry-button.svelte';
  import { goBack, goto } from '$lib/services/app/navigation';
  import { getAssetFolder } from '$lib/services/assets/folders';
  import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
  import { allEntries } from '$lib/services/contents';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import {
    contentUpdatesToast,
    UPDATE_TOAST_DEFAULT_STATE,
  } from '$lib/services/contents/collection/data';
  import { deleteEntries } from '$lib/services/contents/collection/data/delete';
  import { getCollectionFileLabel } from '$lib/services/contents/collection/files';
  import { collectionState } from '$lib/services/contents/collection/view';
  import { entryDraft, entryDraftModified } from '$lib/services/contents/draft';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { duplicateDraft } from '$lib/services/contents/draft/create/duplicate';
  import { saveEntry } from '$lib/services/contents/draft/save';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { activeInlineEditors, copyFromLocaleToast } from '$lib/services/contents/editor';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { deployPollTimedOut } from '$lib/services/deployments';
  import { recheckDeployments, retainDeployPolling } from '$lib/services/deployments/poll';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import {
    hasPublishedVersion,
    isPendingDeletion,
    unpublishedEntries,
    workflowEnabled,
  } from '$lib/services/workflow';
  import { getBranchName } from '$lib/services/workflow/branch';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';
  import {
    deleteWorkflowEntry,
    discardWorkflowEntry,
    updateWorkflowStatus,
  } from '$lib/services/workflow/save';

  /**
   * @import { UnpublishedEntry, UpdateToastState } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable controls other than the Back button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  let showValidationToast = $state(false);
  let showEditSlugDialog = $state(false);
  let showDeleteDialog = $state(false);
  let showReviewDialog = $state(false);
  /**
   * Resolver for the review prompt, so the save can wait for the answer.
   * @type {((sendForReview: boolean) => void) | undefined}
   */
  let resolveReviewPrompt = $state();
  let showDiscardDialog = $state(false);
  let showDeleteErrorToast = $state(false);
  let showErrorDialog = $state(false);
  let errorMessage = $state('');
  let saving = $state(false);
  let deleting = $state(false);
  /** I18n key of the message shown while a deletion is in flight. */
  let progressMessage = $state('');
  /** @type {MenuButton | undefined} */
  let menuButton = $state();

  const notFound = $derived($entryDraft === undefined);
  const isNew = $derived($entryDraft?.isNew ?? true);
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const entryCollection = $derived(collection?._type === 'entry' ? collection : undefined);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalEntry = $derived($entryDraft?.originalEntry);
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const collectionName = $derived(collection?.name);
  const fileName = $derived(collectionFile?.name);
  const collectionLabel = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && collection ? getCollectionLabel(collection) : '',
  );
  const collectionLabelSingular = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && collection ? getCollectionLabel(collection, { useSingular: true }) : '',
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const showSecondPane = $derived($entryEditorSettings?.showSecondPane ?? true);
  // There’s only something to put in the second pane when another locale can be edited alongside
  // the first one, or when the entry has a preview
  const canShowSecondPane = $derived((i18nEnabled && allLocales.length > 1) || canPreview);
  // Saving or deleting takes a moment and navigates away when it’s done, so the whole control group
  // is locked meanwhile rather than just the button that started it
  const busy = $derived(saving || deleting);
  const controlsDisabled = $derived(disabled || busy);
  const modified = $derived(isNew || $entryDraftModified);
  const errorCount = $derived(
    Object.values($entryDraft?.validities ?? {})
      .flatMap((validity) => Object.values(validity).map(({ valid }) => !valid))
      .filter(Boolean).length,
  );
  const associatedAssets = $derived(
    collectionName && originalEntry && getAssetFolder({ collectionName, fileName })?.entryRelative
      ? getAssociatedAssets({ entry: originalEntry, collectionName, fileName, relative: true })
      : [],
  );
  const workflowBranch = $derived(
    $workflowEnabled && collectionName && originalEntry
      ? getBranchName({ collectionName, slug: fileName ?? originalEntry.slug })
      : undefined,
  );
  // Look the entry up in the store rather than using `originalEntry` directly, so the status button
  // stays in sync when the status is changed elsewhere, e.g. on the Editorial Workflow page
  const unpublishedEntry = $derived(
    workflowBranch
      ? $unpublishedEntries.find(({ workflow }) => workflow.pullRequest.branch === workflowBranch)
      : undefined,
  );
  // The `delete` option only blocks taking an entry off the site. Discarding a pull request leaves
  // the published version untouched, so it stays available even when deletion is disabled
  const canDelete = $derived(entryCollection?.delete !== false);
  // `$allEntries` is a dependency, because the entry can be published from another view
  const publishedVersionExists = $derived(
    !!unpublishedEntry && !!$allEntries && hasPublishedVersion(unpublishedEntry),
  );
  // Deleting an entry that was never published just throws the draft away; anything else takes an
  // entry off the site
  const discardsDraft = $derived(!!unpublishedEntry && !publishedVersionExists);
  // Taking a published entry off the site is a maintainer’s call. An Open Authoring contributor can
  // discard their own draft, but not propose the removal of something already live
  const canDeleteEntry = $derived(canDelete && (discardsDraft || !$openAuthoring));
  // An entry awaiting deletion is read-only: there’s nothing to save or move through the stages,
  // only the deletion itself to carry out or call off
  const pendingDeletion = $derived(isPendingDeletion(unpublishedEntry));

  // Keep the deploy state fresh while the editor is open, so a build that finishes in the
  // background turns the preview link live without the user reloading. The release function is
  // returned synchronously; awaiting anything first would lose the handle and leak the hold
  $effect(() => retainDeployPolling());

  /**
   * Go back to the previous page. If the entry is a singleton file, go to the collections list.
   * Otherwise, go to the collection entries list.
   */
  const _goBack = () => {
    goBack(collectionName === '_singletons' ? '/collections' : `/collections/${collectionName}`);
  };

  /**
   * Run the given deletion action, then go back to the entry list. The action reports what happened
   * by returning a toast state, which is shown by the content library page: the editor is closed by
   * then, so a toast rendered here would go with it. Errors are reported with a toast and leave the
   * editor open.
   * @param {() => Promise<Partial<UpdateToastState> | undefined>} action Action to be performed.
   * @param {string} progressKey I18n key of the message shown while the action is in flight.
   */
  const runDeletion = async (action, progressKey) => {
    /** @type {Partial<UpdateToastState> | undefined} */
    let toastState;

    progressMessage = progressKey;
    deleting = true;

    try {
      toastState = await action();
    } catch (/** @type {any} */ ex) {
      showDeleteErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);

      return;
    } finally {
      deleting = false;
    }

    if (toastState) {
      contentUpdatesToast.set({ ...UPDATE_TOAST_DEFAULT_STATE, count: 1, ...toastState });
    }

    _goBack();
  };

  /**
   * Delete the entry. With Editorial Workflow the removal goes through a pull request like any
   * other change, so the entry stays on the site until that is published. An unpublished entry that
   * has never been published is discarded instead, because there’s nothing on the configured branch
   * to remove.
   */
  const deleteEntry = async () => {
    await runDeletion(async () => {
      if (unpublishedEntry && !publishedVersionExists) {
        await discardWorkflowEntry(unpublishedEntry);

        // Nothing was published, so the entry really is gone
        return { deleted: true };
      }

      if (originalEntry && $workflowEnabled && collection) {
        await deleteWorkflowEntry(originalEntry, collection, collectionFile, associatedAssets);

        return { deleted: true, deletionPending: true };
      }

      if (originalEntry) {
        // `deleteEntries()` reports the outcome itself
        await deleteEntries([originalEntry], associatedAssets);
      }

      return undefined;
    }, 'workflow.deleting_entry');
  };

  /**
   * Discard the unpublished changes by closing the pull request, leaving the published version of
   * the entry untouched.
   */
  const discardChanges = async () => {
    await runDeletion(
      async () => {
        if (unpublishedEntry) {
          await discardWorkflowEntry(unpublishedEntry);
        }

        return pendingDeletion ? { deletionCancelled: true } : { discarded: true };
      },
      pendingDeletion ? 'workflow.cancelling_deletion' : 'workflow.discarding_changes',
    );
  };

  /**
   * Save the entry draft.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
   */
  /**
   * Ask whether the entry just saved should be handed over for review, and wait for the answer.
   * @returns {Promise<boolean>} `true` if the user wants to send it.
   */
  const askForReview = () =>
    new Promise((resolve) => {
      resolveReviewPrompt = resolve;
      showReviewDialog = true;
    });

  /**
   * Save the entry draft.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
   */
  const save = async ({ skipCI = undefined } = {}) => {
    saving = true;

    if (!collection) {
      return;
    }

    try {
      const savedEntry = await saveEntry({ skipCI });
      const savedDraft = /** @type {UnpublishedEntry} */ (savedEntry);

      // Saving with Editorial Workflow leaves the entry as a draft, which nothing on screen says:
      // it hasn’t been handed to anyone yet, and the status menu that would do it is easy to miss.
      // Offer it as the next step instead, once, while the entry is still in the drafting stage
      if ($workflowEnabled && savedDraft.workflow?.status === 'draft' && (await askForReview())) {
        try {
          await updateWorkflowStatus(savedDraft, 'pending_review');
        } catch (/** @type {any} */ ex) {
          showErrorDialog = true;
          errorMessage = _('workflow.status_change_failed');
          // eslint-disable-next-line no-console
          console.error(ex);

          // The entry itself is saved, so leave the editor open rather than navigating away from a
          // failure the user may want to retry from the status menu
          return;
        }
      }

      if (prefs.closeOnSave ?? true) {
        _goBack();
        $entryDraft = null;
      } else {
        if (isNew) {
          // Update the URL. A collection file is addressed by its name, while its `subPath` is
          // the whole file path
          goto(`/collections/${collectionName}/entries/${fileName ?? savedEntry.subPath}`, {
            replaceState: true,
            notifyChange: false,
            transitionType: 'backwards',
          });
        }

        // Reset the draft
        createDraft({
          collection,
          collectionFile,
          originalEntry: savedEntry,
          extraValues: $entryDraft?.extraValues,
          expanderStates: $entryDraft?.expanderStates,
        });
      }
    } catch (/** @type {any} */ ex) {
      if (ex.message === 'validation_failed') {
        showValidationToast = true;
      } else if (ex.message === 'saving_failed') {
        showErrorDialog = true;
        errorMessage = ex.cause?.message ?? ex.message ?? _('unexpected_error');
      } else {
        showErrorDialog = true;
        errorMessage = '';
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    } finally {
      saving = false;
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

<Toolbar variant="primary" aria-label={_('primary')}>
  <BackButton
    aria-label={_('cancel_editing')}
    useShortcut={prefs.closeWithEscape && !$activeInlineEditors}
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
            {_('create_entry_title', { values: { name: collectionLabelSingular } })}
          {:else}
            {@const entrySummary = collectionFile
              ? getCollectionFileLabel(collectionFile)
              : collection && originalEntry && appLocale.current
                ? getEntrySummary(collection, originalEntry)
                : ''}
            {#if env.isSmallScreen}
              {entrySummary}
            {:else}
              {_('edit_entry_title', {
                values: { collection: collectionLabel, entry: entrySummary },
              })}
            {/if}
          {/if}
        </TruncatedText>
      {/if}
    </h2>
  {/if}
  {#if !env.isSmallScreen}
    {@render overflowButtons()}
  {/if}
  {#if unpublishedEntry && !pendingDeletion}
    <EntryStatusMenu entry={unpublishedEntry} disabled={controlsDisabled} />
  {/if}
  {#if pendingDeletion}
    <!-- Nothing to save: the entry is shown for reference until the deletion is carried out -->
  {:else if $skipCIConfigured && !$workflowEnabled}
    <SplitButton
      variant="primary"
      label={_($skipCIEnabled ? (saving ? 'saving' : 'save') : saving ? 'publishing' : 'publish')}
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
            label={_($skipCIEnabled ? 'save_and_publish' : 'save_without_publishing')}
            onclick={() => {
              save({ skipCI: !$skipCIEnabled });
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
  {#if unpublishedEntry}
    <PublishEntryButton entry={unpublishedEntry} disabled={controlsDisabled} {modified} />
  {/if}
  <MenuButton
    disabled={controlsDisabled}
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={_('show_editor_options')}
    bind:this={menuButton}
  >
    {#snippet popup()}
      <Menu aria-label={_('editor_options')}>
        {#if env.isSmallScreen}
          {@render overflowButtons()}
        {/if}
        {#if !disabled && !isNew}
          {@const canDuplicate =
            !collectionFile &&
            !isIndexFile &&
            entryCollection?.duplicate !== false &&
            !$collectionState.creationDisabled &&
            // @todo Enable duplication for Hugo’s page bundles = the `path` option. We need to
            // duplicate assets along with the entry.
            // @see https://github.com/sveltia/sveltia-cms/issues/526
            !entryCollection?.path}
          {#if canDuplicate}
            <MenuItem
              variant="ghost"
              disabled={controlsDisabled}
              label={_('duplicate')}
              aria-label={_('duplicate_entry')}
              onclick={() => {
                goto(`/collections/${collectionName}/new`, {
                  replaceState: true,
                  notifyChange: false,
                  transitionType: 'forwards',
                });
                duplicateDraft();
              }}
            />
          {/if}
          <!-- A collection file is part of the collection definition, so it can only be
            discarded -->
          {#if publishedVersionExists || (canDeleteEntry && !collectionFile)}
            <MenuItem
              variant="ghost"
              disabled={controlsDisabled}
              label={_(
                pendingDeletion
                  ? 'workflow.cancel_deletion'
                  : publishedVersionExists
                    ? 'discard'
                    : 'delete',
              )}
              aria-label={pendingDeletion
                ? _('workflow.cancel_deletion')
                : publishedVersionExists
                  ? _('workflow.discard_changes')
                  : _('delete_entries', { values: { count: 1 } })}
              onclick={() => {
                if (publishedVersionExists) {
                  showDiscardDialog = true;
                } else {
                  showDeleteDialog = true;
                }
              }}
            />
          {/if}
        {/if}
        {#if publishedVersionExists && canDeleteEntry && !collectionFile && !pendingDeletion}
          <MenuItem
            label={_('delete')}
            onclick={() => {
              showDeleteDialog = true;
            }}
          />
        {/if}
        <MenuItem
          label={_('edit_slug')}
          disabled={!!collectionFile ||
            isNew ||
            isIndexFile ||
            pendingDeletion ||
            entryCollection?.delete === false}
          onclick={() => {
            showEditSlugDialog = true;
          }}
        />
        <MenuItem
          label={_('revert_all_changes')}
          disabled={!modified || pendingDeletion}
          onclick={() => {
            revertChanges();
          }}
        />
        {#if $deployPollTimedOut}
          <Divider />
          <MenuItem
            label={_('deploy_preview.check_again')}
            onclick={() => {
              recheckDeployments();
            }}
          />
        {/if}
        {#if env.isLargeScreen}
          <Divider />
          <MenuItemCheckbox
            label={_('show_second_pane')}
            checked={showSecondPane}
            disabled={!canShowSecondPane}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                showSecondPane: !(view.showSecondPane ?? true),
              }));
            }}
          />
          <!-- The preview is rendered in the second pane, so it’s unavailable while hidden -->
          <MenuItemCheckbox
            label={_('show_preview')}
            checked={$entryEditorSettings?.showPreview}
            disabled={!showSecondPane || !canPreview}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                showPreview: !view.showPreview,
              }));
            }}
          />
          <MenuItemCheckbox
            label={_('sync_scrolling')}
            checked={$entryEditorSettings?.syncScrolling}
            disabled={!showSecondPane ||
              (!canPreview && Object.keys($entryDraft?.currentValues ?? {}).length === 1)}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                syncScrolling: !view.syncScrolling,
              }));
            }}
          />
        {/if}
      </Menu>
    {/snippet}
  </MenuButton>
</Toolbar>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {_('entry_validation_errors', { values: { count: errorCount } })}
  </Alert>
</Toast>

<Toast id={$copyFromLocaleToast.id} bind:show={$copyFromLocaleToast.show}>
  {@const { status, message, count, sourceLanguage } = $copyFromLocaleToast}
  <Alert {status}>
    {_(`editor.${message}`, {
      values: {
        count,
        source: sourceLanguage ? (getLocaleLabel(sourceLanguage) ?? sourceLanguage) : '',
      },
    })}
  </Alert>
</Toast>

<EditSlugDialog bind:open={showEditSlugDialog} />

<ConfirmationDialog
  bind:open={showReviewDialog}
  title={_('workflow.send_for_review')}
  okLabel={_('workflow.send_for_review')}
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
  {_('workflow.confirm_sending_for_review')}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={_('delete_entries', { values: { count: 1 } })}
  okLabel={_('delete')}
  onOk={async () => {
    await deleteEntry();
  }}
  onClose={() => {
    menuButton?.focus();
  }}
>
  {#if unpublishedEntry && !publishedVersionExists}
    {_('workflow.confirm_deleting_unpublished_entry')}
  {:else if $workflowEnabled}
    <!-- The removal is committed to a pull request rather than to the configured branch -->
    {_('workflow.confirm_deleting_published_entry')}
  {:else}
    {_(
      associatedAssets.length
        ? 'confirm_deleting_this_entry_with_assets'
        : 'confirm_deleting_this_entry',
    )}
  {/if}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showDiscardDialog}
  title={_(pendingDeletion ? 'workflow.cancel_deletion' : 'workflow.discard_changes')}
  okLabel={_(pendingDeletion ? 'workflow.cancel_deletion' : 'discard')}
  onOk={async () => {
    await discardChanges();
  }}
  onClose={() => {
    menuButton?.focus();
  }}
>
  {_(
    pendingDeletion
      ? 'workflow.confirm_cancelling_deletion'
      : 'workflow.confirm_discarding_entry_changes',
  )}
</ConfirmationDialog>

<!-- Shown while the request is in flight. The result is reported by the content library page,
because this toast goes away with the editor once the deletion has completed -->
{#if progressMessage}
  <Toast id={progressMessage} bind:show={deleting} duration={0}>
    <Alert status="info">{_(progressMessage)}</Alert>
  </Toast>
{/if}

<Toast bind:show={showDeleteErrorToast}>
  <Alert status="error">{_('deleting_entry_failed')}</Alert>
</Toast>

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
