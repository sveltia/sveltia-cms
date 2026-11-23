<!--
  @component
  An iconic button to remove an item, such as a list item, a key-value pair or a file.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {'ghost'} [variant] Style variant.
   * @property {'small' | 'medium'} [size] Button size.
   * @property {boolean} [disabled] Whether the button is disabled.
   * @property {boolean} [hidden] Whether the button is hidden.
   * @property {(event: MouseEvent) => void} [onclick] Click event handler.
   */

  /** @type {Props} */
  const {
    variant = undefined,
    size = 'small',
    disabled = false,
    hidden = false,
    onclick = undefined,
  } = $props();
</script>

<Button {variant} {size} iconic {disabled} {hidden} aria-label={_('remove')} {onclick}>
  {#snippet startIcon()}
    <Icon name="close" />
  {/snippet}
</Button>
