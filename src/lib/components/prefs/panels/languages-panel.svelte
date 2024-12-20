<script>
  import { Option, Select, TabPanel, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _, locale as appLocale, locales as appLocales } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] - Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<TabPanel id="prefs-tab-languages">
  <section>
    <h4>{$_('prefs.languages.ui_language.title')}</h4>
    <div role="none">
      {#key $appLocale}
        <Select
          aria-label={$_('prefs.languages.ui_language.select_language')}
          value={$appLocale ?? undefined}
          onChange={(/** @type {CustomEvent} */ event) => {
            $prefs = { ...$prefs, locale: event.detail.value };
          }}
        >
          {#each $appLocales as locale}
            <Option
              label={getLocaleLabel(locale)}
              value={locale}
              selected={locale === $appLocale}
            />
          {/each}
        </Select>
      {/key}
    </div>
  </section>
  {#if ($siteConfig?.i18n?.locales?.length ?? 0) > 1}
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
        <div role="none">
          {#if $prefs.apiKeys}
            <TextInput
              bind:value={$prefs.apiKeys[serviceId]}
              flex
              spellcheck="false"
              aria-label={$_('prefs.languages.translator.field_label', {
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
  {/if}
</TabPanel>
