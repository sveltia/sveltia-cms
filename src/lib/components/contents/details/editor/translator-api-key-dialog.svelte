<script>
  import { Dialog, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import { copyFromLocale } from '$lib/services/contents/editor';
  import {
    pendingTranslatorRequest,
    showTranslatorApiKeyDialog,
    translator,
  } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';

  $: ({ serviceId, serviceLabel, developerURL, apiKeyURL, apiKeyPattern } =
    $translator ?? /** @type {TranslationService} */ ({}));
</script>

<Dialog
  bind:open={$showTranslatorApiKeyDialog}
  showOk={false}
  on:cancel={() => {
    $pendingTranslatorRequest = undefined;
  }}
>
  <p>
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
  </p>
  <div>
    <TextInput
      spellcheck="false"
      aria-label={$_('prefs.languages.translator.field_label', {
        values: { service: serviceLabel },
      })}
      on:input={(event) => {
        const _value = /** @type {HTMLInputElement} */ (event.target).value.trim();

        if (apiKeyPattern && _value.match(apiKeyPattern)) {
          $prefs.apiKeys ||= {};
          $prefs.apiKeys[serviceId] = _value;
          $showTranslatorApiKeyDialog = false;

          if ($pendingTranslatorRequest) {
            copyFromLocale(...$pendingTranslatorRequest);
            $pendingTranslatorRequest = undefined;
          }
        }
      }}
    />
  </div>
</Dialog>

<style lang="scss">
  p {
    margin: 0 0 8px;
  }
</style>
