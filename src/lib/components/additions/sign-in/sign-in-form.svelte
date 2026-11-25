<!--
  @component
  The Sveltia CMS Additions part of the sign-in page: a username and password, or GitHub if the
  service offers it, and a new password in place of a temporary one.
-->
<script module>
  /**
   * What has been typed in the form. It’s kept here rather than in the component, which the page
   * replaces with a message while signing in, so a sign-in that fails, e.g. with a mistyped
   * password, comes back to what was typed, including what a magic link filled in.
   */
  const form = $state({
    username: '',
    password: '',
    /** Username filled in from a magic link, to say where it came from. */
    linkedUsername: '',
  });

  /** Whether a sign-in with the password is in progress, during which the form is kept. */
  let passwordSignInPending = false;
</script>

<script>
  import { _ } from '@sveltia/i18n';
  import { Button, PasswordInput, TextInput } from '@sveltia/ui';

  import NewPasswordFields from '$lib/components/additions/users/new-password-fields.svelte';
  import {
    additionsAuth,
    cancelPasswordChange,
    getNewPasswordError,
  } from '$lib/services/additions/auth.svelte';
  import {
    additionsSetup,
    getSetupResultMessage,
    openSetup,
  } from '$lib/services/additions/setup.svelte';
  import { auth, signInManually, signInWithNewPassword } from '$lib/services/user/auth.svelte';

  /**
   * @typedef {object} Props
   * @property {string} backendName Name of the configured backend.
   * @property {boolean} primary Whether signing in with a password is the main option on the page,
   * which it isn’t when a local repository can be used instead.
   */

  /** @type {Props} */
  let { backendName, primary } = $props();

  let newPassword = $state('');
  let changingPassword = $state(false);
  /**
   * Fields the browser has filled in, e.g. from its password manager. Chrome doesn’t let the page
   * read their values until the user interacts with it, so they look empty until then.
   * @type {{ username: boolean, password: boolean }}
   */
  const autofilled = $state({ username: false, password: false });

  // Kept only for a sign-in with the password, which replaces the form while it’s in progress. A
  // sign-in done otherwise, e.g. with GitHub, leaves nothing for whoever signs in next
  if (!passwordSignInPending) {
    Object.assign(form, { username: '', password: '', linkedUsername: '' });
  }

  const trimmedUsername = $derived(form.username.trim());
  const canSignIn = $derived(
    (!!trimmedUsername || autofilled.username) && (!!form.password || autofilled.password),
  );

  /**
   * Get the name of a field of the form, which only has the username and password.
   * @param {EventTarget | null} target Event target.
   * @returns {'username' | 'password'} Name.
   */
  const getFieldName = (target) =>
    /** @type {'username' | 'password'} */ (/** @type {HTMLInputElement} */ (target).name);

  /**
   * Note a field the browser has filled in, which starts an animation in the styles below.
   * @param {AnimationEvent} event `animationstart` event.
   */
  const onAnimationStart = ({ target, animationName }) => {
    if (animationName === 'cms-autofill') {
      autofilled[getFieldName(target)] = true;
    }
  };

  /**
   * Forget that a field was filled in by the browser once the user edits it, which makes its value
   * known. The browser may also fire the event when filling it in, which leaves it marked.
   * @param {Event} event `input` event.
   */
  const onInput = ({ target }) => {
    autofilled[getFieldName(target)] = /** @type {HTMLInputElement} */ (target).matches(
      ':-webkit-autofill',
    );
  };

  // Fill in the username and temporary password from a magic link emailed to the user, whenever
  // the link is read, then forget them
  $effect(() => {
    const credentials = auth.emailedSignIn;

    if (credentials) {
      Object.assign(form, { ...credentials, linkedUsername: credentials.username });
      auth.emailedSignIn = undefined;
    }
  });
  const newPasswordError = $derived(getNewPasswordError(newPassword));
  const newPasswordReady = $derived(!!newPassword && !newPasswordError);
  /**
   * Sign in to Sveltia CMS Additions with the username and password. The form can’t be submitted
   * until both are filled in, as the submit button is disabled until then.
   * @param {SubmitEvent} event `submit` event.
   */
  const signInWithPassword = async (event) => {
    event.preventDefault();

    // Read the fields, as values filled in by the browser may not have reached the form state yet
    const data = new FormData(/** @type {HTMLFormElement} */ (event.currentTarget));

    form.username = /** @type {string} */ (data.get('username'));
    form.password = /** @type {string} */ (data.get('password'));

    if (!trimmedUsername || !form.password) {
      return;
    }

    passwordSignInPending = true;

    try {
      await signInManually(backendName, undefined, {
        username: trimmedUsername,
        password: form.password,
      });
    } finally {
      passwordSignInPending = false;
    }

    // Forgotten once signed in, or asked to choose a new password, so they aren’t there for
    // whoever signs in next
    if (!auth.signInError.message) {
      Object.assign(form, { username: '', password: '', linkedUsername: '' });
    }
  };

  /**
   * Replace a temporary password with the new one, then finish signing in with the new session.
   * The form can’t be submitted until the new password is valid, as the submit button is disabled
   * until then.
   * @param {SubmitEvent} event `submit` event.
   */
  const changePassword = async (event) => {
    event.preventDefault();
    changingPassword = true;

    if (await signInWithNewPassword(backendName, newPassword)) {
      newPassword = '';
    }

    changingPassword = false;
  };
