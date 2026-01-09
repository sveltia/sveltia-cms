<script>
  import { Button, Icon, PromptDialog, Spacer } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import { allBackendServices } from '$lib/services/backends';
  import { cmsConfig } from '$lib/services/config';
  import {
    signInAutomatically,
    signInError,
    signingIn,
    signInManually,
  } from '$lib/services/user/auth';

  /**
   * @import { GitBackend } from '$lib/types/public';
   */

  let isLocalHost = $state(false);
  let isLocalBackendSupported = $state(false);
  let isBrave = $state(false);
  let showTokenDialog = $state(false);
  let token = $state('');

  const configuredBackendName = $derived(/** @type {string} */ ($cmsConfig?.backend?.name));
  const configuredBackend = $derived(
    configuredBackendName ? allBackendServices[configuredBackendName] : null,
  );
  const isTestRepo = $derived(configuredBackendName === 'test-repo');
  const repositoryName = $derived(
    isTestRepo
      ? undefined
      : /** @type {GitBackend} */ ($cmsConfig?.backend)?.repo?.split('/').pop(),
  );
  const showLocalBackendOption = $derived(isLocalHost && !isTestRepo);

  /**
   * Replace `<a>` tag in a localization string, and sanitize the result.
   * @param {object} args Arguments.
   * @param {string} args.key Localization key.
   * @param {Record<string, string>} [args.values] Values for interpolation.
   * @param {string} args.link Link URL.
   * @returns {string} Linked and sanitized HTML string.
   */
  const getLinkedString = ({ key, values, link }) =>
    sanitize($_(key, { values }).replace('<a>', `<a href="${link}" target="_blank">`), {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href', 'target'],
    });

  onMount(() => {
    const { hostname } = window.location;

    // Local editing needs a secure context, either `http://localhost` or `http://*.localhost`
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    isLocalHost =
      hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.localhost');
    isLocalBackendSupported = 'showDirectoryPicker' in window;
    isBrave = navigator.userAgentData?.brands.some(({ brand }) => brand === 'Brave') ?? false;

    signInAutomatically();
  });
</script>

<div role="none" class="buttons">
  {#if $signingIn}
    <div role="alert" class="message">{$_('signing_in')}</div>
  {:else if !configuredBackend}
    <div role="alert">
      {$_('config.error.unsupported_backend', { values: { name: configuredBackendName } })}
    </div>
  {:else}
    {#if showLocalBackendOption}
      <Button
        variant="primary"
        label={$_('work_with_local_repo')}
        disabled={!isLocalBackendSupported}
        onclick={async () => {
          await signInManually('local');
        }}
      />
      {#if !isLocalBackendSupported}
        <div role="alert">
          {#if isBrave}
            {@html getLinkedString({
              key: 'local_backend.disabled',
              link: 'https://sveltiacms.app/en/docs/workflows/local#enabling-file-system-access-api-in-brave',
            })}
          {:else}
            {$_('local_backend.unsupported_browser')}
          {/if}
        </div>
      {:else if !$signInError.message}
        <div role="none">
          {#if repositoryName}
            {$_('work_with_local_repo_description', { values: { repo: repositoryName } })}
          {:else}
            {$_('work_with_local_repo_description_no_repo')}
          {/if}
        </div>
      {/if}
      <Spacer />
    {/if}
    <Button
      variant={showLocalBackendOption ? 'secondary' : 'primary'}
      label={isTestRepo
        ? $_('work_with_test_repo')
        : $_('sign_in_with_x', { values: { service: configuredBackend.label } })}
      onclick={async () => {
        await signInManually(configuredBackendName);
      }}
    />
    {#if !isTestRepo}
      <Button
        variant="secondary"
        label={$_('sign_in_with_x_using_token', { values: { service: configuredBackend.label } })}
        onclick={() => {
          showTokenDialog = true;
        }}
      />
    {/if}
  {/if}
  {#if $signInError.message && $signInError.context === 'authentication'}
    <div role="alert" class="error">
      <Icon name="error" />
      {$signInError.message}
    </div>
  {/if}
</div>

<PromptDialog
  bind:open={showTokenDialog}
  bind:value={token}
  title={$_('sign_in_using_pat_title')}
  textboxAttrs={{ spellcheck: false, 'aria-label': $_('personal_access_token') }}
  okLabel={$_('sign_in')}
  okDisabled={!token.trim()}
  onOk={async () => {
    await signInManually(configuredBackendName, token.trim());
  }}
>
  {$_('sign_in_using_pat_description')}
  {#if configuredBackend?.repository?.tokenPageURL}
    {@html getLinkedString({
      key: 'sign_in_using_pat_link',
      values: { service: configuredBackend.label },
      link: configuredBackend.repository.tokenPageURL,
    })}
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
    display: flex;
    align-items: center;
    gap: 8px;

    &.error {
      color: var(--sui-error-foreground-color);
    }
  }
</style>
