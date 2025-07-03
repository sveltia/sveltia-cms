<script>
  import { Button, Icon, Menu, MenuItem, SplitButton } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { allEntries } from '$lib/services/contents';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { canCreateEntry } from '$lib/services/contents/collection/entries';
  import { canCreateIndexFile, getIndexFile } from '$lib/services/contents/collection/index-file';

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
  const hasOptions = $derived(
    // Use `$allEntries` as a trigger to update the state when a new entry is created
    $allEntries && $selectedCollection ? canCreateIndexFile($selectedCollection) : false,
  );
  const indexFileLabel = $derived(
    // `$appLocale` is a key, because `getIndexFile` can return a localized label
    $appLocale && $selectedCollection ? getIndexFile($selectedCollection)?.label : '',
  );
  const ButtonComponent = $derived(hasOptions ? SplitButton : Button);

  /**
   * Open the content editor.
   * @param {boolean} [index] Whether to create the index file instead of a regular entry.
   */
  const openEditor = (index = false) => {
    goto(`/collections/${collectionName}/new`, { state: { index }, transitionType: 'forwards' });
  };
</script>

<ButtonComponent
  variant="primary"
  iconic={!label}
  {disabled}
  {label}
  aria-label={$_('create_new_entry')}
  {keyShortcuts}
  onclick={() => openEditor()}
>
  {#snippet startIcon()}
    <Icon name="edit" />
  {/snippet}
  {#snippet popup()}
    {#if hasOptions}
      <Menu>
        <MenuItem label={$_('entry')} onclick={() => openEditor()} />
        <MenuItem label={indexFileLabel} onclick={() => openEditor(true)} />
      </Menu>
    {/if}
  {/snippet}
</ButtonComponent>
