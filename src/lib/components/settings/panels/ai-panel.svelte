<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeySection from '$lib/components/settings/controls/api-key-section.svelte';
  import { allAiServices } from '$lib/services/integrations/ai';

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

<ApiKeySection
  title={_('prefs.ai.api_keys.title')}
  description={_('prefs.ai.api_keys.description')}
  entries={Object.entries(allAiServices)}
  getFieldLabel={(service) => _('prefs.ai.field_label', { values: { service } })}
  {onChange}
/>
