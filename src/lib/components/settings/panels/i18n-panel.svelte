<script>
  import { TextInput } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';

  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();
</script>

<section>
  <h4>{$_('prefs.i18n.default_translator.title')}</h4>
  <div role="none">
    <TranslatorSelector />
  </div>
</section>

{#each Object.entries(allTranslationServices) as [serviceId, service] (serviceId)}
  {@const { serviceLabel, apiLabel, developerURL, apiKeyURL } = service}
  <section>
    <h4>{serviceLabel}</h4>
    <p>
      {@html sanitize(
        $_('prefs.i18n.translator.description', {
          values: {
            service: apiLabel,
            homeHref: `href="${developerURL}"`,
            apiKeyHref: `href="${apiKeyURL}"`,
          },
        }),
        { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
      )}
    </p>
    <div role="none">
      {#if $prefs.apiKeys}
        <TextInput
          bind:value={$prefs.apiKeys[serviceId]}
          flex
          monospace
          spellcheck="false"
          aria-label={$_('prefs.i18n.translator.field_label', {
            values: { service: serviceLabel },
          })}
          onchange={() => {
            onChange?.({
              message: $_(
                $prefs.apiKeys?.[serviceId]
                  ? 'prefs.changes.api_key_saved'
                  : 'prefs.changes.api_key_removed',
              ),
            });
          }}
        />
      {/if}
    </div>
  </section>
{/each}
