<script>
  import { Option, Select, SelectButton, SelectButtonGroup, TabPanel } from '@sveltia/ui';
  import { _, locale as appLocale, locales } from 'svelte-i18n';
  import { getLocaleLabel } from '$lib/services/i18n';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-appearance">
  <section>
    <h4>{$_('prefs.appearance.theme')}</h4>
    <p>
      <SelectButtonGroup
        on:change={({ detail: { value } }) => {
          $prefs = { ...$prefs, theme: value };
        }}
      >
        {#each ['auto', 'dark', 'light'] as value}
          <SelectButton
            class="tertiary"
            label={$_(`prefs.theme.${value}`)}
            {value}
            selected={(!$prefs.theme && value === 'auto') || $prefs.theme === value}
          />
        {/each}
      </SelectButtonGroup>
    </p>
  </section>
  <section>
    <h4>{$_('prefs.appearance.language')}</h4>
    <p>
      {#key $appLocale}
        <Select
          label={getLocaleLabel($appLocale)}
          value={$appLocale}
          on:change={(/** @type {CustomEvent} */ event) => {
            $prefs = { ...$prefs, locale: event.detail.value };
          }}
        >
          {#each $locales as locale}
            <Option
              label={getLocaleLabel(locale)}
              value={locale}
              selected={locale === $appLocale}
            />
          {/each}
        </Select>
      {/key}
    </p>
  </section>
</TabPanel>
