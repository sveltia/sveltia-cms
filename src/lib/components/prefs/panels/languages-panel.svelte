<script>
  import { Option, Select, TabPanel, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _, locale as appLocale, locales } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { getLocaleLabel } from '$lib/services/i18n';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-languages">
  <section>
    <h4>{$_('prefs.languages.ui_language.title')}</h4>
    <p>
      {#key $appLocale}
        <Select
          label={getLocaleLabel($appLocale)}
          value={$appLocale}
          on:change={(/** @type {CustomEvent} */ event) => {
            $prefs = { ...$prefs, locale: event.detail.value };
          }}
        >
          {#each $locales as locale}
            <Option
              label={getLocaleLabel(locale)}
              value={locale}
              selected={locale === $appLocale}
            />
          {/each}
        </Select>
      {/key}
    </p>
  </section>
  {#if $siteConfig.i18n?.locales?.length}
    {#each Object.entries(allTranslationServices) as [serviceId, service] (serviceId)}
      {@const { serviceLabel, developerURL, apiKeyURL } = service}
      <section>
        <h4>{$_('prefs.languages.translator.title', { values: { service: serviceLabel } })}</h4>
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
            bind:value={$prefs.apiKeys[serviceId]}
            spellcheck="false"
            aria-label={$_('prefs.languages.translator.field_label', {
              values: { service: serviceLabel },
            })}
          />
        </div>
      </section>
    {/each}
  {/if}
</TabPanel>
