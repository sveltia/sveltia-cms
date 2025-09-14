<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {string} [aria-label] `aria-label` property on the button.
   * @property {boolean} [useShortcut] Whether to enable Escape keyboard shortcut. Default: `false`.
   * @property {(event: MouseEvent) => void} [onclick] `click` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    'aria-label': ariaLabel,
    useShortcut = false,
    onclick = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Button
  variant="ghost"
  iconic
  aria-label={ariaLabel ?? $_('back')}
  keyShortcuts={useShortcut ? 'Escape' : undefined}
  class="back"
  {onclick}
>
  {#snippet startIcon()}
    <Icon name={document.documentElement.dir === 'rtl' ? 'arrow_forward' : 'arrow_back'} />
  {/snippet}
</Button>
