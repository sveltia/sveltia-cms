<script>
  import { _, isRTL } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {string} [aria-label] `aria-label` property on the button.
   * @property {boolean} [useShortcut] Whether to enable Escape keyboard shortcut. Default: `false`.
   * @property {(event: MouseEvent) => void} [onclick] `click` event handler.
   */

  /** @type {Props} */
  let { 'aria-label': ariaLabel, useShortcut = false, onclick = undefined } = $props();
</script>

<Button
  variant="ghost"
  iconic
  aria-label={ariaLabel ?? _('back')}
  keyShortcuts={useShortcut ? 'Escape' : undefined}
  class="back"
  {onclick}
>
  {#snippet startIcon()}
    <Icon name={isRTL() ? 'arrow_forward' : 'arrow_back'} />
  {/snippet}
</Button>
