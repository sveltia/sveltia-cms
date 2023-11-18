<script>
  import { Switch, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
</script>

<TabPanel id="prefs-tab-advanced">
  <section>
    <h4>
      {$_('prefs.advanced.developer_mode.title')}
    </h4>
    <p>
      {$_('prefs.advanced.developer_mode.description')}
    </p>
    <div role="none">
      <Switch
        bind:checked={$prefs.devModeEnabled}
        label={$_('prefs.advanced.developer_mode.switch_label')}
      />
    </div>
  </section>
</TabPanel>
