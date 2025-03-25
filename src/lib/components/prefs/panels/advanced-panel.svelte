<script>
  import { Switch, TabPanel, TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const autoDeployEnabled = $derived($siteConfig?.backend.automatic_deployments);

  let beta = $state(false);
  let devModeEnabled = $state(false);

  $effect(() => {
    beta = $prefs.beta ?? false;
  });

  $effect(() => {
    if ($prefs.beta !== beta) {
      $prefs.beta = beta;
    }
  });

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
  <section>
    <h4>
      {$_('prefs.advanced.beta.title')}
    </h4>
    <p>
      {$_('prefs.advanced.beta.description')}
    </p>
    <div role="none">
      <Switch bind:checked={beta} label={$_('prefs.advanced.beta.switch_label')} />
    </div>
  </section>
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
</TabPanel>
