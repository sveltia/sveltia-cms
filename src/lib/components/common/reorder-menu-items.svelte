<!--
  @component
  Render the menu items that move a list item to either end of the list, and to a position of
  the user’s choice. The caller hosts the Move To dialog the last item opens.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {number} index Index of the item the menu belongs to.
   * @property {number} itemCount Total number of items in the list.
   * @property {(index: number, action: string) => void} onMove Called with the destination index
   * and the `data-action` of the control to restore the focus to.
   * @property {() => void} onMoveTo Called to ask for a position.
   */

  /** @type {Props} */
  const { index, itemCount, onMove, onMoveTo } = $props();
</script>

<MenuItem
  label={_('move_to_top')}
  disabled={index === 0}
  onclick={() => onMove(0, 'move-options')}
/>
<MenuItem
  label={_('move_to_bottom')}
  disabled={index === itemCount - 1}
  onclick={() => onMove(itemCount - 1, 'move-options')}
/>
<MenuItem label={_('move_to')} onclick={onMoveTo} />
