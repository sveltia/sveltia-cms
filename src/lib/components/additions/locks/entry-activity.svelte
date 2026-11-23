<!--
  @component
  What others are doing with an entry, shown in the entry list: someone editing it, and anyone
  else who has it open.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Icon } from '@sveltia/ui';

  import { getLockKey, getOtherReaders, getOthersLock } from '$lib/services/additions/locks.svelte';
  import { formatNames } from '$lib/services/additions/people';

  /**
   * @typedef {object} Props
   * @property {string} collectionName Collection name.
   * @property {string} subPath Entry path without an extension, or the file name of a collection
   * file.
   */

  /** @type {Props} */
  let { collectionName, subPath } = $props();

  const key = $derived(getLockKey(collectionName, subPath));
  const lock = $derived(getOthersLock(key));
  const readers = $derived(getOtherReaders(key));
</script>

{#if lock}
  {@const label = _('additions.locks.being_edited_by_x', { values: { name: lock.name } })}
  <span role="img" class="lock" aria-label={label} title={label}>
    <Icon name="edit_note" />
  </span>
{/if}
{#if readers.length}
  {@const label = _('additions.locks.open_by_x', { values: { names: formatNames(readers) } })}
  <span role="img" class="readers" aria-label={label} title={label}>
    <Icon name="visibility" />
    <span class="count" aria-hidden="true">{readers.length}</span>
  </span>
{/if}

<style>
  .lock,
  .readers {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    color: var(--sui-info-foreground-color);
  }

  .readers {
    gap: 2px;
    color: var(--sui-secondary-foreground-color);
  }

  .count {
    font-size: var(--sui-font-size-small);
  }
</style>
