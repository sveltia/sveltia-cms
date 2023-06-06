<script>
  import { TabPanel, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
  import { allMediaServices } from '$lib/services/integrations/media';
</script>

<TabPanel id="prefs-tab-media">
  {#each Object.entries(allMediaServices) as [serviceId, service] (serviceId)}
    {@const { serviceLabel, landingURL, apiKeyURL } = service}
    <section>
      <h4>
        {$_('prefs.media.stock_photo.title', { values: { service: serviceLabel } })}
      </h4>
      <p>
        {@html DOMPurify.sanitize(
          $_('prefs.media.stock_photo.description', {
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
          aria-label={$_('prefs.media.stock_photo.field_label', {
            values: { service: serviceLabel },
          })}
        />
      </div>
    </section>
  {/each}
</TabPanel>
