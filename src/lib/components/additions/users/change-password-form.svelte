<!--
  @component
  The form in the Account settings panel where a Sveltia CMS Additions user changes their password.
  The fields are emptied once it’s changed, so no password is kept around.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, PasswordInput } from '@sveltia/ui';

  import NewPasswordFields from '$lib/components/additions/users/new-password-fields.svelte';
  import { changePassword, getNewPasswordError } from '$lib/services/additions/auth.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { user } from '$lib/services/user/account.svelte';

  /**
   * @import { User } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {() => void} [onChanged] Function called once the password has been changed.
   */

  /** @type {Props} */
  let { onChanged = undefined } = $props();

  // The form is only offered while signed in
  const username = $derived(/** @type {string} */ (/** @type {User} */ (user.account).login));

  const runner = new TaskRunner();

  let currentPassword = $state('');
  let newPassword = $state('');

  const passwordError = $derived(getNewPasswordError(newPassword));
  const ready = $derived(!!currentPassword && !!newPassword && !passwordError);

  /**
   * Change the password.
   * @param {SubmitEvent} event `submit` event.
   */
  const submit = async (event) => {
    event.preventDefault();
    await runner.run(async () => {
      await changePassword(currentPassword, newPassword);
      currentPassword = '';
      newPassword = '';
      onChanged?.();
    });
  };
</script>

<form class="form" onsubmit={submit}>
  <!-- Lets a password manager tell which account the new password is for -->
  <input type="text" hidden autocomplete="username" value={username} />
  <PasswordInput
    bind:value={currentPassword}
    ariaLabel={_('additions.current_password')}
    showLabelAbove
    autocomplete="current-password"
  />
  <NewPasswordFields bind:newPassword {passwordError} requestError={runner.error} />
  <Button
    type="submit"
    variant="secondary"
    label={_('additions.change_password')}
    disabled={!ready || runner.busy}
  />
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 480px;

    & > :global(.button) {
      align-self: flex-start;
    }
  }
</style>
