<script>
  import { Switch, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';

  $: underlineLinks = $prefs.underlineLinks ?? true;

  $: {
    if ($prefs.underlineLinks !== underlineLinks) {
      $prefs.underlineLinks = underlineLinks;
    }
  }
</script>

<TabPanel id="prefs-tab-accessibility">
  <section>
    <h4>
      {$_('prefs.accessibility.underline_links.title')}
    </h4>
    <p>
      {$_('prefs.accessibility.underline_links.description')}
    </p>
    <div role="none">
      <Switch
        bind:checked={underlineLinks}
        label={$_('prefs.accessibility.underline_links.switch_label')}
      />
    </div>
  </section>
</TabPanel>
