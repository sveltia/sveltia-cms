<script>
  import { _ } from '@sveltia/i18n';
  import { PromptDialog, Spacer } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';

  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { showContentOverlay, translatorApiKeyDialogState } from '$lib/services/contents/editor';
  import { translator } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { LINK_SANITIZE_OPTIONS } from '$lib/services/utils/string';

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
   * Saves the API key to the user preferences if it matches the expected pattern.
   */
  const saveKey = () => {
    const apiKey = inputValue.trim();

    if (apiKeyPattern?.test(apiKey)) {
      prefs.apiKeys ??= {};
      prefs.apiKeys[serviceId] = apiKey;
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
    'aria-label': _('api_key'),
  }}
  oninput={() => saveKey()}
  onOk={() => saveKey()}
  onCancel={() => {
    translatorApiKeyDialogState.current.resolve?.();
  }}
>
  <TranslatorSelector />
  <Spacer />
  {@html sanitize(
    _('prefs.i18n.translators.description', {
      values: {
        service: apiLabel,
        homeHref: `href="${developerURL}"`,
        apiKeyHref: `href="${apiKeyURL}"`,
      },
    })
      // Remove invisible characters used for link detection in the locale string
      .replace(/[\u2068\u2069]/g, ''),
    LINK_SANITIZE_OPTIONS,
  )}
</PromptDialog>
