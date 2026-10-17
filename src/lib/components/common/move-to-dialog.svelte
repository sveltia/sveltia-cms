<!--
  @component
  Prompt dialog asking for the position an item of a list should be moved to.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { NumberInput, PromptDialog } from '@sveltia/ui';

  import { parseMovePosition } from '$lib/services/utils/drag-sorting';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   * @property {number} index Index of the item to move.
   * @property {number} itemCount Total number of items in the list.
   * @property {(index: number) => void} onMove Called with the destination index once a valid
   * position is confirmed.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    index,
    itemCount,
    onMove,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {number | undefined} */
  let position = $state();
  const target = $derived(parseMovePosition({ position, itemCount }));

  // Every item of a list has one of these, so the dialog isn’t built until the first time it opens
  let everOpened = $state(false);

  // Start over with the current position each time the dialog opens
  $effect(() => {
    if (open) {
      everOpened = true;
      position = index + 1;
    }
  });
</script>

{#if everOpened}
  <PromptDialog
    bind:open
    size="x-small"
    title={_('move_to')}
    okDisabled={target === undefined}
    onOk={() => {
      if (target !== undefined) {
        onMove(target);
      }
    }}
  >
    {_('move_to_description', { values: { count: itemCount } })}
    {#snippet input()}
      <NumberInput
        bind:value={position}
        flex
        autofocus
        min={1}
        max={itemCount}
        required
        ariaLabel={_('move_to_position')}
        onkeydown={(/** @type {KeyboardEvent} */ event) => {
          // Submit with the Enter key, unless it’s confirming an IME conversion
          if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();

            if (target !== undefined) {
              onMove(target);
              open = false;
            }
          }
        }}
      />
    {/snippet}
  </PromptDialog>
{/if}
