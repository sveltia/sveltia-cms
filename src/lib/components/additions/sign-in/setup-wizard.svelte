<!--
  @component
  The setup wizard, shown in place of the sign-in form once the admin secret is entered. On a new
  service, it walks through creating the first admin and connecting GitHub, one step at a time; once
  both are done, it’s where an admin’s password is reset and the other sites are managed.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, PasswordInput, TextInput } from '@sveltia/ui';
  import { tick } from 'svelte';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import SitesSection from '$lib/components/additions/sign-in/sites-section.svelte';
  import NewPasswordFields from '$lib/components/additions/users/new-password-fields.svelte';
  import { getNewPasswordError } from '$lib/services/additions/auth.svelte';
  import {
    additionsSetup,
    closeSetup,
    connectGitHub,
    rekeyDataKey,
    rewrapDataKey,
    saveAdmin,
    unlockSetup,
  } from '$lib/services/additions/setup.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { listTenants } from '$lib/services/additions/tenants';
  import { cmsConfig } from '$lib/services/config';

  /**
   * @import { SetupStatus } from '$lib/services/additions/setup.svelte';
   * @import { Tenant } from '$lib/services/additions/tenants';
   * @import { CmsConfig, GitHubBackend } from '$lib/types/public';
   */

  /**
   * Number of steps on a new service: the admin, then GitHub.
   */
  const STEP_COUNT = 2;

  const runner = new TaskRunner();
  const { run } = runner;

  /** @type {HTMLElement | undefined} */
  let section = $state();
  /**
   * What’s shown once unlocked: the steps, which turn into an overview once they’re done, the form
   * to reset an admin’s password, or the other sites.
   * @type {'steps' | 'admin' | 'sites'}
   */
  let view = $state('steps');
  let secret = $state('');
  let previousSecret = $state('');
  let username = $state('');
  let password = $state('');
  let showRekeyDialog = $state(false);
  let adminSaved = $state(false);
  /** Whether the other sites can be managed from this site. */
  let sitesSupported = $state(false);
  /** @type {Tenant[]} */
  let tenants = $state([]);

  const status = $derived(additionsSetup.status);
  // The wizard is only offered with a GitHub backend configured
  const repo = $derived(
    /** @type {GitHubBackend} */ (/** @type {CmsConfig} */ (cmsConfig.current).backend).repo,
  );
  // These are only read once unlocked
  const connected = $derived(
    !!(/** @type {SetupStatus} */ (status).installation) &&
      !!(/** @type {SetupStatus} */ (status).github_app),
  );
  /** Current step on a new service, or `undefined` once both are done. */
  const step = $derived(
    !(/** @type {SetupStatus} */ (status).admins) ? 1 : connected ? undefined : 2,
  );
  const trimmedUsername = $derived(username.trim().toLowerCase());
  const passwordError = $derived(getNewPasswordError(password));
  const adminReady = $derived(!!trimmedUsername && !!password && !passwordError);

  /**
   * Switch to another view, and move the focus to its heading, as the button that opened it is
   * gone. An error shown in the previous view doesn’t apply to the new one, so it’s cleared.
   * @param {'steps' | 'admin' | 'sites'} newView View.
   */
  const showView = async (newView) => {
    runner.error = '';
    view = newView;
    await tick();
    /** @type {HTMLElement} */ (
      /** @type {HTMLElement} */ (section).querySelector('h3[tabindex]')
    ).focus();
  };

  /**
   * Unlock the wizard with the admin secret, and see whether the other sites can be managed here.
   * @param {SubmitEvent} event `submit` event.
   */
  const unlock = async (event) => {
    event.preventDefault();
    await run(async () => {
      await unlockSetup(secret);

      const list = await listTenants();

      if (list) {
        tenants = list;
        sitesSupported = true;
      }
    });
    secret = '';
  };

  /**
   * Create an admin, or reset an admin’s password.
   * @param {SubmitEvent} event `submit` event.
   */
  const submitAdmin = async (event) => {
    event.preventDefault();
    await run(async () => {
      await saveAdmin({ username: trimmedUsername, password });
      adminSaved = true;
      password = '';

      if (view === 'admin') {
        await showView('steps');
      }
    });
  };

  /**
   * Unlock the stored secrets with the previous admin secret.
   * @param {SubmitEvent} event `submit` event.
   */
  const unlockDataKey = async (event) => {
    event.preventDefault();
    await run(() => rewrapDataKey(previousSecret));
    previousSecret = '';
  };
</script>

