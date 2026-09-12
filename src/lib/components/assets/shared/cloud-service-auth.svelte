<!--
  @component
  Prompt the user for the credentials needed to use an external media library service: an API key
  for a stock photo provider or most cloud storage services, or a username and password for a
  service that requires signing in. The credentials are saved to the user preferences once
  validated, so they can be reused across the asset picker, the Asset Library and the Settings
  dialog.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState, SecretInput, TextInput } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';

  import { prefs } from '$lib/services/user/prefs.svelte';
  import { LINK_SANITIZE_OPTIONS } from '$lib/services/utils/string';

  /**
   * @import { MediaLibraryService } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {MediaLibraryService} serviceProps Media library service details.
   * @property {string} [error] Error message shown above the prompt, e.g. when the credentials
   * saved earlier have been rejected by the service, so the user can enter new ones.
   * @property {() => void} [onAuth] Called once the credentials have been saved.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    serviceProps,
    error = undefined,
    onAuth = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    serviceType = 'stock_assets',
    serviceId = '',
    serviceLabel = '',
    authType = 'api_key',
    developerURL = '',
    apiKeyURL = '',
    apiKeyPattern,
    signIn,
  } = $derived(serviceProps);

  const isStockAssets = $derived(serviceType === 'stock_assets');

  const input = $state({ userName: '', password: '' });
  /** @type {'initial' | 'requested' | 'success' | 'error'} */
  let authState = $state('initial');
</script>

<EmptyState>
  {#if error}
    <p role="alert" class="error">{error}</p>
  {/if}
  <p role="alert">
    {#if isStockAssets}
      {@html sanitize(
        _('prefs.media.stock_photos.description', {
          values: {
            service: serviceLabel,
            homeHref: `href="${developerURL}"`,
            apiKeyHref: `href="${apiKeyURL}"`,
          },
        })
          // Remove invisible characters used for link detection in the locale string
          .replace(/[\u2068\u2069]/g, ''),
        LINK_SANITIZE_OPTIONS,
      )}
    {/if}
    {#if serviceType === 'cloud_storage'}
      {@html sanitize(
        _(`cloud_storage.${serviceId}.auth.${authState}`, {
          default: _(`cloud_storage.auth.${authType}.${authState}`, {
            values: {
              service: serviceLabel,
              key: _(`cloud_storage.${serviceId}.auth_key_label`, {
                default: _(`cloud_storage.auth.${authType}.key_label`),
              }),
            },
          }),
        }),
        LINK_SANITIZE_OPTIONS,
      )}
    {/if}
  </p>
  {#if authType === 'api_key'}
    <div role="none" class="input-outer">
      <TextInput
        dir="ltr"
        flex
        monospace
        spellcheck="false"
        aria-label={_('prefs.media.stock_photos.field_label', {
          values: { service: serviceLabel },
        })}
        oninput={(event) => {
          const _value = /** @type {HTMLInputElement} */ (event.target).value.trim();

          if (apiKeyPattern?.test(_value)) {
            prefs.apiKeys ??= {};
            prefs.apiKeys[serviceId] = _value;
            onAuth?.();
          }
        }}
      />
    </div>
  {/if}
  {#if authType === 'password'}
    <div role="none" class="input-outer">
      <TextInput
        dir="ltr"
        flex
        spellcheck="false"
        aria-label={_('username')}
        disabled={authState === 'requested'}
        bind:value={input.userName}
      />
    </div>
    <div role="none" class="input-outer">
      <SecretInput
        aria-label={_('password')}
        disabled={authState === 'requested'}
        bind:value={input.password}
      />
    </div>
    <div role="none" class="input-outer">
      <Button
        variant="secondary"
        label={_('sign_in')}
        disabled={!input.userName || !input.password || authState === 'requested'}
        onclick={async () => {
          authState = 'requested';
          input.userName = input.userName.trim();
          input.password = input.password.trim();

          if (await signIn?.(input.userName, input.password)) {
            authState = 'success';
            prefs.logins ??= {};
            prefs.logins[serviceId] = [input.userName, input.password].join(' ');
            onAuth?.();
          } else {
            authState = 'error';
          }
        }}
      />
    </div>
  {/if}
</EmptyState>

<style>
  p {
    margin: 0 0 8px;

    &.error {
      color: var(--sui-error-foreground-color);
    }
  }

  .input-outer {
    width: 400px;
    max-width: 100%;
    text-align: center;
  }
</style>
