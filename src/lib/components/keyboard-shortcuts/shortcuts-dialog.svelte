<script>
  import { Dialog } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  /**
   * Whether to open the dialog.
   */
  export let open = false;

  let accel = 'Ctrl';

  onMount(() => {
    if (navigator.userAgentData?.platform === 'macOS' || navigator.platform.startsWith('Mac')) {
      accel = '⌘'; // Command
    }
  });
</script>

<Dialog
  title={$_('help.keyboard_shortcuts')}
  bind:open
  showOk={false}
  showCancel={false}
  showClose={true}
  on:close
>
  <div class="row">
    <div class="feature">{$_('keyboard_shortcuts.search')}</div>
    <div class="key"><kbd>{accel}</kbd> <kbd>F</kbd></div>
  </div>
  <div class="row">
    <div class="feature">{$_('keyboard_shortcuts.create_entry')}</div>
    <div class="key"><kbd>{accel}</kbd> <kbd>E</kbd></div>
  </div>
  <div class="row">
    <div class="feature">{$_('keyboard_shortcuts.save_entry')}</div>
    <div class="key"><kbd>{accel}</kbd> <kbd>S</kbd></div>
  </div>
</Dialog>

<style lang="scss">
  .row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
    border-top: 1px solid var(--sui-secondary-border-color);

    &:last-child {
      border-bottom: 1px solid var(--sui-secondary-border-color);
    }

    .feature {
      flex: auto;
    }

    .key {
      display: flex;
      gap: 8px;
    }
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-color: var(--sui-primary-accent-color);
    border-radius: 4px;
    padding: 0 8px;
    height: 32px;
    min-width: 32px;
    background-color: var(--sui-tertiary-background-color);
    font-family: var(--sui-control-font-family);
    font-size: var(--sui-control-font-size);
    line-height: var(--sui-control-line-height);
  }
</style>
