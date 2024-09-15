<script>
  import { Switch, TabPanel, TextInput } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
  import { siteConfig } from '$lib/services/config';

  $: ({ backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } =
    $siteConfig ?? /** @type {SiteConfig} */ ({}));

  /** @type {boolean | 'mixed' | undefined} */
  $: devModeEnabled = $prefs.devModeEnabled;

  $: {
    if ($prefs.devModeEnabled !== devModeEnabled) {
      $prefs.devModeEnabled = Boolean(devModeEnabled);
    }
  }

  const dispatch = createEventDispatcher();
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
          onChange={() => {
            dispatch('change', {
              message: $_(
                $prefs.deployHookURL
                  ? 'prefs.advanced.deploy_hook.url_saved'
                  : 'prefs.advanced.deploy_hook.url_removed',
              ),
            });
          }}
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
        bind:checked={devModeEnabled}
        label={$_('prefs.advanced.developer_mode.switch_label')}
      />
    </div>
  </section>
</TabPanel>
