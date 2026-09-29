<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import { goto } from '$lib/services/app/navigation';
  import { assetsLocked } from '$lib/services/assets/folders';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { isReadonly } from '$lib/services/config/readonly';
  import { getValidCollections } from '$lib/services/contents/collection';
  import {
    countCollectionEntries,
    getEntriesByCollection,
  } from '$lib/services/contents/collection/entries';

  /**
   * @import { EntryCollection } from '$lib/types/public';
   */

  const entryCollections = $derived(
    /** @type {EntryCollection[]} */ (getValidCollections({ visible: true, type: 'entry' })),
  );
  // An entry can’t be created where the collection says so, is read-only or has reached its limit
  const collectionItems = $derived(
    entryCollections.map((collection) => {
      const {
        name,
        label,
        label_singular: labelSingular,
        create = true,
        limit = Infinity,
      } = collection;

      return {
        name,
        label: labelSingular || label || name,
        disabled:
          !create ||
          isReadonly({ collection }) ||
          (limit < Infinity && countCollectionEntries(name, getEntriesByCollection(name)) >= limit),
      };
    }),
  );
  // The assets are uploaded to the global media folder, which is read-only along with the whole
  // CMS. Uploading commits straight to the configured branch, so an Open Authoring contributor or a
  // user who can’t push to the branch can’t do it either
  const assetsDisabled = $derived(assetsLocked.current || isReadonly());
  // A menu with nothing to choose from isn’t worth opening, e.g. while the whole CMS is read-only
  const allDisabled = $derived(assetsDisabled && collectionItems.every(({ disabled }) => disabled));
</script>

<MenuButton
  variant="ghost"
  iconic
  disabled={allDisabled}
  popupPosition="bottom-right"
  aria-label={_('create_entry_or_assets')}
>
  {#snippet endIcon()}
    <Icon name="add" />
  {/snippet}
  {#snippet popup()}
    <Menu ariaLabel={_('create_entry_or_assets')}>
      {#if collectionItems.length}
        {#each collectionItems as { name, label, disabled } (name)}
          <MenuItem
            {label}
            {disabled}
            onclick={() => {
              goto(`/collections/${name}/new`, { transitionType: 'forwards' });
            }}
          />
        {/each}
        <Divider />
      {/if}
      <MenuItem
        label={_('assets')}
        disabled={assetsDisabled}
        onclick={async () => {
          goto('/assets', { transitionType: 'forwards' });
          await sleep(100);
          showUploadAssetsDialog.current = true;
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
