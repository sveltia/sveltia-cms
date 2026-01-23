<script>
  import { SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { prefs } from '$lib/services/user/prefs';

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
  <h3>{$_('prefs.appearance.theme')}</h3>
  <div role="none">
    <SelectButtonGroup
      aria-label={$_('prefs.appearance.select_theme')}
      onChange={(event) => {
        $prefs = { ...$prefs, theme: event.detail.value };
      }}
    >
      {#each ['auto', 'dark', 'light'] as value}
        <SelectButton
          variant="tertiary"
          label={$_(`prefs.theme.${value}`)}
          {value}
          selected={(!$prefs.theme && value === 'auto') || $prefs.theme === value}
        />
      {/each}
    </SelectButtonGroup>
  </div>
</section>
