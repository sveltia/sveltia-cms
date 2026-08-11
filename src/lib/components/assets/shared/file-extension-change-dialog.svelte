<!--
  @component
  A confirmation dialog shown when a file extension is about to be changed, added or removed, which
  could make the file unusable. The caller is responsible for determining whether the confirmation
  is needed; use `isEquivalentFileExtension()` to ignore harmless changes, such as `JPG` to `jpg`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether to open the dialog.
   * @property {string} [oldExtension] Original file extension without a leading dot. Can be
   * `undefined` if the original file name has no extension.
   * @property {string} [newExtension] New file extension without a leading dot. Can be `undefined`
   * if the new file name has no extension.
   * @property {string} [okLabel] Text label displayed on the OK button.
   * @property {(() => void) | undefined} [onOk] Function to be called when the change is confirmed.
   * @property {(() => void) | undefined} [onCancel] Function to be called when the change is
   * canceled.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    oldExtension = undefined,
    newExtension = undefined,
    okLabel = '',
    onOk = undefined,
    onCancel = undefined,
    ...restProps
    /* eslint-enable prefer-const */
  } = $props();

  const type = $derived.by(() => {
    if (!oldExtension) return 'add';
    if (!newExtension) return 'remove';
    return 'change';
  });
</script>

<ConfirmationDialog
  {...restProps}
  bind:open
  title={_('change_file_extension')}
  {okLabel}
  {onOk}
  {onCancel}
>
  <p>
    {_(`confirm_file_extension_change.${type}`, { values: { oldExtension, newExtension } })}
  </p>
  <p>
    {_('file_extension_change_warning')}
  </p>
</ConfirmationDialog>

<style>
  p {
    margin: 0 0 8px;
  }

  p:last-child {
    margin: 0;
  }
</style>