<!-- The form to create the first admin, or to reset an admin’s password, which only differ in what
they say -->
{#snippet adminForm(/** @type {string} */ descriptionKey, /** @type {string} */ submitLabelKey)}
  <form onsubmit={submitAdmin} aria-labelledby="additions-setup-admin">
    <h3 id="additions-setup-admin" tabindex="-1">{_('additions.setup.admin_title')}</h3>
    <p>{_(descriptionKey)}</p>
    <TextInput
      bind:value={username}
      ariaLabel={_('additions.username')}
      showLabelAbove
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
    />
    <NewPasswordFields bind:newPassword={password} {passwordError} />
    <Button
      type="submit"
      variant="primary"
      label={_(submitLabelKey)}
      disabled={!adminReady || runner.busy}
    />
  </form>
{/snippet}

{#snippet backButton()}
  <Button
    variant="secondary"
    label={_('additions.setup.back_to_setup')}
    disabled={runner.busy}
    onclick={() => showView('steps')}
  />
{/snippet}

<section bind:this={section} class="additions-setup" aria-labelledby="additions-setup-title">
  <h2 id="additions-setup-title">{_('additions.setup.title')}</h2>
  {#if !status}
    <form onsubmit={unlock}>
      <p>{_('additions.setup.secret_description')}</p>
      <PasswordInput
        bind:value={secret}
        ariaLabel={_('additions.setup.admin_secret')}
        showLabelAbove
        autocomplete="off"
      />
      <Button
        type="submit"
        variant="primary"
        label={_('additions.setup.continue')}
        disabled={!secret || runner.busy}
      />
    </form>
  {:else if view === 'sites'}
    <SitesSection bind:tenants />
    {@render backButton()}
  {:else if view === 'admin'}
    {@render adminForm('additions.setup.admin_reset_description', 'additions.setup.reset_password')}
    {@render backButton()}
  {:else if status.data_key === 'locked'}
    <!-- The other steps need the stored secrets, so they wait until the key is unlocked -->
    <form onsubmit={unlockDataKey}>
      <h3 tabindex="-1">{_('additions.setup.data_key_locked_title')}</h3>
      <p>{_('additions.setup.data_key_locked_description')}</p>
      <PasswordInput
        bind:value={previousSecret}
        ariaLabel={_('additions.setup.previous_secret')}
        showLabelAbove
        autocomplete="off"
      />
      <Button
        type="submit"
        variant="primary"
        label={_('additions.setup.unlock')}
        disabled={!previousSecret || runner.busy}
      />
      <Button
        variant="tertiary"
        label={_('additions.setup.rekey')}
        disabled={runner.busy}
        onclick={() => {
          showRekeyDialog = true;
        }}
      />
    </form>
  {:else}
    {#if step}
      <p class="step">
        {_('additions.setup.step_x_of_y', { values: { step, total: STEP_COUNT } })}
      </p>
    {/if}
    {#if !status.admins}
      {@render adminForm(
        'additions.setup.admin_create_description',
        'additions.setup.create_admin',
      )}
    {:else}
      <div role="group" aria-labelledby="additions-setup-admin">
        <h3 id="additions-setup-admin" tabindex="-1">{_('additions.setup.admin_title')}</h3>
        {#if adminSaved}
          <p role="status">{_('additions.setup.admin_saved')}</p>
        {:else}
          <p>{_('additions.setup.admin_exists')}</p>
        {/if}
        <Button
          variant="tertiary"
          label={_('additions.setup.reset_admin_password')}
          disabled={runner.busy}
          onclick={() => showView('admin')}
        />
      </div>
      <div role="group" aria-labelledby="additions-setup-github">
        <h3 id="additions-setup-github">{_('additions.setup.github_title')}</h3>
        {#if status.installation && status.github_app}
          <p>
            {_('additions.setup.github_connected', {
              values: {
                repo: `${status.installation.owner}/${status.installation.name}`,
                app: status.github_app.slug,
              },
            })}
          </p>
        {:else}
          <p>{_('additions.setup.github_description', { values: { repo } })}</p>
          <Button
            variant="primary"
            label={_('additions.setup.connect_github')}
            disabled={runner.busy}
            onclick={() => run(() => connectGitHub({ repo, replace: !!status.github_app }))}
          />
        {/if}
      </div>
      {#if connected}
        <p>{_('additions.setup.setup_complete')}</p>
      {/if}
    {/if}
  {/if}
  <ErrorMessage message={runner.error} />
  {#if !status || view === 'steps'}
    {#if status && sitesSupported}
      <!-- Other sites don’t need this site’s stored secrets, so they can be managed either way -->
      <Button
        variant="secondary"
        label={_('additions.setup.manage_sites')}
        disabled={runner.busy}
        onclick={() => showView('sites')}
      />
    {/if}
    <Button variant="secondary" label={_('additions.setup.back')} onclick={closeSetup} />
  {/if}
</section>

<ConfirmationDialog
  bind:open={showRekeyDialog}
  title={_('additions.setup.rekey')}
  okLabel={_('additions.setup.rekey')}
  onOk={() => run(rekeyDataKey)}
>
  {_('additions.setup.rekey_confirmation')}
</ConfirmationDialog>

<style>
  .additions-setup {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 360px;

    h2,
    h3,
    p {
      margin: 0;
    }

    h2 {
      font-size: var(--sui-font-size-x-large);
      text-align: center;
    }

    h3 {
      font-size: var(--sui-font-size-large);
    }

    .step {
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
      text-align: center;
    }

    form,
    [role='group'] {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    & > :global(.button),
    form > :global(.button),
    form > :global(.text-input),
    form > :global(.password-input),
    [role='group'] > :global(.button) {
      width: 100%;
    }
  }
</style>
