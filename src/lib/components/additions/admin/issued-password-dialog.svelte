<!--
  @component
  The dialog showing a temporary password once, after a user has been added or their password
  reset, with the username to give along with it, a copy button for each, and a button to email
  them to the user when they have an email address.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { AlertDialog, Button, CopyButton } from '@sveltia/ui';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import { getCredentialsEmailURL } from '$lib/services/additions/user-form';
  import { appTitle } from '$lib/services/app/branding';

  /**
   * @import { IssuedPassword } from '$lib/services/additions/user-form';
   */

  /**
   * @typedef {object} Props
   * @property {IssuedPassword | undefined} issued Password to show, with the user it belongs to.
   * The dialog is open while there is one, and sets it back to `undefined` once closed.
   */

  /** @type {Props} */
  let { issued = $bindable() } = $props();

  /** Whether the clipboard has refused to copy the username or the password. */
  let copyFailed = $state(false);

  /** @type {IssuedPassword} */
  const shown = $derived(
    issued ?? { username: '', name: '', email: '', password: '', reset: false },
  );

  /** The username and the temporary password, each to copy on its own. */
  const credentials = $derived([
    {
      label: _('additions.username'),
      value: shown.username,
      copyLabel: _('additions.users.copy_username'),
    },
    {
      label: _('additions.password'),
      value: shown.password,
      copyLabel: _('additions.users.copy_password'),
    },
  ]);

  /**
   * Open the admin’s email app with a message giving the user their sign-in details. The sign-in
   * link is this page without the route, which opens the sign-in form.
   */
  const emailCredentials = () => {
    window.open(
      getCredentialsEmailURL({
        ...shown,
        appName: appTitle.current,
        signInURL: `${window.location.origin}${window.location.pathname}`,
      }),
      '_self',
    );
  };
</script>

<AlertDialog
  open={!!issued}
  title={_('additions.users.temporary_password')}
  onClose={() => {
    issued = undefined;
    copyFailed = false;
  }}
>
  <p>
    {_('additions.users.temporary_password_description', { values: { name: shown.name } })}
  </p>
  <dl class="credentials">
    {#each credentials as { label, value, copyLabel } (label)}
      <div role="none">
        <dt>{label}</dt>
        <dd>
          <code>{value}</code>
          <CopyButton
            text={value}
            ariaLabel={copyLabel}
            onCopy={() => {
              copyFailed = false;
            }}
            onError={() => {
              copyFailed = true;
            }}
          />
        </dd>
      </div>
    {/each}
  </dl>
  <ErrorMessage message={copyFailed ? _('clipboard_error') : ''} />
  {#if shown.email}
    <Button
      variant="secondary"
      label={_('additions.users.email_credentials', { values: { name: shown.name } })}
      onclick={emailCredentials}
    />
  {/if}
</AlertDialog>

<style>
  p {
    margin: 0;
  }

  .credentials {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 4px 12px;
    margin: 12px 0 0;

    /* The rows and their values share the list’s columns, without losing the list semantics
       that `display: contents` can drop */

    div {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      align-items: center;
    }

    dt {
      color: var(--sui-secondary-foreground-color);
    }

    dd {
      display: grid;
      grid-column: 2 / -1;
      grid-template-columns: subgrid;
      align-items: center;
      margin: 0;
    }

    code {
      font-size: var(--sui-font-size-large);
      user-select: all;
    }
  }
</style>
