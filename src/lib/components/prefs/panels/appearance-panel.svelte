<script>
  import { SelectButton, SelectButtonGroup, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-appearance">
  <section>
    <h4>{$_('prefs.appearance.theme')}</h4>
    <p>
      <SelectButtonGroup
        on:change={(/** @type {CustomEvent} */ { detail: { value } }) => {
          $prefs = { ...$prefs, theme: value };
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
    </p>
  </section>
</TabPanel>
