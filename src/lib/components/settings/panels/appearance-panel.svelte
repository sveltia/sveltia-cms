<script>
  import { _ } from '@sveltia/i18n';
  import { SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { AUTO_PREF_VALUE, prefs } from '$lib/services/user/prefs.svelte';

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
  <h3>{_('prefs.appearance.theme')}</h3>
  <div role="none">
    <SelectButtonGroup
      aria-label={_('prefs.appearance.select_theme')}
      onChange={(event) => {
        prefs.theme = event.detail.value;
      }}
    >
      {#each [AUTO_PREF_VALUE, 'dark', 'light'] as value (value)}
        <SelectButton
          variant="tertiary"
          label={value === AUTO_PREF_VALUE ? _('automatic') : _(`prefs.theme.${value}`)}
          {value}
          selected={(!prefs.theme && value === AUTO_PREF_VALUE) || prefs.theme === value}
        />
      {/each}
    </SelectButtonGroup>
  </div>
</section>
