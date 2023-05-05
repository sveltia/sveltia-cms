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

  $: ({ serviceId, serviceLabel, landingURL, apiKeyURL, apiKeyPattern } = $translator || {});
</script>

<Dialog
  bind:open={$showTranslatorApiKeyDialog}
  showOk={false}
  on:cancel={() => {
    $pendingTranslatorRequest = null;
  }}
>
  <p>
    {@html DOMPurify.sanitize(
      $_('prefs.editor.translator.description', {
        values: {
          service: serviceLabel,
          homeHref: `href="${landingURL}"`,
          apiKeyHref: `href="${apiKeyURL}"`,
        },
      }),
      { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
    )}
  </p>
  <div>
    <TextInput
      spellcheck="false"
      aria-label={$_('prefs.editor.translator.field_label', {
        values: { service: serviceLabel },
      })}
      on:input={({ target: { value } }) => {
        const _value = value.trim();

        if (apiKeyPattern && _value.match(apiKeyPattern)) {
          $prefs.apiKeys ||= {};
          $prefs.apiKeys[serviceId] = _value;
          $showTranslatorApiKeyDialog = false;

          if ($pendingTranslatorRequest) {
            copyFromLocale(...$pendingTranslatorRequest);
            $pendingTranslatorRequest = null;
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
