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

  /**
   * Whether the entered key matches the expected pattern, which is required to confirm the dialog.
   */
  const isKeyValid = $derived(!!apiKeyPattern?.test(inputValue.trim()));

  $effect(() => {
    // Update the input value when a different translator service is selected
    inputValue = prefs.apiKeys?.[serviceId] ?? '';
  });

  /**
   * Settle the promise the translation is waiting for, once. The dialog closes in any case: with a
   * key saved, or cancelled or dismissed, which leaves the translation undone.
   * @param {string} [apiKey] Saved API key.
   */
  const settle = (apiKey) => {
    const { resolve } = translatorApiKeyDialogState.current;

    translatorApiKeyDialogState.current.show = false;
    translatorApiKeyDialogState.current.resolve = undefined;
    resolve?.(apiKey);
  };

  $effect(() => {
    if (!showContentOverlay.current && translatorApiKeyDialogState.current.show) {
      // Close the dialog when the Content Editor is closed
      settle();
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
      settle(apiKey);
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
  okDisabled={!isKeyValid}
  onOk={() => saveKey()}
  onClose={() => {
    // Settle the translation when the dialog is closed without a key being saved, whether it’s
    // cancelled or dismissed. An OK button click has already saved the key, as the button is
    // disabled for an invalid one, and settled it. The dialog doesn’t call this when it has been
    // opened again before it finished closing
    settle();
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
