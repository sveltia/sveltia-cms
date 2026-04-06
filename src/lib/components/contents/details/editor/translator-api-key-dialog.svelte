<script>
  import { _ } from '@sveltia/i18n';
  import { PromptDialog, Spacer } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';

  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { showContentOverlay, translatorApiKeyDialogState } from '$lib/services/contents/editor';
  import { translator } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs';

  const { serviceId, apiLabel, developerURL, apiKeyURL, apiKeyPattern } = $derived($translator);

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
  title={_('translate_fields', {
    values: { count: $translatorApiKeyDialogState.multiple ? 2 : 1 },
  })}
  showOk={false}
  textboxAttrs={{
    spellcheck: false,
    monospace: true,
    'aria-label': _('api_key'),
  }}
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
  <TranslatorSelector />
  <Spacer />
  {@html sanitize(
    _('prefs.i18n.translators.description', {
      values: {
        service: apiLabel,
        homeHref: `href="${developerURL}"`,
        apiKeyHref: `href="${apiKeyURL}"`,
      },
    }),
    { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
  )}
</PromptDialog>
