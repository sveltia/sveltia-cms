<script>
  import { _ } from '@sveltia/i18n';
  import { AlertDialog, Divider, Menu, MenuItem } from '@sveltia/ui';

  import AppInstallMenuItem from '$lib/components/global/toolbar/items/app-install-menu-item.svelte';
  import ShortcutsMenuItem from '$lib/components/help/shortcuts-menu-item.svelte';
  import SettingsDialog from '$lib/components/settings/settings-dialog.svelte';
  import { getAdditions } from '$lib/services/app/additions';
  import { goto, openProductionSite } from '$lib/services/app/navigation';
  import { canShowMobileSignInDialog, showMobileSignInDialog } from '$lib/services/app/onboarding';
  import { backend, backendName } from '$lib/services/backends';
  import { isDemoSite } from '$lib/services/backends/fs/seed';
  import { user } from '$lib/services/user/account.svelte';
  import { signOut } from '$lib/services/user/auth.svelte';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @typedef {object} Props
   * @property {import('@sveltia/ui').MenuButton} [menuButton] Menu button.
   */

  /** @type {Props} */
  let { menuButton } = $props();

  let showPrefsDialog = $state(false);
  /** Why linking a GitHub account failed, if it did. */
  let linkError = $state('');

  /** Sveltia CMS Additions, whose chunk is loaded along with the backend if it’s enabled. */
  const additions = $derived(getAdditions());
  const isLocalRepo = $derived(backendName.current === 'local');
  const isTestRepo = $derived(backendName.current === 'test-repo');
  const isDemo = $derived(isDemoSite(backendName.current));
</script>

<Menu ariaLabel={_('account')}>
  <MenuItem
    label={isLocalRepo
      ? _('working_with_local_repo')
      : isDemo
        ? _('working_in_demo_mode')
        : isTestRepo
          ? _('working_with_test_repo')
          : user.account?.role
            ? _('additions.signed_in_as_x_with_role', {
                values: {
                  name: user.account.login,
                  role: _(`additions.users.roles.${user.account.role}`),
                },
              })
            : _('signed_in_as_x', { values: { name: user.account?.login } })}
    disabled={isLocalRepo || isTestRepo}
    onclick={() => {
      openNewTab(user.account?.profileURL);
    }}
  />
  <Divider />
  <MenuItem
    label={_('live_site')}
    onclick={() => {
      openProductionSite();
    }}
  />
  {#if prefs.devModeEnabled}
    <MenuItem
      label={_('git_repository')}
      disabled={!backend.current?.repository?.treeBaseURL}
      onclick={() => {
        openNewTab(backend.current?.repository?.treeBaseURL);
      }}
    />
  {/if}
  <Divider />
  <!--
    A local repository can be used without signing in to Sveltia CMS Additions. The password is
    changed in the Account settings panel
  -->
  {#if additions && !isLocalRepo}
    <!-- Someone with their own GitHub token is the author of their commits -->
    {#if additions.additionsAuth.signInMethods.includes('github') && !user.account?.ownGitHubToken}
      <MenuItem
        label={_('additions.link_github')}
        onclick={async () => {
          try {
            await additions.linkGitHubAccount();
          } catch (/** @type {any} */ ex) {
            linkError = ex.cause?.message ?? ex.message;
          }
        }}
      />
    {/if}
  {/if}
  <MenuItem
    label={_('settings')}
    onclick={() => {
      if (env.isSmallScreen) {
        goto('/settings', { transitionType: 'forwards' });
      } else {
        showPrefsDialog = true;
      }
    }}
  />
  <!-- When dev mode is enabled, the shortcuts menu item appears in the Help menu -->
  {#if !prefs.devModeEnabled}
    <ShortcutsMenuItem {menuButton} />
  {/if}
  {#if canShowMobileSignInDialog.current}
    <MenuItem
      label={_('sign_in_with_mobile')}
      onclick={() => {
        showMobileSignInDialog.current = true;
      }}
    />
  {/if}
  <AppInstallMenuItem />
  <Divider />
  <MenuItem
    label={_('sign_out')}
    onclick={async () => {
      // Wait a bit before the menu is closed
      window.requestAnimationFrame(() => {
        signOut();
      });
    }}
  />
</Menu>

<AlertDialog
  open={!!linkError}
  title={_('additions.link_github_error')}
  onClose={() => {
    linkError = '';
  }}
>
  {linkError}
</AlertDialog>

<SettingsDialog
  bind:open={showPrefsDialog}
  onClose={() => {
    menuButton?.focus();
  }}
/>
