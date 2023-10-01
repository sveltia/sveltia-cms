<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import ShortcutsDialog from '$lib/components/keyboard-shortcuts/shortcuts-dialog.svelte';
  import PrefsDialog from '$lib/components/prefs/prefs-dialog.svelte';
  import { backend, backendName } from '$lib/services/backends';
  import { openProductionSite } from '$lib/services/navigation';
  import { user } from '$lib/services/user';

  let showPrefsDialog = false;
  let showShortcutsDialog = false;

  $: isLocal = $backendName === 'local';
</script>

<MenuButton class="ghost iconic" popupPosition="bottom-right">
  <Icon
    slot="start-icon"
    name={$user?.avatar_url ? undefined : 'account_circle'}
    label={$_('account')}
  />
  <svelte:element
    this={$user?.avatar_url ? 'img' : undefined}
    class="avatar"
    loading="lazy"
    src={$user?.avatar_url}
    alt={$_('account')}
  />
  <Menu slot="popup">
    <MenuItem
      label={isLocal
        ? $_('working_with_local_repo')
        : $_('signed_in_as_x', { values: { name: $user?.login } })}
      disabled={isLocal}
      on:click={() => {
        window.open($user?.html_url, '_blank');
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
        window.open($backend.repository.url);
      }}
    />
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
      label={$_('help.release_notes')}
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
          $backend.signOut();
        });
      }}
    />
  </Menu>
</MenuButton>

<PrefsDialog bind:open={showPrefsDialog} />
<ShortcutsDialog bind:open={showShortcutsDialog} />

<style lang="scss">
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 32px;
    object-fit: cover;
  }
</style>
