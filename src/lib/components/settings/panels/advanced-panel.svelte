<script>
  import { TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';
  import { skipCIConfigured } from '$lib/services/backends/git/shared/integration';
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
</script>

<section>
  <h3>
    {$_('prefs.advanced.beta.title')}
  </h3>
  <p>
    {$_('prefs.advanced.beta.description')}
  </p>
  <div role="none">
    <PrefSwitch key="beta" label={$_('prefs.advanced.beta.switch_label')} defaultValue={false} />
  </div>
</section>
<section>
  <h3>
    {$_('prefs.advanced.developer_mode.title')}
  </h3>
  <p>
    {$_('prefs.advanced.developer_mode.description')}
  </p>
  <div role="none">
    <PrefSwitch
      key="devModeEnabled"
      label={$_('prefs.advanced.developer_mode.switch_label')}
      defaultValue={false}
    />
  </div>
</section>
{#if $skipCIConfigured}
  <section>
    <h3>
      {$_('prefs.advanced.deploy_hook.title')}
    </h3>
    <p>
      {$_('prefs.advanced.deploy_hook.description')}
    </p>
    <div role="none">
      <TextInput
        bind:value={$prefs.deployHookURL}
        flex
        aria-label={$_('prefs.advanced.deploy_hook.url.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: $_(
              $prefs.deployHookURL
                ? 'prefs.advanced.deploy_hook.url.saved'
                : 'prefs.advanced.deploy_hook.url.removed',
            ),
          });
        }}
      />
    </div>
    <div role="none">
      <TextInput
        bind:value={$prefs.deployHookAuthHeader}
        flex
        aria-label={$_('prefs.advanced.deploy_hook.auth.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: $_(
              $prefs.deployHookAuthHeader
                ? 'prefs.advanced.deploy_hook.auth.saved'
                : 'prefs.advanced.deploy_hook.auth.removed',
            ),
          });
        }}
      />
    </div>
  </section>
{/if}
