<!--
  @component
  Status cell of an entry or collection file row in the entry and file lists: who else is editing
  or viewing it, with Sveltia CMS Additions, and the Editorial Workflow status of an unpublished
  one, with a button opening its deploy preview. The list holds the deploy state lookup that keeps
  the button up to date, so every row doesn’t need a hold of its own.
-->
<script>
  import { GridCell } from '@sveltia/ui';

  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import StatusBadge from '$lib/components/workflow/status-badge.svelte';
  import { getAdditions } from '$lib/services/app/additions';
  import { getEntryStage } from '$lib/services/workflow/stages';

  /**
   * @import {
   * InternalCollection,
   * InternalCollectionFile,
   * UnpublishedEntry,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalCollection} collection Collection that the entry belongs to.
   * @property {string} subPath Entry path without an extension, or the file name of a collection
   * file, which tells whose activity to show.
   * @property {UnpublishedEntry} [unpublishedEntry] The entry, if it’s an unpublished Editorial
   * Workflow entry, whose status is shown.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File collection only.
   * @property {boolean} [showPreviewLink] Whether to render a button opening the deploy preview of
   * an unpublished entry before its status. Defaults to `false`; the reorder row, which is dragged
   * around, leaves it off.
   */

  /** @type {Props} */
  let {
    collection,
    subPath,
    unpublishedEntry = undefined,
    collectionFile = undefined,
    showPreviewLink = false,
  } = $props();

  // Sveltia CMS Additions, which tells who else is editing or viewing the entry
  const additions = $derived(getAdditions());
</script>

<GridCell class="status">
  <div role="none" class="status-items">
    {#if additions}
      <additions.EntryActivity collectionName={collection.name} {subPath} />
    {/if}
    {#if unpublishedEntry}
      {#if showPreviewLink}
        <!-- The row opens the entry editor on click, so the click is kept from reaching it. The
        button is out of the Tab order like the row’s checkbox: the grid’s arrow keys move from row
        to row, and the editor offers the same link -->
        <span
          role="none"
          class="preview-link"
          onclick={(event) => {
            event.stopPropagation();
          }}
        >
          <PreviewLinkButton
            entry={unpublishedEntry}
            {collection}
            {collectionFile}
            pullRequest={unpublishedEntry.workflow.pullRequest}
            size="small"
            iconic
            tabindex={-1}
          />
        </span>
      {/if}
      <StatusBadge status={getEntryStage(unpublishedEntry, collection)} />
    {/if}
  </div>
</GridCell>

<style>
  /*
   * Lay out the items in one row with even spacing, rather than the spaces between them, whose
   * width depends on the font. It stays inline, so the cell’s `text-align` still places it
   */

  .status-items {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    vertical-align: middle;
  }

  .preview-link {
    display: inline-flex;
    /* Take back the button’s own margin and padding, so the icon is as far from its neighbors as
    the other items in the row are from each other */
    margin-inline: -4px;
  }
</style>
