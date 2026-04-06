<script>
  import { _ } from '@sveltia/i18n';
  import { SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { prefs } from '$lib/services/user/prefs';

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
        $prefs = { ...$prefs, theme: event.detail.value };
      }}
    >
      {#each ['auto', 'dark', 'light'] as value (value)}
        <SelectButton
          variant="tertiary"
          label={_(`prefs.theme.${value}`)}
          {value}
          selected={(!$prefs.theme && value === 'auto') || $prefs.theme === value}
        />
      {/each}
    </SelectButtonGroup>
  </div>
</section>
