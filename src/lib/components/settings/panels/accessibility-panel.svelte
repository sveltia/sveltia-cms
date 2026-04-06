<script>
  import { _ } from '@sveltia/i18n';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';

  /**
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();
</script>

<section>
  <h3>
    {_('prefs.accessibility.underline_links.title')}
  </h3>
  <p>
    {_('prefs.accessibility.underline_links.description')}
  </p>
  <div role="none">
    <PrefSwitch
      key="underlineLinks"
      label={_('prefs.accessibility.underline_links.switch_label')}
    />
  </div>
</section>
