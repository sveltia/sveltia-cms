<!--
  @component
  Copy menu of the asset toolbar, shared by repository assets and assets on external locations. The
  caller defines the items and how each one copies its data to clipboard.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Menu, MenuButton, MenuItem, Toast } from '@sveltia/ui';

  /**
   * @typedef {object} CopyMenuItem
   * @property {string} label Item label.
   * @property {boolean} [disabled] Whether the item is disabled.
   * @property {() => Promise<void>} copy Function that copies the data to clipboard.
   * @property {string} toastKey Key of the success message, which takes `count`.
   */

  /**
   * @typedef {object} Props
   * @property {CopyMenuItem[]} items Menu items.
   * @property {number} count Number of selected assets, used in the messages.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    items,
    count,
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {{ show: boolean, text: string, status: 'success' | 'error' }} */
  const toast = $state({ show: false, text: '', status: 'success' });

  /**
   * Execute a copy action.
   * @param {CopyMenuItem} item Menu item.
   */
  const doCopyAction = async ({ copy, toastKey }) => {
    try {
      await copy();
      toast.status = 'success';
      toast.text = _(toastKey, { values: { count } });
    } catch (ex) {
      toast.status = 'error';
      toast.text = _('clipboard_error');
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      toast.show = true;
    }
  };
</script>

{#snippet menuItems()}
  {#each items as item (item.label)}
    <MenuItem
      label={item.label}
      disabled={item.disabled}
      onclick={() => {
        doCopyAction(item);
      }}
    />
  {/each}
{/snippet}

{#if useButton}
  <MenuButton variant="ghost" disabled={!count} label={_('copy')} popupPosition="bottom-right">
    {#snippet popup()}
      <Menu aria-label={_('copy_options')}>
        {@render menuItems()}
      </Menu>
    {/snippet}
  </MenuButton>
{:else}
  <MenuItem disabled={!count} label={_('copy')} popupPosition="left-top">
    {#snippet items()}
      {@render menuItems()}
    {/snippet}
  </MenuItem>
{/if}

<Toast bind:show={toast.show}>
  <Alert status={toast.status}>{toast.text}</Alert>
</Toast>
