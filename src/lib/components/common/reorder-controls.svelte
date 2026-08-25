<!--
  @component
  Render the control(s) used to reorder an item within a vertical list.

  With a fine pointer this is a drag handle: the item can be dragged with the mouse, or moved with
  the Arrow Up/Down and Home/End keys while the handle has focus. Only the handle starts a drag, so
  the rest of the item stays selectable and its own controls keep working. The item element itself
  has to be the drag source, though — that’s what gives the drag its preview image — so the handle
  asks the list to make the item `draggable` while it’s pressed, and to make it plain again once the
  press or the drag is over.

  A touch screen gets Move Up/Down buttons instead, because HTML drag and drop is mouse-only: a
  touch gesture never fires `dragstart`, so a handle would do nothing at all there.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, Spacer } from '@sveltia/ui';

  import { env } from '$lib/services/user/env.svelte';
  import { getKeyboardMoveTarget } from '$lib/services/utils/drag-sorting';

  /**
   * @typedef {object} Props
   * @property {number} index Index of the item the controls belong to.
   * @property {number} itemCount Total number of items in the list.
   * @property {boolean} [disabled] Whether to disable reordering.
   * @property {'small' | 'medium'} [size] Button size.
   * @property {string} [icon] Name of the icon to use for the drag handle.
   * @property {() => void} [onGrab] Called when the drag handle is pressed, so the list can make
   * the item draggable. Never called on a touch screen.
   * @property {() => void} [onRelease] Called when the press ends without starting a drag.
   * @property {(index: number, action: string) => void} [onMove] Called with the destination index
   * and the `data-action` of the activated control, so the list can restore the focus to the
   * matching control once the item has moved.
   */

  /** @type {Props} */
  const {
    index,
    itemCount,
    disabled = false,
    size = 'small',
    icon = 'drag_indicator',
    onGrab = undefined,
    onRelease = undefined,
    onMove = undefined,
  } = $props();

  /**
   * Release the grabbed item. The press can end anywhere — the pointer may be lifted outside the
   * handle, or the gesture may be cancelled by a scroll — so the release is caught on the window
   * rather than on the button. Calling this once a drag is already under way is harmless: the
   * browser has taken over by then, and `draggable` only matters at the start of the gesture.
   */
  const release = () => {
    globalThis.removeEventListener('pointerup', release);
    globalThis.removeEventListener('pointercancel', release);
    onRelease?.();
  };
</script>

{#if env.hasMouse}
  <Button
    {size}
    {disabled}
    iconic
    class="drag-handle"
    data-action="reorder"
    aria-label={_('reorder_item')}
    aria-keyshortcuts="ArrowUp ArrowDown Home End"
    onpointerdown={() => {
      onGrab?.();
      globalThis.addEventListener('pointerup', release);
      globalThis.addEventListener('pointercancel', release);
    }}
    onkeydown={(/** @type {KeyboardEvent} */ event) => {
      const target = getKeyboardMoveTarget({ key: event.key, index, itemCount });

      if (target === undefined) {
        return;
      }

      // Keep the arrow and Home/End keys from scrolling the editor pane
      event.preventDefault();
      onMove?.(target, 'reorder');
    }}
  >
    {#snippet startIcon()}
      <Icon name={icon} />
    {/snippet}
  </Button>
{:else}
  <Button
    {size}
    iconic
    disabled={disabled || index === 0}
    data-action="move-up"
    aria-label={_('move_up')}
    onclick={() => onMove?.(index - 1, 'move-up')}
  >
    {#snippet startIcon()}
      <Icon name="arrow_upward" />
    {/snippet}
  </Button>
  <Spacer />
  <Button
    {size}
    iconic
    disabled={disabled || index === itemCount - 1}
    data-action="move-down"
    aria-label={_('move_down')}
    onclick={() => onMove?.(index + 1, 'move-down')}
  >
    {#snippet startIcon()}
      <Icon name="arrow_downward" />
    {/snippet}
  </Button>
{/if}

<style>
  :global(button.drag-handle:not(:disabled)) {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
</style>
