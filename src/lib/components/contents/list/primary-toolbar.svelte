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
  import { sanitize } from 'isomorphic-dompurify';
  import { marked } from 'marked';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import DeleteEntriesDialog from '$lib/components/contents/shared/delete-entries-dialog.svelte';
  import CreateEntryButton from '$lib/components/contents/toolbar/create-entry-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { getCollectionLabel, selectedCollection } from '$lib/services/contents/collection';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { collectionState, listedEntries } from '$lib/services/contents/collection/view';
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
  const collectionLabel = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && $selectedCollection ? getCollectionLabel($selectedCollection) : name,
  );
  const {
    isEntryCollection,
    canCreate,
    canDelete,
    quota,
    remaining,
    nearingQuota,
    creationDisabled,
  } = $derived($collectionState);
</script>

{#if $selectedCollection}
  <Toolbar variant="primary" aria-label={_('collection')}>
    {#if $isSmallScreen}
      <BackButton
        aria-label={_('back_to_collection_list')}
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
          label={_('delete')}
          aria-label={_('delete_selected_entries', { values: { count: $selectedEntries.length } })}
          disabled={!$selectedEntries.length || !canDelete}
          onclick={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
      <FloatingActionButtonWrapper>
        {#if !$isSmallScreen || ($listedEntries.length && !creationDisabled)}
          <CreateEntryButton
            collectionName={name}
            label={$isSmallScreen ? undefined : _('create')}
            keyShortcuts="Accel+E"
          />
        {/if}
      </FloatingActionButtonWrapper>
    {/if}
  </Toolbar>
  {#if isEntryCollection && (creationDisabled || nearingQuota)}
    <Infobar
      dismissible={false}
      --sui-infobar-border-width="1px 0"
      --sui-infobar-message-justify-content="center"
    >
      {#if !canCreate}
        {_('creating_entries_disabled_by_admin')}
      {:else if creationDisabled}
        {_('creating_entries_disabled_by_quota', { values: { quota } })}
      {:else if nearingQuota}
        {_('creating_entries_nearing_quota', { values: { quota, remaining } })}
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
