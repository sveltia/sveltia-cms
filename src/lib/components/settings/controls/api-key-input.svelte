<script>
  import { _ } from '@sveltia/i18n';
  import { SecretInput } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { isInvalidApiKey, isSharedApiKey, setApiKey } from '$lib/services/user/api-keys';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @import {
   * AiService,
   * MediaLibraryService,
   * SettingsPanelOnChangeArgs,
   * TranslationService,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} serviceId The ID of the service for which the API key is being input.
   * @property {AiService | MediaLibraryService | TranslationService} service The service for
   * which the API key is being input.
   * @property {string} [ariaLabel] Custom aria-label for the input.
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let { serviceId, service, ariaLabel, onChange = undefined } = $props();

  const { apiKeyPattern } = $derived(service);

  let value = $state('');

  /**
   * Handler for `change` event of the text input.
   */
  const onchange = () => {
    const apiKey = value.trim();
    const invalid = isInvalidApiKey(apiKey, apiKeyPattern);

    setApiKey(serviceId, invalid ? '' : apiKey);

    onChange?.({
      message: invalid
        ? _('prefs.changes.api_key_invalid')
        : apiKey
          ? _('prefs.changes.api_key_saved')
          : _('prefs.changes.api_key_removed'),
      status: invalid ? 'error' : 'success',
    });
  };

  onMount(() => {
    value = prefs.apiKeys?.[serviceId] ?? '';
  });
</script>

<!-- An admin’s key is used until the user enters their own, so say so rather than show it -->
<SecretInput
  bind:value
  flex
  autocomplete="off"
  spellcheck="false"
  placeholder={isSharedApiKey(serviceId) ? _('additions.provided_by_admin') : undefined}
  {ariaLabel}
  {onchange}
/>
