<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import {
    Button,
    FloatingActionButtonWrapper,
    Infobar,
    Spacer,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';
  import { tick } from 'svelte';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import BulkEditControls from '$lib/components/contents/list/bulk-edit-controls.svelte';
  import ReorderControls from '$lib/components/contents/list/reorder-controls.svelte';
  import DeleteEntriesDialog from '$lib/components/contents/shared/delete-entries-dialog.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { focusList } from '$lib/services/app/focus';
  import { goBack } from '$lib/services/app/navigation';
  import { getReadonlyMessage } from '$lib/services/config/readonly';
  import { getCollectionLabel, selectedCollection } from '$lib/services/contents/collection';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import {
    bulkEditing,
    collectionState,
    listedEntries,
    listedUnpublishedEntries,
    reordering,
    setBulkEditMode,
    setReorderMode,
  } from '$lib/services/contents/collection/view';
  import { env } from '$lib/services/user/env.svelte';
  import { sanitizeInlineMarkdown } from '$lib/services/utils/string';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  let showDeleteDialog = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let deleteButton = $state();
  /** @type {HTMLButtonElement | undefined} */
  let reorderButton = $state();
  /** @type {ReorderControls | undefined} */
  let reorderControls = $state();
  /** @type {HTMLButtonElement | undefined} */
  let bulkEditButton = $state();
  /** @type {BulkEditControls | undefined} */
  let bulkEditControls = $state();

  /* v8 ignore start -- only read while a collection is selected, once the app locale is loaded */
  const name = $derived(selectedCollection.current?.name ?? '');
  const collectionLabel = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && selectedCollection.current
      ? getCollectionLabel(selectedCollection.current)
      : name,
  );
  /* v8 ignore stop */
  const description = $derived(selectedCollection.current?.description);
  const {
    isEntryCollection,
    readonly,
    canCreate,
    canDelete,
    canReorder,
    canBulkEdit,
    quota,
    remaining,
    nearingQuota,
    creationDisabled,
  } = $derived(collectionState.current);
  const deleteDisabled = $derived(!selectedEntries.current.length || !canDelete);
  // The empty entry list offers a Create button of its own, so the floating one is only needed once
  // the list has entries, including unpublished ones, which can be the only ones in the collection
  const hasEntries = $derived(
    !!(listedEntries.current.length || listedUnpublishedEntries.current.length),
  );

  // The Delete button is disabled once the selected entries are deleted, which would drop its focus
  // on `<body>`, so move it to the entry list. This runs before the button is updated, while it
  // still has the focus
  $effect.pre(() => {
    if (deleteDisabled && document.activeElement === deleteButton) {
      tick().then(() => focusList());
    }
  });
</script>

{#if selectedCollection.current}
  {#if readonly}
    <Infobar
      dismissible={false}
      --sui-infobar-border-width="0 0 1px"
      --sui-infobar-message-justify-content="center"
    >
      {getReadonlyMessage('collection', { collection: selectedCollection.current })}
    </Infobar>
  {:else if isEntryCollection && (creationDisabled || nearingQuota)}
    <!-- Only when not read-only, as the read-only message already says nothing can be created -->
    <Infobar
      dismissible={false}
      --sui-infobar-border-width="0 0 1px"
      --sui-infobar-message-justify-content="center"
    >
      {#if !canCreate}
        {_('creating_entries_disabled_by_admin')}
      {:else if creationDisabled}
        {_('creating_entries_disabled_by_quota', { values: { quota } })}
      {:else}
        {_('creating_entries_nearing_quota', { values: { quota, remaining } })}
      {/if}
    </Infobar>
  {/if}
  <Toolbar variant="primary" ariaLabel={_('collection')}>
    {#if env.isSmallScreen}
      <BackButton
        aria-label={_('back_to_collection_list')}
        onclick={() => {
          goBack('/collections');
        }}
      />
    {/if}
    <h2 role="none"><bdi>{collectionLabel}</bdi></h2>
    {#if env.isSmallScreen}
      <Spacer flex />
    {:else}
      <div role="none" class="description">
        <TruncatedText>
          <bdi>{@html sanitizeInlineMarkdown(description || '')}</bdi>
        </TruncatedText>
      </div>
    {/if}
    {#if isEntryCollection && reordering.current}
      <ReorderControls
        bind:this={reorderControls}
        onExit={async () => {
          // The Reorder button takes the place of the focused button
          await tick();
          /** @type {HTMLButtonElement} */ (reorderButton).focus();
        }}
      />
    {:else if isEntryCollection && bulkEditing.current}
      <BulkEditControls
        bind:this={bulkEditControls}
        onExit={async () => {
          // The Edit button takes the place of the focused button
          await tick();
          /** @type {HTMLButtonElement} */ (bulkEditButton).focus();
        }}
      />
    {:else if isEntryCollection}
      <!-- Taking a published entry off the site is a maintainer’s call, and the entry list has no
      other bulk action, so a contributor has nothing to select entries for -->
      {#if !env.isSmallScreen && !openAuthoring.current}
        <Button
          bind:element={deleteButton}
          variant="ghost"
          label={_('delete')}
          aria-label={_('delete_selected_entries', {
            values: { count: selectedEntries.current.length },
          })}
          disabled={deleteDisabled}
          onclick={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
      <!-- A table of controls doesn’t fit on a small screen -->
      {#if canBulkEdit && !env.isSmallScreen}
        <Button
          bind:element={bulkEditButton}
          variant="ghost"
          label={_('edit')}
          aria-label={_('bulk_edit_entries')}
          disabled={!listedEntries.current.length}
          onclick={async () => {
            setBulkEditMode(true);
            // The Save and Cancel buttons take the place of this one
            await tick();
            /** @type {BulkEditControls} */ (bulkEditControls).focus();
          }}
        />
      {/if}
      {#if canReorder}
        <Button
          bind:element={reorderButton}
          variant="ghost"
          label={_('reorder')}
          aria-label={_('reorder_entries')}
          disabled={!listedEntries.current.length}
          onclick={async () => {
            setReorderMode(true);
            // The Done and Cancel buttons take the place of this one
            await tick();
            /** @type {ReorderControls} */ (reorderControls).focus();
          }}
        />
      {/if}
      <FloatingActionButtonWrapper>
        {#if !env.isSmallScreen || (hasEntries && !creationDisabled)}
          <CreateEntryButton
            collectionName={name}
            label={env.isSmallScreen ? undefined : _('create')}
            keyShortcuts="Accel+E"
          />
        {/if}
      </FloatingActionButtonWrapper>
    {/if}
  </Toolbar>
{/if}

<DeleteEntriesDialog bind:open={showDeleteDialog} />

<style>
  h2 {
    flex: none !important;
  }

  .description {
    flex: auto;
    font-size: var(--sui-font-size-small);
    opacity: 0.8;
  }
</style>
