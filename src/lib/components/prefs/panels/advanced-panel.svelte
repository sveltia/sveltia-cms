<script>
  import { Switch, TabPanel, TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] - Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } = $derived(
    $siteConfig ?? /** @type {SiteConfig} */ ({}),
  );

  let devModeEnabled = $state(false);

  $effect(() => {
    devModeEnabled = $prefs.devModeEnabled ?? false;
  });

  $effect(() => {
    if ($prefs.devModeEnabled !== devModeEnabled) {
      $prefs.devModeEnabled = devModeEnabled;
    }
  });
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
          onchange={() => {
            onChange?.({
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
