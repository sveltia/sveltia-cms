<script>
  import { Icon, Menu, MenuButton, MenuItem, Separator } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PrefsDialog from '$lib/components/prefs/prefs-dialog.svelte';
  import { user } from '$lib/services/auth';
  import { backend } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { openProductionSite } from '$lib/services/navigation';
  import LocalStorage from '$lib/services/utils/local-storage';

  let showPrefsDialog = false;
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
      label={$user?.backendName === 'local'
        ? $_('working_with_local_repo')
        : $_('signed_in_as_x', { values: { name: $user?.login } })}
      disabled={$user?.backendName === 'local'}
      on:click={() => {
        window.open($user?.html_url, '_blank');
      }}
    />
    <Separator />
    <MenuItem
      label={$_('live_site')}
      on:click={() => {
        openProductionSite();
      }}
    />
    <MenuItem
      label={$_('git_repository')}
      disabled={$user?.backendName === 'local'}
      on:click={() => {
        window.open($backend.url.replace('{repo}', $siteConfig.backend.repo));
      }}
    />
    <Separator />
    <MenuItem
      label={$_('help')}
      on:click={() => {
        window.open('https://github.com/sveltia/sveltia-cms#readme', '_blank');
      }}
    />
    <MenuItem
      label={$_('preferences')}
      on:click={() => {
        showPrefsDialog = true;
      }}
    />
    <Separator />
    <MenuItem
      label={$_('sign_out')}
      on:click={async () => {
        try {
          await LocalStorage.delete('sveltia-cms.user');
          await LocalStorage.delete('netlify-cms-user');
        } catch {
          //
        }

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

<style lang="scss">
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 32px;
    object-fit: cover;
  }
</style>
