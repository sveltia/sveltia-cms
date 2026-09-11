<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Icon, Menu, MenuItem, SplitButton } from '@sveltia/ui';

  import { goto } from '$lib/services/app/navigation';
  import { allEntries } from '$lib/services/contents';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { canCreateIndexFile } from '$lib/services/contents/collection/entries';
  import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
  import { getMetaPathConfig, nestedFilterPath } from '$lib/services/contents/collection/nested';
  import { collectionState } from '$lib/services/contents/collection/view';
  import { encodeFilePath } from '$lib/services/utils/file';

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

  const hasOptions = $derived(
    // Use `allEntries.current` as a trigger to update the state when a new entry is created
    allEntries.current && selectedCollection.current
      ? canCreateIndexFile(selectedCollection.current)
      : false,
  );
  const indexFileLabel = $derived(
    // `appLocale.current` is a key, because `getIndexFile` can return a localized label
    appLocale.current && selectedCollection.current
      ? getIndexFile(selectedCollection.current)?.label
      : '',
  );
  const ButtonComponent = $derived(hasOptions ? SplitButton : Button);

  /**
   * Open the content editor.
   * @param {boolean} [index] Whether to create the index file instead of a regular entry.
   */
  const openEditor = (index = false) => {
    // Start a new entry in the folder the user is browsing, which the path editor picks up
    const path =
      !index &&
      selectedCollection.current &&
      getMetaPathConfig(selectedCollection.current) &&
      nestedFilterPath.current
        ? `?path=${encodeFilePath(nestedFilterPath.current)}`
        : '';

    goto(`/collections/${collectionName}/new${path}`, {
      state: { index },
      transitionType: 'forwards',
    });
  };
</script>

<ButtonComponent
  variant="primary"
  iconic={!label}
  disabled={collectionState.current.creationDisabled}
  {label}
  aria-label={_('create_new_entry')}
  {keyShortcuts}
  onclick={() => openEditor()}
>
  {#snippet startIcon()}
    <Icon name="edit" />
  {/snippet}
  {#snippet popup()}
    {#if hasOptions}
      <Menu>
        <MenuItem label={_('entry')} onclick={() => openEditor()} />
        <MenuItem label={indexFileLabel} onclick={() => openEditor(true)} />
      </Menu>
    {/if}
  {/snippet}
</ButtonComponent>
