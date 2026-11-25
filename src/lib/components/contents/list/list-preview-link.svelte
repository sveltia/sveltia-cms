<!--
  @component
  Icon button opening the deploy preview of an unpublished Editorial Workflow entry, shown before
  its status badge in the entry and file lists. The row it sits in opens the entry editor on click,
  so the click is kept from reaching the row.
-->
<script>
  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import { retainDeployPolling } from '$lib/services/deployments/poll';

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
   * @property {UnpublishedEntry} entry Unpublished entry.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File collection only.
   */

  /** @type {Props} */
  let { collection, entry, collectionFile = undefined } = $props();

  // The list has no locale of its own, so the link points at the entry’s default one
  const locale = $derived((collectionFile ?? collection)._i18n.defaultLocale);

  // Keep the deploy state up to date while the link is shown, so it turns from a spinner into a
  // link once the build finishes. The hold is counted, so every row can take one of its own; the
  // release function is returned synchronously, or the hold would leak
  $effect(() => retainDeployPolling());
</script>

<!-- The handler only stops the click from opening the entry; the button itself is the control -->
<span
  role="none"
  class="preview-link"
  onclick={(event) => {
    event.stopPropagation();
  }}
>
  <!-- Out of the Tab order like the row’s checkbox: the grid’s arrow keys move from row to row, and
  the editor offers the same link -->
  <PreviewLinkButton
    {entry}
    {locale}
    {collection}
    {collectionFile}
    pullRequest={entry.workflow.pullRequest}
    size="small"
    iconic
    tabindex={-1}
  />
</span>

<style>
  .preview-link {
    display: inline-flex;
    /* Take back the button’s own margin and padding, so the icon is as far from its neighbors as
    the other items in the row are from each other */
    margin-inline: -4px;
  }
</style>
