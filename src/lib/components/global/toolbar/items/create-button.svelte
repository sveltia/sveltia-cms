<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';

  import { goto } from '$lib/services/app/navigation';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { getValidCollections } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

  const entryCollections = $derived(getValidCollections({ visible: true, type: 'entry' }));
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('create_entry_or_assets')}
>
  {#snippet endIcon()}
    <Icon name="add" />
  {/snippet}
  {#snippet popup()}
    <Menu aria-label={$_('create_entry_or_assets')}>
      {#if entryCollections.length}
        {#each entryCollections as collection (collection.name)}
          {@const {
            name,
            label,
            label_singular: labelSingular,
            create = false,
            limit = Infinity,
          } = collection}
          <MenuItem
            label={labelSingular || label || name}
            disabled={!create || getEntriesByCollection(name).length >= limit}
            onclick={() => {
              goto(`/collections/${name}/new`, { transitionType: 'forwards' });
            }}
          />
        {/each}
        <Divider />
      {/if}
      <MenuItem
        label={$_('assets')}
        onclick={async () => {
          goto('/assets', { transitionType: 'forwards' });
          await sleep(100);
          $showUploadAssetsDialog = true;
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
