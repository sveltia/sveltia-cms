<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeySection from '$lib/components/settings/controls/api-key-section.svelte';
  import TranslatorSelector from '$lib/components/settings/controls/translator-selector.svelte';
  import { allTranslationServices } from '$lib/services/integrations/translators';

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

<ApiKeySection
  title={_('prefs.i18n.translators.api_keys.title')}
  description={_('prefs.i18n.translators.api_keys.description')}
  docsURL="https://sveltiacms.app/en/docs/integrations/translations"
  entries={Object.entries(allTranslationServices)}
  getFieldLabel={(service) => _('prefs.i18n.translators.field_label', { values: { service } })}
  {onChange}
/>
