<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeyInput from '$lib/components/settings/controls/api-key-input.svelte';
  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { makeLink } from '$lib/services/utils/string';

  /**
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<section>
  <h3>{_('prefs.i18n.translators.default.title')}</h3>
  <div role="none">
    <TranslatorSelector />
  </div>
</section>

<section>
  <h3>{_('prefs.i18n.translators.api_keys.title')}</h3>
  <p>
    {@html makeLink(
      _('prefs.i18n.translators.api_keys.description'),
      'https://sveltiacms.app/en/docs/integrations/translations',
    )}
  </p>
  {#each Object.entries(allTranslationServices) as [serviceId, service] (serviceId)}
    {@const label = service.serviceLabel}
    <section>
      <h4>{label}</h4>
      <div role="none">
        <ApiKeyInput
          {serviceId}
          {service}
          ariaLabel={_('prefs.i18n.translators.field_label', { values: { service: label } })}
          {onChange}
        />
      </div>
    </section>
  {/each}
</section>
