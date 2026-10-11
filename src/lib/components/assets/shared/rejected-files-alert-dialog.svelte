<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { AlertDialog } from '@sveltia/ui';

  import { formatSize } from '$lib/services/assets/file-size';
  import { getListFormatter } from '$lib/services/contents/i18n';
  import { getAcceptedImageFormatLabels } from '$lib/services/utils/media/image';

  /**
   * @import { RejectedFileNames } from '$lib/services/contents/fields/file/resources';
   */

  /**
   * @typedef {object} Props
   * @property {number} maxSize The maximum allowed file size in bytes.
   * @property {string} [accept] File types the files are checked against, which are named when a
   * file is not one of them.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    maxSize,
    accept = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let open = $state(false);
  /** @type {string[]} */
  let oversizedFileNames = $state.raw([]);
  /** @type {string[]} */
  let invalidFileNames = $state.raw([]);
  /** @type {string[]} */
  let mismatchedFileNames = $state.raw([]);

  /**
   * Show the dialog if any files were rejected. Nothing happens if every list is empty.
   * @param {RejectedFileNames} args Names of the rejected files.
   */
  export const report = (args) => {
    const { mismatchedFileNames: mismatched = [] } = args;

    if (!args.oversizedFileNames.length && !args.invalidFileNames.length && !mismatched.length) {
      return;
    }

    ({ oversizedFileNames, invalidFileNames } = args);
    mismatchedFileNames = mismatched;
    open = true;
  };

  /**
   * The dialog covers every rejection reason, so a file batch that hits only one of them keeps the
   * more specific title. A single dialog is used because two would open into the top layer at once
   * and stack, hiding one behind the other.
   */
  const title = $derived.by(() => {
    const lists = [oversizedFileNames, invalidFileNames, mismatchedFileNames];

    if (lists.filter((list) => list.length).length > 1) {
      return _('assets_dialog.rejected_files.title');
    }

    if (mismatchedFileNames.length) {
      return _('unsupported_file_type');
    }

    return invalidFileNames.length
      ? _('assets_dialog.invalid_file.title')
      : _('assets_dialog.large_file.title');
  });
  // Named formats for the mismatch message, if `accept` is one of the image type lists
  const acceptedImageFormats = $derived(getAcceptedImageFormatLabels(accept));

  /**
   * Format a list of strings for display in the current locale.
   * @param {string[]} list List of strings.
   * @returns {string} Formatted list.
   */
  const formatList = (list) =>
    getListFormatter(appLocale.current, { type: 'disjunction' }).format(list);
</script>

{#snippet fileList(/** @type {string[]} */ names)}
  <ul class="filenames">
    {#each names as name, index (`${name}-${index}`)}
      <li>{name}</li>
    {/each}
  </ul>
{/snippet}

<AlertDialog bind:open {title}>
  {#if oversizedFileNames.length}
    <div>
      {_('warning_oversized_files', {
        values: { count: oversizedFileNames.length, size: formatSize(maxSize) },
      })}
    </div>
    {@render fileList(oversizedFileNames)}
  {/if}
  {#if invalidFileNames.length}
    <div>
      {_('warning_invalid_files', { values: { count: invalidFileNames.length } })}
    </div>
    {@render fileList(invalidFileNames)}
  {/if}
  {#if mismatchedFileNames.length}
    <div>
      {#if acceptedImageFormats}
        {_('warning_unsupported_image_files', {
          values: { count: mismatchedFileNames.length, types: formatList(acceptedImageFormats) },
        })}
      {:else}
        {_('warning_unsupported_files', {
          values: {
            count: mismatchedFileNames.length,
            types: formatList(/** @type {string} */ (accept).split(/,\s*/)),
          },
        })}
      {/if}
    </div>
    {@render fileList(mismatchedFileNames)}
  {/if}
</AlertDialog>

<style>
  div:not(:first-child) {
    margin-top: 8px;
  }

  .filenames {
    border-radius: var(--sui-control-medium-border-radius);
    padding: 12px;
    background-color: var(--sui-tertiary-background-color);
    font-size: var(--sui-font-size-default);
  }

  ul {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin: 0;
    padding: 0;
  }
</style>
