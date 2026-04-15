<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, PromptDialog, Spacer } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { allBackendServices } from '$lib/services/backends';
  import { cmsConfig } from '$lib/services/config';
  import {
    signInAutomatically,
    signInError,
    signingIn,
    signInManually,
  } from '$lib/services/user/auth';
  import { isBrave, isLocalBackendSupported, isLocalHost } from '$lib/services/user/env';
  import { makeLink } from '$lib/services/utils/string';

  /**
   * @import { Backend, GitBackend, GiteaBackend } from '$lib/types/public';
   */

  let showTokenDialog = $state(false);
  let token = $state('');

  const configuredBackend = $derived(/** @type {Backend} */ ($cmsConfig?.backend));
  const backendName = $derived(/** @type {string} */ (configuredBackend.name));
  const backend = $derived(backendName ? allBackendServices[backendName] : null);
  const isTestRepo = $derived(backendName === 'test-repo');
  const repositoryName = $derived(
    isTestRepo ? undefined : /** @type {GitBackend} */ (configuredBackend)?.repo?.split('/').pop(),
  );
  const showLocalBackendOption = $derived($isLocalHost && !isTestRepo);
  const tokenAuthDisabled = $derived(
    !isTestRepo && /** @type {GitBackend} */ (configuredBackend).allow_token_auth === false,
  );

  /**
   * The label to use for the Sign In button, which is usually the backend’s label but can be
   * overridden for specific backends (e.g. Forgejo on Codeberg) to provide a better UX.
   */
  const signInServiceLabel = $derived.by(() => {
    if (
      backendName === 'gitea' &&
      /** @type {GiteaBackend} */ (configuredBackend).base_url === 'https://codeberg.org'
    ) {
      return 'Codeberg';
    }

    return backend?.label;
  });

  /**
   * Whether the Sign In button should be disabled due to missing configuration that prevents
   * signing in. Gitea with PKCE authentication requires an app ID. If it’s not provided, the button
   * should be disabled. We can’t check this during config validation because token authentication
   * doesn’t require an app ID, so we check it here instead.
   * @see https://github.com/sveltia/sveltia-cms/issues/721
   */
  const signInDisabled = $derived.by(() => {
    if (backendName === 'gitea' && !(/** @type {GiteaBackend} */ (configuredBackend).app_id)) {
      return true;
    }

    return false;
  });

  onMount(() => {
    // Skip automatic sign-in if there's already an error (e.g. repository access denied), so the
    // error message is preserved and the user can try again with different credentials
    if (!$signInError.message) {
      signInAutomatically();
    }
  });
</script>

<div role="none" class="buttons">
  {#if $signingIn}
    <div role="alert" class="message">{_('signing_in')}</div>
  {:else if backend}
    {#if showLocalBackendOption}
      <Button
        variant="primary"
        label={_('work_with_local_repo')}
        disabled={!$isLocalBackendSupported}
        onclick={async () => {
          await signInManually('local');
        }}
      />
      {#if !$isLocalBackendSupported}
        <div role="alert">
          {#if $isBrave}
            {@html makeLink(
              _('local_workflow.disabled'),
              'https://sveltiacms.app/en/docs/workflows/local#enabling-file-system-access-api-in-brave',
            )}
          {:else}
            {_('local_workflow.unsupported_browser')}
          {/if}
        </div>
      {:else if !$signInError.message}
        <div role="none">
          {#if repositoryName}
            {_('work_with_local_repo_description', { values: { repo: repositoryName } })}
          {:else}
            {_('work_with_local_repo_description_no_repo')}
          {/if}
        </div>
      {/if}
      <Spacer />
    {/if}
    <Button
      variant={showLocalBackendOption ? 'secondary' : 'primary'}
      label={isTestRepo
        ? _('work_with_test_repo')
        : _('sign_in_with_x', { values: { service: signInServiceLabel } })}
      disabled={signInDisabled}
      onclick={async () => {
        await signInManually(backendName);
      }}
    />
    {#if !isTestRepo}
      <Button
        variant="secondary"
        label={_('sign_in_using_access_token', { values: { service: signInServiceLabel } })}
        disabled={tokenAuthDisabled}
        onclick={() => {
          showTokenDialog = true;
        }}
      />
    {/if}
  {/if}
  {#if $signInError.message && $signInError.context === 'authentication'}
    <div role="alert" class="error iconic">
      <Icon name="error" />
      {$signInError.message}
    </div>
  {/if}
</div>

<PromptDialog
  bind:open={showTokenDialog}
  bind:value={token}
  title={_('sign_in_using_access_token')}
  textboxAttrs={{ spellcheck: false, 'aria-label': _('personal_access_token') }}
  okLabel={_('sign_in')}
  okDisabled={!token.trim()}
  onOk={async () => {
    await signInManually(backendName, token.trim());
  }}
>
  {_('sign_in_using_access_token_description')}
  {#if backend?.repository?.tokenPageURL}
    {@html makeLink(
      _('sign_in_using_access_token_link', { values: { service: signInServiceLabel } }),
      backend.repository.tokenPageURL,
    )}
  {/if}
</PromptDialog>

<style lang="scss">
  .buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;

    :global {
      .button {
        width: 320px;
      }
    }
  }

  [role='alert'] {
    &.iconic {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &.error {
      color: var(--sui-error-foreground-color);
    }
  }
</style>
