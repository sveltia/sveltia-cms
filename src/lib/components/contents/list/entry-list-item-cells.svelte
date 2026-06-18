<!--
  @component
  Shared cells (checkbox, thumbnail image, title) used by both the read-only entry list row and the
  reorder list row.

  Tutory fork customization:
  - The title cell renders a colored STATUS badge (Publicado/Rascunho/Destaque) read from the entry
    content (config.yml can't do this — the summary sanitizer only allows strong/em/code).
  - Each read-only row gets quick actions (Duplicar, Excluir) plus a “⋮” menu with all per-entry
    actions (Editar, Duplicar, Ver no site, Ver no repositório, Excluir). Actions stop event
    propagation so they don't trigger the row's open-in-editor click.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import {
    Button,
    Checkbox,
    ConfirmationDialog,
    Divider,
    GridCell,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    TruncatedText,
  } from '@sveltia/ui';

  import Image from '$lib/components/assets/shared/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { backend } from '$lib/services/backends';
  import { deleteEntries } from '$lib/services/contents/collection/data/delete';
  import { selectedEntryIdSet } from '$lib/services/contents/collection/entries';
  import {
    getIndexFile,
    isCollectionIndexFile,
  } from '$lib/services/contents/collection/entries/index-file';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { duplicateDraft } from '$lib/services/contents/draft/create/duplicate';
  import { getEntryPreviewURL, getEntryRepoBlobURL } from '$lib/services/contents/entry';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { env } from '$lib/services/user/env.svelte';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { Entry, InternalEntryCollection, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Selected collection.
   * @property {Entry} entry Entry.
   * @property {ViewType} viewType View type.
   * @property {boolean} [showCheckbox] Whether to render the selection checkbox cell. Defaults to
   * `false`; the read-only list row passes `true`, while the reorder row leaves it off.
   * @property {(selected: boolean) => void} [onSelect] Selection change handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    viewType,
    showCheckbox = false,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let showDeleteDialog = $state(false);

  const defaultLocale = $derived(collection._i18n?.defaultLocale);
  const content = $derived(
    entry.locales?.[defaultLocale]?.content ?? Object.values(entry.locales ?? {})[0]?.content ?? {},
  );
  const isIndexFile = $derived(isCollectionIndexFile(collection, entry));
  // Status badge on every entry row. `draft` defaults to false (= Publicado) when absent.
  const hasStatus = $derived(!isIndexFile);
  const isDraft = $derived(content.draft === true);
  const isFeatured = $derived(content.featured === true);

  // Per-row actions are only shown on the read-only list (not the reorder list, which omits the
  // checkbox) and never on a collection index file.
  const showActions = $derived(showCheckbox && !isIndexFile);
  const canDuplicate = $derived(collection.duplicate !== false && !collection.path);
  const canDelete = $derived(collection.delete !== false);
  const previewURL = $derived(
    defaultLocale ? getEntryPreviewURL(entry, defaultLocale, collection) : undefined,
  );
  const repoURL = $derived(
    $backend?.repository?.blobBaseURL && defaultLocale
      ? getEntryRepoBlobURL(entry, defaultLocale)
      : undefined,
  );

  const editEntry = () => {
    goto(`/collections/${collection.name}/entries/${entry.subPath}`, { transitionType: 'forwards' });
  };

  const duplicateEntry = () => {
    createDraft({ collection, originalEntry: entry });
    goto(`/collections/${collection.name}/new`, {
      replaceState: true,
      notifyChange: false,
      transitionType: 'forwards',
    });
    duplicateDraft();
  };
</script>

{#if showCheckbox && !(env.isSmallScreen || env.isMediumScreen)}
  <GridCell class="checkbox">
    <Checkbox
      role="none"
      tabindex="-1"
      checked={$selectedEntryIdSet.has(entry.id)}
      onChange={({ detail: { checked } }) => {
        onSelect?.(checked);
      }}
    />
  </GridCell>
{/if}
{#if collection._thumbnailFieldNames.length}
  <GridCell class="image">
    {#await getEntryThumbnail(collection, entry) then src}
      {#if src}
        <Image {src} variant={viewType === 'list' ? 'icon' : 'tile'} cover />
      {/if}
    {/await}
  </GridCell>
{/if}
<GridCell class="title">
  <div role="none" class="title-inner">
    <div role="none" class="label">
      <div role="none" class="summary">
        <TruncatedText lines={2}>
          {#key appLocale.current}
            {@html getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true })}
          {/key}
          {#if isIndexFile}
            <Icon name={getIndexFile(collection)?.icon} class="home" />
          {/if}
        </TruncatedText>
      </div>
      {#if hasStatus || isFeatured}
        <div role="none" class="meta">
          {#if hasStatus}
            <span class="badge {isDraft ? 'draft' : 'published'}">
              {isDraft ? 'Rascunho' : 'Publicado'}
            </span>
          {/if}
          {#if isFeatured}
            <span class="badge featured">Destaque</span>
          {/if}
        </div>
      {/if}
    </div>

    {#if showActions}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        role="none"
        class="actions"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
      >
        {#if canDuplicate}
          <Button
            variant="ghost"
            class="row-action-button"
            aria-label={_('duplicate_entry')}
            onclick={duplicateEntry}
          >
            {#snippet startIcon()}
              <Icon name="content_copy" />
            {/snippet}
          </Button>
        {/if}
        {#if canDelete}
          <Button
            variant="ghost"
            class="row-action-button danger"
            aria-label={_('delete_entry')}
            onclick={() => {
              showDeleteDialog = true;
            }}
          >
            {#snippet startIcon()}
              <Icon name="delete" />
            {/snippet}
          </Button>
        {/if}
        <MenuButton
          variant="ghost"
          class="row-action-button"
          popupPosition="bottom-right"
          aria-label={_('show_edit_options')}
        >
          {#snippet startIcon()}
            <Icon name="more_vert" />
          {/snippet}
          {#snippet popup()}
            <Menu aria-label={_('edit_options')}>
              <MenuItem label={_('edit')} onclick={editEntry} />
              {#if canDuplicate}
                <MenuItem label={_('duplicate')} onclick={duplicateEntry} />
              {/if}
              {#if previewURL}
                <MenuItem
                  label={_('view_on_live_site')}
                  onclick={() => openNewTab(previewURL)}
                />
              {/if}
              {#if repoURL}
                <MenuItem
                  label={_('view_in_repository')}
                  onclick={() => openNewTab(repoURL)}
                />
              {/if}
              {#if canDelete}
                <Divider />
                <MenuItem
                  label={_('delete')}
                  onclick={() => {
                    showDeleteDialog = true;
                  }}
                />
              {/if}
            </Menu>
          {/snippet}
        </MenuButton>
      </div>
    {/if}
  </div>
</GridCell>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={_('delete_entry')}
  okLabel={_('delete')}
  onOk={async () => {
    await deleteEntries([entry]);
  }}
>
  {_('confirm_deleting_this_entry')}
</ConfirmationDialog>

<style>
  .title-inner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .label {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    :global {
      .icon.home {
        opacity: 0.5;
        font-size: 20px;
        vertical-align: -4px;
      }
    }
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.65;
    white-space: nowrap;
  }

  .badge.published {
    color: #15a34a;
    background-color: rgba(34, 197, 94, 0.13);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .badge.draft {
    color: #d08700;
    background-color: rgba(234, 179, 8, 0.15);
    border-color: rgba(234, 179, 8, 0.35);
  }

  .badge.featured {
    color: #2563eb;
    background-color: rgba(59, 130, 246, 0.13);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    /* Subtle by default, fully visible on row hover / keyboard focus. */
    opacity: 0.5;
    transition: opacity 0.15s;

    :global(.row-action-button) {
      min-width: 30px;
      height: 30px;
      padding: 0;
    }

    :global(.row-action-button .icon) {
      font-size: 18px;
    }

    :global(.row-action-button.danger:hover .icon) {
      color: #ef4444;
    }
  }

  /* GridRow gets the hover/focus state; reveal the actions when the row is active. */
  :global(.row:hover) .actions,
  :global(.row:focus-within) .actions,
  .actions:hover,
  .actions:focus-within {
    opacity: 1;
  }
</style>
