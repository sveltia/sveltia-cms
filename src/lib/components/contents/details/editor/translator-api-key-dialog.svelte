<script>
  import { _ } from '@sveltia/i18n';
  import { PromptDialog, Spacer } from '@sveltia/ui';

  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { showContentOverlay, translatorApiKeyDialogState } from '$lib/services/contents/editor';
  import { getServiceDescription } from '$lib/services/integrations/service-description';
  import { translator } from '$lib/services/integrations/translators';
  import { saveApiKey } from '$lib/services/user/api-keys';
  import { prefs } from '$lib/services/user/prefs.svelte';

  const { serviceId, apiLabel, developerURL, apiKeyURL, apiKeyPattern } = $derived(
    translator.current,
  );

  // eslint-disable-next-line svelte/prefer-writable-derived
  let inputValue = $state('');

  $effect(() => {
    // Update the input value when a different translator service is selected
    inputValue = prefs.apiKeys?.[serviceId] ?? '';
  });

  $effect(() => {
    if (!showContentOverlay.current && translatorApiKeyDialogState.current.show) {
      // Close the dialog when the Content Editor is closed
      translatorApiKeyDialogState.current.show = false;
      translatorApiKeyDialogState.current.resolve?.();
    }
  });

  /**
   * Saves the API key to the user preferences if it matches the expected pattern. It’s called when
   * the dialog is confirmed or a key is pasted, not while a key is being typed, because a pattern
   * without a maximum length would match a key cut short.
   */
  const saveKey = () => {
    const apiKey = saveApiKey(serviceId, inputValue, apiKeyPattern);

    if (apiKey !== undefined) {
      translatorApiKeyDialogState.current.show = false;
      translatorApiKeyDialogState.current.resolve?.(apiKey);
    }
  };
</script>

<PromptDialog
  bind:open={translatorApiKeyDialogState.current.show}
  bind:value={inputValue}
  title={_('translate_fields', {
    values: { count: translatorApiKeyDialogState.current.multiple ? 2 : 1 },
  })}
  textboxAttrs={{
    spellcheck: false,
    monospace: true,
    ariaLabel: _('api_key'),
  }}
  oninput={(event) => {
    if (/** @type {InputEvent} */ (event).inputType === 'insertFromPaste') {
      saveKey();
    }
  }}
  onOk={() => saveKey()}
  onCancel={() => {
    translatorApiKeyDialogState.current.resolve?.();
  }}
>
  <TranslatorSelector />
  <Spacer />
  {@html getServiceDescription('prefs.i18n.translators.description', {
    service: apiLabel,
    developerURL,
    apiKeyURL,
  })}
</PromptDialog>
