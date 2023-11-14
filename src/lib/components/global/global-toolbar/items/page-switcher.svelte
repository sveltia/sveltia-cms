<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedAssetFolderPath } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { goto, selectedPageName } from '$lib/services/navigation';

  $: pages = [
    {
      key: 'collections',
      label: $_('entries'),
      icon: 'library_books',
      link: `/collections/${$selectedCollection.name}`,
    },
    {
      key: 'assets',
      label: $_('assets'),
      icon: 'photo_library',
      link: $selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets',
    },
    // {
    //   key: 'workflow',
    //   label: $_('editorial_workflow'),
    //   icon: 'rebase_edit',
    //   link: '/workflow',
    // },
    // {
    //   key: 'config',
    //   label: $_('site_config'),
    //   icon: 'settings',
    //   link: '/config',
    // },
  ];
</script>

<div class="wrapper">
  <SelectButtonGroup aria-label={$_('page_switcher')}>
    {#each pages as { key, label, icon, link } (key)}
      <SelectButton
        variant="ghost"
        iconic
        selected={$selectedPageName === key}
        aria-label={label}
        on:select={() => {
          goto(link);
        }}
      >
        <Icon slot="start-icon" name={icon} />
      </SelectButton>
    {/each}
  </SelectButtonGroup>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.sui.select-button-group) {
      gap: 4px;
    }

    :global(.sui.button) {
      border-radius: var(--sui-button-medium-border-radius) !important;
    }
  }
</style>
