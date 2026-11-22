<!--
  @component
  The Account settings panel of a Sveltia CMS Additions user: their name, which also sets the
  author of their commits, and their password. The email is shown, but only an admin can change it,
  as it could make commits appear to be someone else’s.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, TextInput } from '@sveltia/ui';

  import ChangePasswordForm from '$lib/components/additions/users/change-password-form.svelte';
  import { changeName } from '$lib/services/additions/auth.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { user } from '$lib/services/user/account.svelte';

  /**
   * @import { SettingsPanelOnChangeArgs, User } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(args: SettingsPanelOnChangeArgs) => void} [onChange] Function called to report
   * what has happened, shown in a toast.
   */

  /** @type {Props} */
  let { onChange = undefined } = $props();

  const id = $props.id();

  // The panel is only offered while signed in
  const account = $derived(/** @type {User} */ (user.account));

  const runner = new TaskRunner();

  let name = $state(/** @type {User} */ (user.account).name ?? '');

  const ready = $derived(!!name.trim() && name.trim() !== account.name);

  /**
   * Save the name.
   * @param {SubmitEvent} event `submit` event.
   */
  const save = async (event) => {
    event.preventDefault();
    await runner.run(() => changeName(name.trim()));
    // Reported in a toast, like the other settings
    onChange?.(
      runner.error
        ? { message: runner.error, status: 'error' }
        : { message: _('additions.account.name_changed') },
    );
  };
</script>

<section aria-labelledby="{id}-profile">
  <h3 id="{id}-profile">{_('additions.account.profile')}</h3>
  <p>{_('additions.account.profile_description')}</p>
  <form class="form" onsubmit={save}>
    <TextInput
      value={account.login}
      readonly
      ariaLabel={_('additions.username')}
      showLabelAbove
      aria-describedby="{id}-username"
    />
    <p id="{id}-username" class="note">{_('additions.account.username_description')}</p>
    <TextInput
      value={account.email ?? ''}
      readonly
      ariaLabel={_('additions.account.email')}
      showLabelAbove
      aria-describedby="{id}-email"
    />
    <p id="{id}-email" class="note">{_('additions.account.email_description')}</p>
    <TextInput bind:value={name} ariaLabel={_('additions.users.name')} showLabelAbove />
    <Button
      type="submit"
      variant="secondary"
      label={_('additions.account.change_name')}
      disabled={!ready || runner.busy}
    />
  </form>
</section>
<section aria-labelledby="{id}-password">
  <h3 id="{id}-password">{_('additions.account.password')}</h3>
  {#if account.hasPassword === false}
    <!-- Someone who only signs in with GitHub has no password to change -->
    <p>{_('additions.account.no_password')}</p>
  {:else}
    <p>{_('additions.change_password_description')}</p>
    <ChangePasswordForm
      onChanged={() => {
        onChange?.({ message: _('additions.password_changed') });
      }}
    />
  {/if}
</section>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 480px;

    & > :global(.button) {
      align-self: flex-start;
    }

    /* Close to the field it explains, and lined up with its edge; nested to beat the container’s */
    & .note {
      margin: -8px var(--sui-focus-ring-width) 0;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
    }
  }
</style>
