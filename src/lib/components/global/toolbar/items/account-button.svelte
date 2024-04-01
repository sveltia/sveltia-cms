<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PublishMenuItem from '$lib/components/global/toolbar/items/publish-menu-item.svelte';
  import ShortcutsDialog from '$lib/components/keyboard-shortcuts/shortcuts-dialog.svelte';
  import PrefsDialog from '$lib/components/prefs/prefs-dialog.svelte';
  import { backend, backendName } from '$lib/services/backends';
  import { openProductionSite } from '$lib/services/navigation';
  import { prefs } from '$lib/services/prefs';
  import { user } from '$lib/services/user';
  import { version } from '../../../../../../package.json';

  /** @type {MenuButton} */
  let menuButton;
  let showPrefsDialog = false;
  let showShortcutsDialog = false;

  $: hasAvatar = !!$user?.avatarURL;
  $: isLocal = $backendName === 'local';
</script>

<div role="none" class="wrapper">
  <MenuButton
    variant="ghost"
    iconic
    class={hasAvatar ? 'avatar' : ''}
    popupPosition="bottom-right"
    aria-label={$_('show_account_menu')}
    bind:this={menuButton}
  >
    <svelte:component
      this={hasAvatar ? undefined : Icon}
      slot="start-icon"
      name={'account_circle'}
    />
    <svelte:element
      this={hasAvatar ? 'img' : undefined}
      class="avatar"
      loading="lazy"
      src={$user?.avatarURL}
    />
    <Menu slot="popup" aria-label={$_('account')}>
      <MenuItem
        label={isLocal
          ? $_('working_with_local_repo')
          : $_('signed_in_as_x', { values: { name: $user?.login } })}
        disabled={isLocal}
        on:click={() => {
          window.open($user?.profileURL, '_blank');
        }}
      />
      <Divider />
      <MenuItem
        label={$_('live_site')}
        on:click={() => {
          openProductionSite();
        }}
      />
      <MenuItem
        label={$_('git_repository')}
        disabled={isLocal}
        on:click={() => {
          window.open($backend?.repository?.branchURL);
        }}
      />
      <PublishMenuItem />
      <Divider />
      <MenuItem
        label={$_('settings')}
        on:click={() => {
          showPrefsDialog = true;
        }}
      />
      <Divider />
      <MenuItem
        label={$_('help.keyboard_shortcuts')}
        on:click={() => {
          showShortcutsDialog = true;
        }}
      />
      <MenuItem
        label={$_('help.documentation')}
        on:click={() => {
          window.open('https://github.com/sveltia/sveltia-cms/blob/main/README.md', '_blank');
        }}
      />
      <MenuItem
        label={$prefs.devModeEnabled
          ? $_('help.release_notes_version_x', { values: { version } })
          : $_('help.release_notes')}
        on:click={() => {
          window.open('https://github.com/sveltia/sveltia-cms/releases', '_blank');
        }}
      />
      <Divider />
      <MenuItem
        label={$_('help.issue')}
        on:click={() => {
          window.open('https://github.com/sveltia/sveltia-cms/issues', '_blank');
        }}
      />
      <MenuItem
        label={$_('help.feedback')}
        on:click={() => {
          window.open('https://github.com/sveltia/sveltia-cms/discussions', '_blank');
        }}
      />
      <Divider />
      <MenuItem
        label={$_('sign_out')}
        on:click={async () => {
          // Wait a bit before the menu is closed
          window.requestAnimationFrame(() => {
            $user = null;
            $backend?.signOut();
          });
        }}
      />
    </Menu>
  </MenuButton>
</div>

<PrefsDialog bind:open={showPrefsDialog} on:close={() => menuButton.focus()} />
<ShortcutsDialog bind:open={showShortcutsDialog} on:close={() => menuButton.focus()} />

<style lang="scss">
  .wrapper {
    display: contents;

    :global(button.avatar) {
      border-width: 0;
      background-color: transparent;
    }
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 32px;
    object-fit: cover;
  }
</style>
