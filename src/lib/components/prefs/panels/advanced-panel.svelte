<script>
  import { Switch, TabPanel, TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { prefs } from '$lib/services/prefs';

  $: ({
    backend: { automatic_deployments: autoDeployEnabled },
  } = $siteConfig);
</script>

<TabPanel id="prefs-tab-advanced">
  {#if typeof autoDeployEnabled === 'boolean'}
    <section>
      <h4>
        {$_('prefs.advanced.deploy_hook.title')}
      </h4>
      <p>
        {$_('prefs.advanced.deploy_hook.description')}
      </p>
      <div role="none">
        <TextInput
          bind:value={$prefs.deployHookURL}
          flex
          label={$_('prefs.advanced.deploy_hook.field_label')}
        />
      </div>
    </section>
  {/if}
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
