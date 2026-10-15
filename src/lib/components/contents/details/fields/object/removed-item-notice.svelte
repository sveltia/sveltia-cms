<!--
  @component
  Notice shown in place of a removed List field item or Object field, with a button to restore it.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Spacer } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {string} id `id` attribute of the Restore button, so it can be focused.
   * @property {boolean} [disabled] Whether to disable the Restore button.
   * @property {() => void} onRestore Function called when the Restore button is clicked.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    disabled = false,
    onRestore,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Alert status="info">
  <span role="none">{_('item_removed')}</span>
  <Spacer flex />
  <Button
    {id}
    variant="secondary"
    size="small"
    label={_('restore')}
    {disabled}
    onclick={onRestore}
  />
</Alert>
