<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { TabPanel, TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-editor">
  {#if $siteConfig.i18n?.locales?.length}
    {#each Object.entries(allTranslationServices) as [serviceId, service] (serviceId)}
      {@const { serviceLabel, landingURL, apiKeyURL } = service}
      <section>
        <h4>{$_('prefs.editor.translator.title', { values: { service: serviceLabel } })}</h4>
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
            bind:value={$prefs.apiKeys[serviceId]}
            spellcheck="false"
            aria-label={$_('prefs.editor.translator.field_label', {
              values: { service: serviceLabel },
            })}
          />
        </div>
      </section>
    {/each}
  {/if}
</TabPanel>
