<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { AlertDialog } from '@sveltia/ui';

  import { getListFormatter } from '$lib/services/contents/i18n';
  import { formatSize } from '$lib/services/utils/file';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the size limit dialog is open.
   * @property {string[]} oversizedFileNames The names of the files that exceed the size limit.
   * @property {number} maxSize The maximum allowed file size in bytes.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    oversizedFileNames,
    maxSize,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<AlertDialog bind:open title={_('assets_dialog.large_file.title')}>
  <div>
    {_('warning_oversized_files', {
      values: { count: oversizedFileNames.length, size: formatSize(maxSize) },
    })}
  </div>
  <div>
    {getListFormatter(appLocale.current).format(oversizedFileNames)}
  </div>
</AlertDialog>
