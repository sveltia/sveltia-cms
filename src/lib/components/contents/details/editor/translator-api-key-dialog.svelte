<script>
  import { PromptDialog } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import {
    showContentOverlay,
    translatorApiKeyDialogState,
  } from '$lib/services/contents/draft/editor';
  import { translator } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';

  const { serviceId, serviceLabel, developerURL, apiKeyURL, apiKeyPattern } = $derived(
    $translator ?? /** @type {TranslationService} */ ({}),
  );

  $effect(() => {
    if (!$showContentOverlay && $translatorApiKeyDialogState.show) {
      // Close the dialog when the Content Editor is closed
      $translatorApiKeyDialogState.show = false;
      $translatorApiKeyDialogState.resolve?.();
    }
  });
</script>

<PromptDialog
  bind:open={$translatorApiKeyDialogState.show}
  title={$_($translatorApiKeyDialogState.multiple ? 'translate_fields' : 'translate_field')}
  showOk={false}
  textboxAttrs={{ spellcheck: false, 'aria-label': $_('api_key') }}
  oninput={(event) => {
    const _value = /** @type {HTMLInputElement} */ (event.target).value.trim();

    if (apiKeyPattern?.test(_value)) {
      $prefs.apiKeys ??= {};
      $prefs.apiKeys[serviceId] = _value;
      $translatorApiKeyDialogState.show = false;
      $translatorApiKeyDialogState.resolve?.(_value);
    }
  }}
  onCancel={() => {
    $translatorApiKeyDialogState.resolve?.();
  }}
>
  {@html DOMPurify.sanitize(
    $_('prefs.languages.translator.description', {
      values: {
        service: serviceLabel,
        homeHref: `href="${developerURL}"`,
        apiKeyHref: `href="${apiKeyURL}"`,
      },
    }),
    { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
  )}
</PromptDialog>
