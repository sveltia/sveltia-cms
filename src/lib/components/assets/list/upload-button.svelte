<!--
  @component Upload button, shared by repository folders and external locations.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {string} [label] Button label. If `undefined`, the button will be iconic.
   * @property {boolean} [disabled] Whether uploads are disabled.
   * @property {() => void} onclick Click handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label = undefined,
    disabled = false,
    onclick,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Button
  variant="primary"
  iconic={!label}
  {disabled}
  {label}
  aria-label={_('upload_assets')}
  {onclick}
>
  {#snippet startIcon()}
    <Icon name="cloud_upload" />
  {/snippet}
</Button>
