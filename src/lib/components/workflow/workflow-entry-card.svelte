<!--
  @component
  Render a draggable card for an unpublished entry on the Editorial Workflow page. Clicking the card
  opens the entry editor; dragging it to another column changes the entry’s status.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import Image from '$lib/components/assets/shared/image.svelte';
  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import DeployStatusBadge from '$lib/components/workflow/deploy-status-badge.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { allEntries } from '$lib/services/contents';
  import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
  import {
    getCollectionFile,
    getCollectionFileLabel,
  } from '$lib/services/contents/collection/files';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { deployments } from '$lib/services/deployments';
  import { hasPublishedVersion } from '$lib/services/workflow';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { UnpublishedEntry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {UnpublishedEntry} entry Unpublished entry.
   * @property {boolean} [dragging] Whether this card is currently being dragged.
   * @property {boolean} [busy] Whether an action is in flight for this entry. The controls are
   * disabled meanwhile, so a second request can’t be sent against the same pull request.
   * @property {() => void} [onDragStart] Drag start handler.
   * @property {() => void} [onDragEnd] Drag end handler.
   * @property {() => void} [onDelete] Delete button click handler.
   * @property {() => void} [onPublish] Publish button click handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    dragging = false,
    busy = false,
    onDragStart = undefined,
    onDragEnd = undefined,
    onDelete = undefined,
    onPublish = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { collectionName, fileName, status, pullRequest } = $derived(entry.workflow);
  const deletion = $derived(status === 'pending_deletion');
  const collection = $derived(getCollection(collectionName));
  const collectionFile = $derived(
    collection && fileName ? getCollectionFile(collection, fileName) : undefined,
  );
  // The card has no locale of its own, so the link points at the entry’s default one
  const defaultLocale = $derived((collectionFile ?? collection)?._i18n?.defaultLocale);
  const deployState = $derived(
    (pullRequest.headSHA ? $deployments[pullRequest.headSHA]?.state : undefined) ?? 'unknown',
  );
  const summary = $derived.by(() => {
    // `appLocale.current` is a key, because the labels can be localized
    if (!appLocale.current || !collection) {
      return entry.slug;
    }

    return collectionFile
      ? getCollectionFileLabel(collectionFile)
      : getEntrySummary(collection, entry);
  });
  const collectionLabel = $derived(
    appLocale.current && collection ? getCollectionLabel(collection, { useSingular: true }) : '',
  );
  // The entry can only be published from the last column, and the collection’s `publish` option can
  // hide the control altogether. An Open Authoring contributor can’t merge a pull request on the
  // configured repository, so they never get the control
  const canPublish = $derived(
    !$openAuthoring && (status === 'pending_publish' || deletion) && collection?.publish !== false,
  );
  // Deleting an entry that has a published version only throws away the pending changes.
  // `$allEntries` is a dependency, because the entry can be published from another view
  const publishedVersionExists = $derived(!!$allEntries && hasPublishedVersion(entry));
  // The `delete` option only blocks taking an entry off the site. Discarding a pull request leaves
  // the published version untouched, so it stays available even when deletion is disabled
  const canDelete = $derived(
    publishedVersionExists || (collection?._type === 'entry' ? collection.delete !== false : true),
  );
  // The left action does one of three things depending on the entry, and with the labels gone the
  // icon is all that says which: it reverses a pending deletion, throws away the changes a pull
  // request was about to make, or takes an unpublished entry away for good
  const deleteIcon = $derived(deletion || publishedVersionExists ? 'undo' : 'delete');
</script>

<!-- A pending deletion has no stages to move through, so its card doesn’t drag -->
<div
  role="listitem"
  class="card"
  class:dragging
  draggable={!busy && !deletion}
  ondragstart={(/** @type {DragEvent} */ event) => {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Some browsers require data to be set for the drag to start
      event.dataTransfer.setData('text/plain', pullRequest.branch);
    }

    onDragStart?.();
  }}
  ondragend={() => {
    onDragEnd?.();
  }}
>
  <button
    type="button"
    class="summary"
    aria-label={summary}
    onclick={() => {
      // A collection file is addressed by its name, while its `subPath` is the whole file path
      goto(`/collections/${collectionName}/entries/${fileName ?? entry.subPath}`, {
        transitionType: 'forwards',
      });
    }}
  >
    {#if collection?._type === 'entry'}
      {#await getEntryThumbnail(collection, entry) then src}
        {#if src}
          <Image {src} variant="icon" cover />
        {/if}
      {/await}
    {/if}
    <span role="none" class="text">
      <span role="none" class="collection">{collectionLabel}</span>
      <span role="none" class="title">{summary}</span>
    </span>
  </button>
  <footer role="none">
    <div role="none" class="meta">
      {#if pullRequest.author?.name}
        <span role="none" class="author">{pullRequest.author.name}</span>
      {/if}
      <span role="none" class="date">
        {pullRequest.updatedDate.toLocaleDateString(appLocale.current ?? undefined, {
          month: 'short',
          day: 'numeric',
        })}
      </span>
      <DeployStatusBadge state={deployState} />
    </div>
    <div role="none" class="actions">
      {#if collection && defaultLocale}
        <PreviewLinkButton
          {entry}
          locale={defaultLocale}
          {collection}
          {collectionFile}
          {pullRequest}
          size="small"
          iconic
        />
      {/if}
      {#if canDelete}
        <Button
          variant="ghost"
          size="small"
          iconic
          disabled={busy}
          aria-label={deletion
            ? _('workflow.cancel_deletion')
            : publishedVersionExists
              ? _('workflow.discard_changes')
              : _('delete_entries', { values: { count: 1 } })}
          onclick={() => {
            onDelete?.();
          }}
        >
          {#snippet startIcon()}
            <Icon name={deleteIcon} />
          {/snippet}
        </Button>
      {/if}
      {#if canPublish}
        <Button
          variant="primary"
          size="small"
          iconic
          disabled={busy}
          aria-label={deletion
            ? _('delete_entries', { values: { count: 1 } })
            : _('workflow.publish_entry')}
          onclick={() => {
            onPublish?.();
          }}
        >
          {#snippet startIcon()}
            <Icon name={deletion ? 'delete' : 'publish'} />
          {/snippet}
        </Button>
      {/if}
    </div>
  </footer>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    padding: 8px 12px;
    background-color: var(--sui-primary-background-color);
    cursor: grab;

    &.dragging {
      opacity: 0.5;
    }
  }

  .summary {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    padding: 0;
    background: none;
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;

    /* Let the label column shrink instead of pushing the thumbnail out of the card */
    .text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
  }

  .collection {
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  .title {
    font-size: var(--sui-font-size-default);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
    }

    /* Let a long user name truncate rather than push the date out of the card */
    .author {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .date {
      flex: none;
    }

    .author + .date::before {
      margin-inline-end: 6px;
      content: '\00B7'; /* middle dot */
    }

    .actions {
      display: flex;
      flex: none;
      align-items: center;
    }
  }
</style>
