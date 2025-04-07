<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { canCreateEntry } from '$lib/services/contents/collection/entries';

  /**
   * @typedef {object} Props
   * @property {string} collectionName Collection name.
   * @property {string} [label] Button label. If `undefined`, the button will be iconic.
   * @property {string} [keyShortcuts] Keyboard shortcuts.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collectionName,
    label = undefined,
    keyShortcuts = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const disabled = $derived(!canCreateEntry($selectedCollection));
</script>

<Button
  variant="primary"
  iconic={!label}
  {disabled}
  {label}
  aria-label={$_('create_new_entry')}
  {keyShortcuts}
  onclick={() => {
    goto(`/collections/${collectionName}/new`);
  }}
>
  {#snippet startIcon()}
    <Icon name="edit" />
  {/snippet}
</Button>
