<script>
  import { PromptDialog } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import { copyFromLocale } from '$lib/services/contents/editor/update';
  import { showContentOverlay } from '$lib/services/contents/editor/view';
  import {
    pendingTranslatorRequest,
    showTranslatorApiKeyDialog,
    translator,
  } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';

  $: ({ serviceId, serviceLabel, developerURL, apiKeyURL, apiKeyPattern } =
    $translator ?? /** @type {TranslationService} */ ({}));

  $: {
    if (!$showContentOverlay) {
      $showTranslatorApiKeyDialog = false;
    }
  }
</script>

<PromptDialog
  title={$_('prefs.languages.translator.field_label', {
    values: { service: serviceLabel },
  })}
  bind:open={$showTranslatorApiKeyDialog}
  showOk={false}
  on:cancel={() => {
    $pendingTranslatorRequest = undefined;
  }}
  textboxAttrs={{ spellcheck: false, 'aria-label': $_('api_key') }}
  on:input={(event) => {
    const _value = /** @type {HTMLInputElement} */ (event.target).value.trim();

    if (apiKeyPattern && _value.match(apiKeyPattern)) {
      $prefs.apiKeys ??= {};
      $prefs.apiKeys[serviceId] = _value;
      $showTranslatorApiKeyDialog = false;

      if ($pendingTranslatorRequest) {
        copyFromLocale(...$pendingTranslatorRequest);
        $pendingTranslatorRequest = undefined;
      }
    }
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
