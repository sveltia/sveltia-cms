<script>
  import { _ } from '@sveltia/i18n';
  import { SecretInput } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { prefs } from '$lib/services/user/prefs';

  /**
   * @import {
   * MediaLibraryService,
   * SettingsPanelOnChangeArgs,
   * TranslationService,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} serviceId The ID of the service for which the API key is being input.
   * @property {MediaLibraryService | TranslationService} service The service for which the API key
   * is being input.
   * @property {string} [ariaLabel] Custom aria-label for the input.
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    serviceId,
    service,
    ariaLabel,
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { apiKeyPattern } = $derived(service);

  let value = $state('');

  /**
   * Handler for `change` event of the text input.
   */
  const onchange = () => {
    const apiKey = value.trim();
    const invalid = !!apiKey && !!apiKeyPattern && !apiKeyPattern.test(apiKey);

    $prefs.apiKeys ??= {};
    $prefs.apiKeys[serviceId] = invalid ? '' : apiKey;

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
    value = $prefs.apiKeys?.[serviceId] ?? '';
  });
</script>

<SecretInput
  bind:value
  flex
  autocomplete="off"
  spellcheck="false"
  aria-label={ariaLabel}
  {onchange}
/>
