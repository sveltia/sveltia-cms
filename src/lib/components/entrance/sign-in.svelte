<script>
  import { Button, Dialog } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { user } from '$lib/services/auth';
  import { allBackendServices, backend } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import LocalStorage from '$lib/services/utils/local-storage';

  let isLocal = false;
  let isLocalUnsupported = false;
  let showErrorDialog = false;
  let errorReason;

  /**
   * Sign in with the given backend.
   *
   * @param {string} backendName Backend name like `github`.
   * @param {string} [savedToken] User’s auth token. Can be empty for the local backend or when a
   * token is not saved in the local storage.
   */
  const signIn = async (backendName, savedToken = '') => {
    const handler = allBackendServices[backendName];

    if (handler) {
      $backend = handler;

      try {
        const _user = await $backend.signIn(savedToken);

        $user = _user;
        LocalStorage.set('sveltia-cms.user', _user);
      } catch {
        showErrorDialog = true;
        errorReason = 'unexpected';
      }
    } else {
      showErrorDialog = true;
      errorReason = 'backend';
    }
  };

  onMount(() => {
    // Local editing needs a secure context, either `http://localhost` or `http://*.localhost`
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    isLocal = window.location.hostname.match(/^(?:.+\.)?localhost$/);

    // Check if the browser supports the File System Access API
    isLocalUnsupported = isLocal && !('showDirectoryPicker' in window);

    // Automatically sign into a Git-based backend if the user info is cached. Check the compatible
    // Netlify CMS cache as well. Don’t try to sign in if the local backend is being used, because
    // it requires user interaction to acquire file/directory handles.
    (async () => {
      const { backendName, token } =
        (await LocalStorage.get('sveltia-cms.user')) ||
        (await LocalStorage.get('netlify-cms-user')) ||
        {};

      if (backendName && backendName !== 'local' && token) {
        await signIn(backendName, token);
      }
    })();
  });
</script>

<div class="buttons">
  {#if isLocal}
    <Button
      class="primary"
      label={$_('work_with_local_repo')}
      disabled={isLocalUnsupported}
      on:click={async () => {
        await signIn('local');
      }}
    />
    {#if isLocalUnsupported}
      {$_(`unsupported.browser`)}
    {/if}
  {:else}
    <Button
      class="primary"
      label={$_('sign_in_with_x', {
        values: { name: allBackendServices[$siteConfig.backend?.name]?.label },
      })}
      on:click={async () => {
        await signIn($siteConfig.backend?.name);
      }}
    />
  {/if}
</div>

<Dialog bind:open={showErrorDialog} showCancel={false}>
  {$_(`unsupported.${errorReason}`)}
</Dialog>

<style lang="scss">
  .buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    :global(button) {
      width: 240px;
    }
  }
</style>