</script>

{#if additionsAuth.passwordChange}
  <form class="additions" onsubmit={changePassword}>
    <h2>{_('additions.new_password_title')}</h2>
    <p>{_('additions.new_password_description')}</p>
    <NewPasswordFields bind:newPassword passwordError={newPasswordError} />
    <Button
      type="submit"
      variant="primary"
      label={_('additions.change_password')}
      disabled={!newPasswordReady || changingPassword}
    />
    <!-- E.g. for an account that isn’t the user’s, signed in with a link someone else got -->
    <Button
      variant="tertiary"
      label={_('cancel')}
      disabled={changingPassword}
      onclick={() => {
        newPassword = '';
        cancelPasswordChange();
      }}
    />
  </form>
{:else}
  <form
    class="additions"
    onsubmit={signInWithPassword}
    onanimationstart={onAnimationStart}
    oninput={onInput}
  >
    <TextInput
      bind:value={form.username}
      name="username"
      ariaLabel={_('additions.username')}
      showLabelAbove
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
    />
    <PasswordInput
      bind:value={form.password}
      name="password"
      ariaLabel={_('additions.password')}
      showLabelAbove
      autocomplete="current-password"
    />
    <!--
      Anyone can make such a link, e.g. for an account of their own, so the user is told to check
      it’s theirs before signing in
    -->
    {#if form.linkedUsername && trimmedUsername === form.linkedUsername}
      <p role="status" class="note">
        {_('additions.filled_from_link', { values: { username: form.linkedUsername } })}
      </p>
    {/if}
    <Button
      type="submit"
      variant={primary ? 'primary' : 'secondary'}
      label={_('additions.sign_in')}
      disabled={!canSignIn}
    />
    {#if additionsSetup.result}
      <div
        role={additionsSetup.result === 'ok' ? 'status' : 'alert'}
        class:error={additionsSetup.result !== 'ok'}
      >
        {getSetupResultMessage(additionsSetup.result)}
      </div>
    {/if}
    <Button variant="tertiary" label={_('additions.setup.use_admin_secret')} onclick={openSetup} />
  </form>
  {#if additionsAuth.signInMethods.includes('github')}
    <Button
      variant="secondary"
      label={_('sign_in_with_x', { values: { service: 'GitHub' } })}
      onclick={async () => {
        await signInManually(backendName, undefined, { provider: 'github' });
      }}
    />
  {/if}
{/if}

<style>
  .additions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 320px;

    h2 {
      margin: 0;
      font-size: var(--sui-font-size-x-large);
    }

    p {
      margin: 0;
      text-align: center;
    }

    & > :global(.text-input),
    & > :global(.password-input),
    & > :global(.button) {
      width: 100%;
    }

    /* Tells the page a field was filled in, as Chrome hides the value until the user interacts */
    :global(input:-webkit-autofill) {
      animation: cms-autofill 1ms;
    }

    .note {
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
    }
  }

  @keyframes -global-cms-autofill {
    from {
      opacity: 1;
    }
  }
</style>
