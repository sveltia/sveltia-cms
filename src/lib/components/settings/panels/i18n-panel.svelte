<script>
  import { PasswordInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs';
  import { makeLink } from '$lib/services/utils/string';

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
  <h3>{$_('prefs.i18n.translators.default.title')}</h3>
  <div role="none">
    <TranslatorSelector />
  </div>
</section>

<section>
  <h3>{$_('prefs.i18n.translators.api_keys.title')}</h3>
  <p>
    {@html makeLink(
      $_('prefs.i18n.translators.api_keys.description'),
      'https://sveltiacms.app/en/docs/integrations/translations',
    )}
  </p>
  {#each Object.entries(allTranslationServices) as [serviceId, { serviceLabel }] (serviceId)}
    <section>
      <h4>{serviceLabel}</h4>
      <div role="none">
        {#if $prefs.apiKeys}
          <PasswordInput
            bind:value={$prefs.apiKeys[serviceId]}
            flex
            autocomplete="off"
            spellcheck="false"
            aria-label={$_('prefs.i18n.translators.field_label', {
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
</section>
