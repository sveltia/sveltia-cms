<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, TextInput } from '@sveltia/ui';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';
  import { backendName } from '$lib/services/backends';
  import { getLocalGitStatusLabel } from '$lib/services/backends/fs/git/messages';
  import { checkLocalGitStatus } from '$lib/services/backends/fs/local';
  import { skipCIConfigured } from '$lib/services/backends/git/shared/integration';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @import { LocalGitStatus, SettingsPanelOnChangeArgs } from '$lib/types/private';
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

  /**
   * Check whether the saved changes can be committed to the local Git repository. The Settings are
   * only shown once the user has signed in, so the status is always known.
   * @returns {Promise<LocalGitStatus>} Status.
   */
  const getLocalGitStatus = async () => /** @type {LocalGitStatus} */ (await checkLocalGitStatus());
</script>

<section>
  <h3>
    {_('prefs.developer.developer_mode.title')}
  </h3>
  <p>
    {_('prefs.developer.developer_mode.description')}
  </p>
  <div role="none">
    <PrefSwitch
      key="devModeEnabled"
      label={_('prefs.developer.developer_mode.switch_label')}
      defaultValue={false}
    />
  </div>
</section>
{#if backendName.current === 'local'}
  <section>
    <h3>
      {_('prefs.developer.local_git.title')}
    </h3>
    <p>
      {_('prefs.developer.local_git.description')}
    </p>
    <div role="none">
      <PrefSwitch
        key="localGitCommits"
        label={_('prefs.developer.local_git.switch_label')}
        defaultValue={false}
      />
    </div>
    {#if prefs.localGitCommits}
      <div role="none">
        {#await getLocalGitStatus()}
          <p>{_('prefs.developer.local_git.checking')}</p>
        {:then status}
          <Alert status={status.ready ? 'success' : 'warning'}>
            {getLocalGitStatusLabel(status)}
          </Alert>
        {/await}
      </div>
    {/if}
  </section>
{/if}
{#if skipCIConfigured.current}
  <section>
    <h3>
      {_('prefs.developer.deploy_hook.title')}
    </h3>
    <p>
      {_('prefs.developer.deploy_hook.description')}
    </p>
    <div role="none">
      <TextInput
        dir="ltr"
        bind:value={prefs.deployHookURL}
        flex
        ariaLabel={_('prefs.developer.deploy_hook.url.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: _(
              prefs.deployHookURL
                ? 'prefs.developer.deploy_hook.url.saved'
                : 'prefs.developer.deploy_hook.url.removed',
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
        ariaLabel={_('prefs.developer.deploy_hook.auth.field_label')}
        showInlineLabel={true}
        onchange={() => {
          onChange?.({
            message: _(
              prefs.deployHookAuthHeader
                ? 'prefs.developer.deploy_hook.auth.saved'
                : 'prefs.developer.deploy_hook.auth.removed',
            ),
          });
        }}
      />
    </div>
  </section>
{/if}
