<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, TextInput } from '@sveltia/ui';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';
  import { clearFileCache, eraseAllData } from '$lib/services/app/cache';
  import { skipCIConfigured } from '$lib/services/backends/git/shared/integration';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let showClearCacheDialog = $state(false);
  let showEraseDataDialog = $state(false);
</script>

<section>
  <h3>
    {_('prefs.advanced.beta.title')}
  </h3>
  <p>
    {_('prefs.advanced.beta.description')}
  </p>
  <div role="none">
    <PrefSwitch key="beta" label={_('prefs.advanced.beta.switch_label')} defaultValue={false} />
  </div>
</section>
<section>
  <h3>
    {_('prefs.advanced.developer_mode.title')}
  </h3>
  <p>
    {_('prefs.advanced.developer_mode.description')}
  </p>
  <div role="none">
    <PrefSwitch
      key="devModeEnabled"
      label={_('prefs.advanced.developer_mode.switch_label')}
      defaultValue={false}
    />
  </div>
</section>
{#if $skipCIConfigured}
  <section>
    <h3>
      {_('prefs.advanced.deploy_hook.title')}
    </h3>
    <p>
      {_('prefs.advanced.deploy_hook.description')}
    </p>
    <div role="none">
      <TextInput
        dir="ltr"
        bind:value={prefs.deployHookURL}
        flex
        aria-label={_('prefs.advanced.deploy_hook.url.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: _(
              prefs.deployHookURL
                ? 'prefs.advanced.deploy_hook.url.saved'
                : 'prefs.advanced.deploy_hook.url.removed',
            ),
          });
        }}
      />
    </div>
    <div role="none">
      <TextInput
        dir="ltr"
        bind:value={prefs.deployHookAuthHeader}
        flex
        aria-label={_('prefs.advanced.deploy_hook.auth.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: _(
              prefs.deployHookAuthHeader
                ? 'prefs.advanced.deploy_hook.auth.saved'
                : 'prefs.advanced.deploy_hook.auth.removed',
            ),
          });
        }}
      />
    </div>
  </section>
{/if}
<section>
  <h3>
    {_('prefs.advanced.clear_data.title')}
  </h3>
  <p>
    {_('prefs.advanced.clear_data.file_cache.description')}
  </p>
  <div role="none">
    <Button
      variant="tertiary"
      label={_('prefs.advanced.clear_data.file_cache.button_label')}
      onclick={() => {
        showClearCacheDialog = true;
      }}
    />
  </div>
  <p>
    {_('prefs.advanced.clear_data.all_data.description')}
  </p>
  <div role="none">
    <Button
      variant="tertiary"
      label={_('prefs.advanced.clear_data.all_data.button_label')}
      onclick={() => {
        showEraseDataDialog = true;
      }}
    />
  </div>
</section>

<ConfirmationDialog
  bind:open={showClearCacheDialog}
  title={_('prefs.advanced.clear_data.file_cache.button_label')}
  okLabel={_('prefs.advanced.clear_data.file_cache.button_label')}
  onOk={async () => {
    await clearFileCache();
    window.location.reload();
  }}
>
  {_('prefs.advanced.clear_data.file_cache.confirmation')}
</ConfirmationDialog>

<ConfirmationDialog
  bind:open={showEraseDataDialog}
  title={_('prefs.advanced.clear_data.all_data.button_label')}
  okLabel={_('prefs.advanced.clear_data.all_data.button_label')}
  onOk={async () => {
    await eraseAllData();
    window.location.reload();
  }}
>
  {_('prefs.advanced.clear_data.all_data.confirmation')}
</ConfirmationDialog>
