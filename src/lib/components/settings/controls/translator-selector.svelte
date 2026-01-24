<script>
  import { Option, Select } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs';
</script>

<Select
  aria-label={$_('prefs.i18n.translators.default.select_service')}
  value={$prefs.defaultTranslationService}
  onChange={(event) => {
    $prefs = { ...$prefs, defaultTranslationService: event.detail.value };
  }}
>
  {#each Object.entries(allTranslationServices) as [key, { serviceLabel: label }] (key)}
    <Option {label} value={key} selected={key === $prefs.defaultTranslationService} />
  {/each}
</Select>
