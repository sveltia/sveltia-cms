<script>
  import { SelectButton, SelectButtonGroup, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-appearance">
  <section>
    <h4>{$_('prefs.appearance.theme')}</h4>
    <div role="none">
      <SelectButtonGroup
        aria-label={$_('prefs.appearance.select_theme')}
        onChange={(event) => {
          $prefs = { ...$prefs, theme: /** @type {CustomEvent} */ (event).detail.value };
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
</TabPanel>
