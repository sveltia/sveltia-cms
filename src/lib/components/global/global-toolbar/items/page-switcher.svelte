<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedAssetFolder } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { goto, selectedPageName } from '$lib/services/navigation';

  $: pages = [
    {
      key: 'collections',
      label: $_('contents'),
      icon: 'library_books',
      link: `/collections/${$selectedCollection.name}`,
    },
    {
      key: 'assets',
      label: $_('assets'),
      icon: 'photo_library',
      link: $selectedAssetFolder ? `/assets/${$selectedAssetFolder.internalPath}` : '/assets',
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

<div role="none" class="wrapper">
  <SelectButtonGroup aria-label={$_('switch_page')} aria-controls="page-container">
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
