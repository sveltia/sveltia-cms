<script>
  import { Button, Dialog } from '@sveltia/ui';
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { user } from '$lib/services/auth';
  import { allBackendServices, backend } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import LocalStorage from '$lib/services/utils/local-storage';

  let backendName = $siteConfig.backend?.name;
  let isLocal = false;
  let isFileAccessUnsupported = false;
  let isLocalStorageDisabled = false;
  let showErrorDialog = false;
  let errorReason;

  $: $backend = allBackendServices[backendName];

  /**
   * Sign in with the given backend.
   * @param {string} [savedToken] User’s auth token. Can be empty for the local backend or when a
   * token is not saved in the local storage.
   */
  const signIn = async (savedToken = '') => {
    try {
      const _user = await $backend.signIn(savedToken);

      $user = _user;
      await LocalStorage.set('sveltia-cms.user', _user);
    } catch (error) {
      showErrorDialog = true;
      errorReason = 'unexpected';

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }
  };

  onMount(() => {
    // Local editing needs a secure context, either `http://localhost` or `http://*.localhost`
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    isLocal = !!window.location.hostname.match(/^(?:.+\.)?localhost$/);

    // Check if the browser supports the File System Access API
    isFileAccessUnsupported = isLocal && !('showDirectoryPicker' in window);

    if (isLocal) {
      backendName = 'local';
    }

    // Automatically sign into a Git-based backend if the user info is cached. Check the compatible
    // Netlify CMS cache as well. Don’t try to sign in if the local backend is being used, because
    // it requires user interaction to acquire file/directory handles.
    (async () => {
      try {
        const { backendName: name, token } =
          (await LocalStorage.get('sveltia-cms.user')) ||
          (await LocalStorage.get('netlify-cms-user')) ||
          {};

        if (name && name !== 'local') {
          backendName = name;
          await tick();

          if ($backend && token) {
            await signIn(token);
          }
        }
      } catch {
        isLocalStorageDisabled = true;
      }
    })();
  });
</script>

<div class="buttons">
  {#if isLocalStorageDisabled}
    <div role="alert">
      {$_('unsupported.storage')}
    </div>
  {:else if isLocal}
    {#if isFileAccessUnsupported}
      <div role="alert">
        {$_(`unsupported.browser`)}
      </div>
    {:else}
      <Button
        class="primary"
        label={$_('work_with_local_repo')}
        on:click={async () => {
          await signIn();
        }}
      />
    {/if}
  {:else if $backend}
    <Button
      class="primary"
      label={$_('sign_in_with_x', { values: { name: $backend.label } })}
      on:click={async () => {
        await signIn();
      }}
    />
  {:else}
    <div role="alert">
      {$_('unsupported.backend_x', { values: { name: backendName } })}
    </div>
  {/if}
</div>

<Dialog bind:open={showErrorDialog} showCancel={false}>
  <div role="alert">
    {$_(`unsupported.${errorReason}`)}
  </div>
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
