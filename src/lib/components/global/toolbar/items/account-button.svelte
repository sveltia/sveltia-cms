<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PublishMenuItem from '$lib/components/global/toolbar/items/publish-menu-item.svelte';
  import ShortcutsDialog from '$lib/components/keyboard-shortcuts/shortcuts-dialog.svelte';
  import PrefsDialog from '$lib/components/prefs/prefs-dialog.svelte';
  import { version } from '$lib/services/app';
  import { goto, openProductionSite } from '$lib/services/app/navigation';
  import { backend, backendName } from '$lib/services/backends';
  import { prefs } from '$lib/services/prefs';
  import { signOut, user } from '$lib/services/user';

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
    {#snippet startIcon()}
      {#if hasAvatar}
        <img class="avatar" loading="lazy" src={$user?.avatarURL} alt="" />
      {:else}
        <Icon name={'account_circle'} />
      {/if}
    {/snippet}
    {#snippet popup()}
      <Menu aria-label={$_('account')}>
        <MenuItem
          label={isLocal
            ? $_('working_with_local_repo')
            : $_('signed_in_as_x', { values: { name: $user?.login } })}
          disabled={isLocal}
          onclick={() => {
            window.open($user?.profileURL, '_blank');
          }}
        />
        <Divider />
        <MenuItem
          label={$_('live_site')}
          onclick={() => {
            openProductionSite();
          }}
        />
        <MenuItem
          label={$_('git_repository')}
          disabled={!$backend?.repository?.treeBaseURL}
          onclick={() => {
            window.open($backend?.repository?.treeBaseURL);
          }}
        />
        <PublishMenuItem />
        <Divider />
        <MenuItem
          label={$_('settings')}
          onclick={() => {
            showPrefsDialog = true;
          }}
        />
        {#if $prefs.devModeEnabled}
          <MenuItem
            label={$_('site_config')}
            onclick={() => {
              goto('/config');
            }}
          />
        {/if}
        <Divider />
        <!-- Assume the user has a physical keyboard if the pointer is mouse (on desktop) -->
        {#if window.matchMedia('(pointer: fine)').matches}
          <MenuItem
            label={$_('help.keyboard_shortcuts')}
            onclick={() => {
              showShortcutsDialog = true;
            }}
          />
        {/if}
        <MenuItem
          label={$_('help.documentation')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/blob/main/README.md', '_blank');
          }}
        />
        <MenuItem
          label={$prefs.devModeEnabled
            ? $_('help.release_notes_version_x', { values: { version } })
            : $_('help.release_notes')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/releases', '_blank');
          }}
        />
        <Divider />
        <MenuItem
          label={$_('help.issue')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/issues/new', '_blank');
          }}
        />
        <MenuItem
          label={$_('help.feedback')}
          onclick={() => {
            window.open(
              'https://github.com/sveltia/sveltia-cms/discussions/new?category=general',
              '_blank',
            );
          }}
        />
        <MenuItem
          label={$_('help.support')}
          onclick={() => {
            window.open(
              'https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a',
              '_blank',
            );
          }}
        />
        <MenuItem
          label={$_('help.discord')}
          onclick={() => {
            window.open('https://discord.gg/6zC5eTCw', '_blank');
          }}
        />
        <Divider />
        <MenuItem
          label={$_('sign_out')}
          onclick={async () => {
            // Wait a bit before the menu is closed
            window.requestAnimationFrame(() => {
              signOut();
            });
          }}
        />
      </Menu>
    {/snippet}
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
