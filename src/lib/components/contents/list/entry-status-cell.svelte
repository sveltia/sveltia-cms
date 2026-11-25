<!--
  @component
  Status cell of an entry or collection file row in the entry and file lists: who else is editing
  or viewing it, with Sveltia CMS Additions, the status of an unpublished Editorial Workflow entry,
  and a button opening the entry on its deploy preview or the live site, which comes last so the
  buttons line up from row to row. The list holds the deploy state lookup that keeps the button up
  to date, so every row doesn’t need a hold of its own.
-->
<script>
  import { GridCell } from '@sveltia/ui';

  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import StatusBadge from '$lib/components/workflow/status-badge.svelte';
  import { getAdditions } from '$lib/services/app/additions';
  import { isUnpublishedEntry } from '$lib/services/workflow/predicates';
  import { getEntryStage } from '$lib/services/workflow/stages';

  /**
   * @import {
   * Entry,
   * InternalCollection,
   * InternalCollectionFile,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalCollection} collection Collection that the entry belongs to.
   * @property {string} subPath Entry path without an extension, or the file name of a collection
   * file, which tells whose activity to show.
   * @property {Entry} [entry] Entry, published or unpublished. Missing for a collection file that
   * hasn’t been created yet, which has nothing to link to.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File collection only.
   * @property {boolean} [showPreviewLink] Whether to render a button opening the entry on the live
   * site or its deploy preview, as the entry editor does. It’s only rendered when the entry has
   * such a page, e.g. with the `preview_path` option. Defaults to `false`; the reorder row, which
   * is dragged around, leaves it off.
   */

  /** @type {Props} */
  let {
    collection,
    subPath,
    entry = undefined,
    collectionFile = undefined,
    showPreviewLink = false,
  } = $props();

  // The entry, if it’s an unpublished one
  const unpublishedEntry = $derived(isUnpublishedEntry(entry) ? entry : undefined);

  // Sveltia CMS Additions, which tells who else is editing or viewing the entry
  const additions = $derived(getAdditions());
</script>

<GridCell class="status">
  <div role="none" class="status-items">
    {#if additions}
      <additions.EntryActivity collectionName={collection.name} {subPath} />
    {/if}
    {#if unpublishedEntry}
      <StatusBadge status={getEntryStage(unpublishedEntry, collection)} />
    {/if}
    {#if showPreviewLink && entry}
      <!-- The row opens the entry editor on click, so the click is kept from reaching it. The
      button is out of the Tab order like the row’s checkbox: the grid’s arrow keys move from row to
      row, and the editor offers the same link. Only an unpublished entry’s link follows the deploy
      state: those are few, while every published row would otherwise be updated by each answer of
      the deploy state lookup and send the site a request of its own -->
      <span
        role="none"
        class="preview-link"
        onclick={(event) => {
          event.stopPropagation();
        }}
      >
        <PreviewLinkButton
          {entry}
          {collection}
          {collectionFile}
          pullRequest={unpublishedEntry?.workflow.pullRequest}
          size="small"
          iconic
          showTooltip
          tabindex={-1}
          trackDeployState={!!unpublishedEntry}
        />
      </span>
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

  /* The wrapper only catches the click, and takes no space of its own, which would add a gap to
  the row where there’s no button, e.g. without the `preview_path` option */

  .preview-link {
    display: contents;

    /* Take back the button’s padding, so the icon is as far from its neighbors as the other items
    in the row are from each other */

    :global(button) {
      margin-inline: -2px;
    }

    /* Leading the row, as on a published entry’s tile, the icon lines up with the title above */
    &:first-child :global(button) {
      margin-inline-start: -6px;
    }
  }
</style>
