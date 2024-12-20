<script>
  import { Dialog, Table, TableCell, TableRow } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] - Whether to open the dialog.
   * @property {() => void} [onClose] - Custom `close` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const shortcuts = [
    { feature: 'view_content_library', keys: 'Alt+1' },
    { feature: 'view_asset_library', keys: 'Alt+2' },
    { feature: 'search', keys: 'Accel+F' },
    { feature: 'create_entry', keys: 'Accel+E' },
    { feature: 'save_entry', keys: 'Accel+S' },
    { feature: 'cancel_editing', keys: 'Escape' },
  ];

  let accel = $state('Ctrl');

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
  onClose={() => {
    onClose?.();
  }}
>
  <div role="none" class="wrapper">
    <Table aria-label={$_('help.keyboard_shortcuts')}>
      {#each shortcuts as { feature, keys } (keys)}
        <TableRow>
          <TableCell class="feature">{$_(`keyboard_shortcuts_.${feature}`)}</TableCell>
          <TableCell class="keys">
            {#each keys.split('+') as key}
              <kbd>{key.replace('Accel', accel)}</kbd>
            {/each}
          </TableCell>
        </TableRow>
      {/each}
    </Table>
  </div>
</Dialog>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.table-row) {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
      border-top: 1px solid var(--sui-secondary-border-color);

      &:last-child {
        border-bottom: 1px solid var(--sui-secondary-border-color);
      }

      :global(.feature) {
        flex: auto;
      }

      :global(.keys) {
        display: flex;
        gap: 8px;
      }
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
