<script>
  import {
    Button,
    FloatingActionButtonWrapper,
    Infobar,
    Spacer,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import { _, locale as appLocale } from 'svelte-i18n';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import DeleteEntriesDialog from '$lib/components/contents/shared/delete-entries-dialog.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { getCollectionLabel, selectedCollection } from '$lib/services/contents/collection';
  import { canCreateEntry, selectedEntries } from '$lib/services/contents/collection/entries';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { isSmallScreen } from '$lib/services/user/env';

  let showDeleteDialog = $state(false);

  /**
   * Parse the given string as Markdown and sanitize the result to only allow certain tags.
   * @param {string} str Original string.
   * @returns {string} Sanitized string.
   */
  const _sanitize = (str) =>
    sanitize(/** @type {string} */ (marked.parseInline(str)), {
      ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a'],
      ALLOWED_ATTR: ['href'],
    });

  const name = $derived($selectedCollection?.name ?? '');
  const description = $derived($selectedCollection?.description);
  const createDisabled = $derived(!canCreateEntry($selectedCollection));
  const collectionLabel = $derived(
    // `$appLocale` is a key, because `getCollectionLabel` can return a localized label
    $appLocale && $selectedCollection ? getCollectionLabel($selectedCollection) : name,
  );

  const { isEntryCollection, canCreate, canDelete, limit } = $derived.by(() => {
    const collection = $selectedCollection;

    if (collection?._type === 'entry') {
      return {
        isEntryCollection: true,
        canCreate: collection.create ?? false,
        canDelete: collection.delete ?? true,
        limit: collection.limit ?? Infinity,
      };
    }

    return {
      isEntryCollection: false,
      canCreate: false,
      canDelete: false,
      limit: Infinity,
    };
  });
</script>

{#if $selectedCollection}
  <Toolbar variant="primary" aria-label={$_('collection')}>
    {#if $isSmallScreen}
      <BackButton
        aria-label={$_('back_to_collection_list')}
        onclick={() => {
          goBack('/collections');
        }}
      />
    {/if}
    <h2 role="none">{collectionLabel}</h2>
    {#if $isSmallScreen}
      <Spacer flex />
    {:else}
      <div role="none" class="description">
        <TruncatedText>
          {@html _sanitize(description || '')}
        </TruncatedText>
      </div>
    {/if}
    {#if isEntryCollection}
      {#if !$isSmallScreen}
        <Button
          variant="ghost"
          label={$_('delete')}
          aria-label={$selectedEntries.length === 1
            ? $_('delete_selected_entry')
            : $_('delete_selected_entries')}
          disabled={!$selectedEntries.length || !canDelete}
          onclick={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
      <FloatingActionButtonWrapper>
        {#if !$isSmallScreen || ($listedEntries.length && !createDisabled)}
          <CreateEntryButton
            collectionName={name}
            label={$isSmallScreen ? undefined : $_('create')}
            keyShortcuts="Accel+E"
          />
        {/if}
      </FloatingActionButtonWrapper>
    {/if}
  </Toolbar>
  {#if isEntryCollection && createDisabled}
    <Infobar
      dismissible={false}
      --sui-infobar-border-width="1px 0"
      --sui-infobar-message-justify-content="center"
    >
      {#if !canCreate}
        {$_('creating_entries_disabled_by_admin')}
      {:else}
        {$_('creating_entries_disabled_by_limit', { values: { limit } })}
      {/if}
    </Infobar>
  {/if}
{/if}

<DeleteEntriesDialog bind:open={showDeleteDialog} />

<style lang="scss">
  h2 {
    flex: none !important;
  }

  .description {
    flex: auto;
    font-size: var(--sui-font-size-small);
    opacity: 0.8;
  }
</style>
