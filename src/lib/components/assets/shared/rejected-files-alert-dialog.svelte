<script>
  import { _ } from '@sveltia/i18n';
  import { AlertDialog } from '@sveltia/ui';

  import { formatSize } from '$lib/services/assets/file-size';

  /**
   * @import { RejectedFileNames } from '$lib/services/contents/fields/file/resources';
   */

  /**
   * @typedef {object} Props
   * @property {number} maxSize The maximum allowed file size in bytes.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    maxSize,
    /* eslint-enable prefer-const */
  } = $props();

  let open = $state(false);
  /** @type {string[]} */
  let oversizedFileNames = $state.raw([]);
  /** @type {string[]} */
  let invalidFileNames = $state.raw([]);

  /**
   * Show the dialog if any files were rejected. Nothing happens if both lists are empty.
   * @param {RejectedFileNames} args Names of the rejected files.
   */
  export const report = (args) => {
    if (!args.oversizedFileNames.length && !args.invalidFileNames.length) {
      return;
    }

    ({ oversizedFileNames, invalidFileNames } = args);
    open = true;
  };

  /**
   * The dialog covers both rejection reasons, so a file batch that hits only one of them keeps the
   * more specific title. A single dialog is used because two would open into the top layer at once
   * and stack, hiding one behind the other.
   */
  const title = $derived(
    oversizedFileNames.length && invalidFileNames.length
      ? _('assets_dialog.rejected_files.title')
      : invalidFileNames.length
        ? _('assets_dialog.invalid_file.title')
        : _('assets_dialog.large_file.title'),
  );
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
