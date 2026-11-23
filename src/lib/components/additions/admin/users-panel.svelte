<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, Dialog, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import IssuedPasswordDialog from '$lib/components/additions/admin/issued-password-dialog.svelte';
  import UserFields from '$lib/components/additions/admin/user-fields.svelte';
  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import MainArea from '$lib/components/admin/main-area.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import {
    canSaveUserChanges,
    getEmptyUserFormValues,
    getNewUser,
    getSignInMethodsLabel,
    getUserChanges,
    getUserFormValues,
    getUserStatus,
    isGitHubOnly,
    isNewUserReady,
  } from '$lib/services/additions/user-form';
  import {
    additionsUsers,
    createUser,
    deleteUser,
    loadUsers,
    resetPassword,
    signOutUser,
    updateUser,
  } from '$lib/services/additions/users.svelte';
  import { getAdminLink } from '$lib/services/app/admin';
  import { goto } from '$lib/services/app/navigation';
  import { user } from '$lib/services/user/account.svelte';
  import { formatDate } from '$lib/services/utils/date';

  /**
   * @import { IssuedPassword } from '$lib/services/additions/user-form';
   * @import { AdditionsUser } from '$lib/services/additions/users.svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();

  const runner = new TaskRunner();
  const { run } = runner;
  /**
   * Runs the saves of the Add User and Edit User dialogs, which stay open with what was entered if
   * the service refuses it, and show why.
   */
  const dialogRunner = new TaskRunner();

  let showAddDialog = $state(false);
  let newUser = $state(getEmptyUserFormValues());
  let showEditDialog = $state(false);
  /**
   * User being edited, kept after the dialog closes, so its text doesn’t change while it fades out.
   * @type {AdditionsUser | undefined}
   */
  let editTarget = $state();
  let editValues = $state(getEmptyUserFormValues());
  /**
   * Temporary password to show once, with the user it belongs to.
   * @type {IssuedPassword | undefined}
   */
  let issued = $state();
  /**
   * Temporary password of a user just added, shown once the Add User dialog has closed.
   * @type {IssuedPassword | undefined}
   */
  let added;
  /** @type {{ action: 'reset' | 'delete', target: AdditionsUser } | undefined} */
  let confirmation = $state();

  const newUserReady = $derived(isNewUserReady(newUser));
  // The GitHub username is offered while signing in with GitHub is on, or to remove the one a user
  // already has
  const editShowsGitHub = $derived(additionsUsers.signInMethods.github || !!editTarget?.github);
  // Only read once a user is being edited, after the name check below
  const editChanges = $derived(
    getUserChanges(/** @type {AdditionsUser} */ (editTarget), editValues, {
      includeGitHub: editShowsGitHub,
    }),
  );
  const editReady = $derived(
    !!editTarget && canSaveUserChanges(editTarget, editValues, editChanges),
  );
  /* v8 ignore start -- the message is only read while the dialog is open, when there is one */
  const confirmationMessage = $derived(
    confirmation
      ? _(
          confirmation.action === 'delete'
            ? 'additions.users.delete_confirmation'
            : 'additions.users.reset_password_confirmation',
          { values: { name: confirmation.target.name } },
        )
      : '',
  );
  /* v8 ignore stop */

  /**
   * Get a temporary password to show once, with the username to give along with it.
   * @param {{ username: string, name: string, email: string | null }} target User.
   * @param {string} password Password.
   * @param {object} [options] Options.
   * @param {boolean} [options.reset] Whether the password has been reset, rather than the user
   * added, which the email to them says.
   * @returns {IssuedPassword} Password and the user it belongs to.
   */
  const getIssuedPassword = ({ username, name, email }, password, { reset = false } = {}) => ({
    username,
    name,
    email: email ?? '',
    password,
    reset,
  });

  /**
   * Run the save of a dialog, keeping the dialog open if it fails.
   * @param {() => Promise<void>} task Task.
   * @returns {Promise<boolean>} Whether the save worked, so the dialog can close.
   */
  const saveFromDialog = async (task) => {
    await dialogRunner.run(task);

    return !dialogRunner.error;
  };

  onMount(() => {
    run(loadUsers);
  });
</script>

<MainArea {title}>
  {#snippet actions()}
    <Button
      variant="primary"
      label={_('additions.users.add_user')}
      disabled={!additionsUsers.loaded}
      onclick={() => {
        newUser = getEmptyUserFormValues();
        dialogRunner.error = '';
        showAddDialog = true;
      }}
    />
  {/snippet}
  <ErrorMessage message={runner.error} />
  <table aria-label={title}>
    <thead>
      <tr>
        <th scope="col">{_('additions.username')}</th>
        <th scope="col">{_('additions.users.name')}</th>
        <th scope="col">{_('additions.users.role')}</th>
        <th scope="col">{_('additions.users.sign_in_column')}</th>
        <th scope="col">{_('additions.users.status')}</th>
        <th scope="col">{_('additions.users.last_sign_in')}</th>
        <th scope="col"><span class="hidden">{_('additions.users.actions')}</span></th>
      </tr>
    </thead>
    <tbody>
      {#each additionsUsers.users as target (target.id)}
        {@const isSelf = target.username === user.account?.login}
        <tr>
          <td class="username">{target.username}</td>
          <td class="name">
            {target.name}
            {#if isSelf}
              <span class="self">{_('additions.users.you')}</span>
            {/if}
          </td>
          <td class="detail">{_(`additions.users.roles.${target.role}`)}</td>
          <td class="detail">{getSignInMethodsLabel(target)}</td>
          <td class="detail">{_(`additions.users.statuses.${getUserStatus(target)}`)}</td>
          <td class="detail" data-label={_('additions.users.last_sign_in')}>
            {target.last_sign_in_at
              ? formatDate(new Date(target.last_sign_in_at), appLocale.current)
              : _('additions.users.never')}
          </td>
          <td class="actions">
            <MenuButton
              variant="ghost"
              iconic
              popupPosition="bottom-right"
              aria-label={_('additions.users.show_options_for_x', {
                values: { name: target.name },
              })}
            >
              {#snippet popup()}
                <Menu ariaLabel={_('additions.users.options')}>
                  <MenuItem
                    label={_('additions.users.edit_user')}
                    onclick={() => {
                      editTarget = target;
                      editValues = getUserFormValues(target);
                      dialogRunner.error = '';
                      showEditDialog = true;
                    }}
                  />
                  <!-- Your own password is changed in the Account settings panel, and your
                       own sessions end with Sign Out -->
                  <MenuItem
                    label={_('additions.users.reset_password')}
                    disabled={isSelf}
                    onclick={() => {
                      confirmation = { action: 'reset', target };
                    }}
                  />
                  <MenuItem
                    label={_('additions.users.sign_out_everywhere')}
                    disabled={isSelf}
                    onclick={() => run(() => signOutUser(target.id))}
                  />
                  <MenuItem
                    label={target.disabled
                      ? _('additions.users.enable')
                      : _('additions.users.disable')}
                    disabled={isSelf}
                    onclick={() => run(() => updateUser(target.id, { disabled: !target.disabled }))}
                  />
                  {#if target.sign_up_rule}
                    <!-- No longer checked against the sign-up rule that created it -->
                    <MenuItem
                      label={_('additions.users.adopt')}
                      onclick={() => run(() => updateUser(target.id, { adopted: true }))}
                    />
                  {/if}
                  <MenuItem
                    label={_('additions.users.delete')}
                    disabled={isSelf}
                    onclick={() => {
                      confirmation = { action: 'delete', target };
                    }}
                  />
                </Menu>
              {/snippet}
            </MenuButton>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</MainArea>

<Dialog
  bind:open={showAddDialog}
  title={_('additions.users.add_user')}
  okLabel={_('additions.users.add')}
  okDisabled={!newUserReady}
  cancelDisabled={dialogRunner.busy}
  onBeforeOk={() =>
    saveFromDialog(async () => {
      const details = getNewUser(newUser);
      const password = await createUser(details);

      // Someone who signs in with GitHub has no password to pass on
      if (password) {
        // The password is never shown again, so it’s shown even if the dialog has been closed
        // with Escape in the meantime
        if (showAddDialog) {
          added = getIssuedPassword(details, password);
        } else {
          issued = getIssuedPassword(details, password);
        }
      }
    })}
  onClose={() => {
    issued = added ?? issued;
    added = undefined;
  }}
>
  <div role="none" class="form">
    <ErrorMessage message={dialogRunner.error} />
    <UserFields
      bind:username={newUser.username}
      bind:name={newUser.name}
      bind:email={newUser.email}
      bind:role={newUser.role}
      bind:github={newUser.github}
      showGitHub={additionsUsers.signInMethods.github}
    />
  </div>
</Dialog>

<Dialog
  bind:open={showEditDialog}
  title={_('additions.users.edit_user')}
  okLabel={_('save')}
  okDisabled={!editReady}
  cancelDisabled={dialogRunner.busy}
  onBeforeOk={() => {
    // The dialog is only opened with a user to edit
    const { id } = /** @type {AdditionsUser} */ (editTarget);

    return saveFromDialog(async () => {
      await updateUser(id, editChanges);

      // An admin who has given up the role can no longer see the users: leave for what they still
      // can see, rather than a section that can’t be found any more
      if (user.account?.role !== 'admin') {
        goto(getAdminLink() ?? '/collections', { replaceState: true });
      }
    });
  }}
>
  <div role="none" class="form">
    <ErrorMessage message={dialogRunner.error} />
    <UserFields
      username={editValues.username}
      bind:name={editValues.name}
      bind:email={editValues.email}
      bind:role={editValues.role}
      bind:github={editValues.github}
      editing
      showGitHub={editShowsGitHub}
      githubLockedNote={editTarget && isGitHubOnly(editTarget)
        ? _('additions.users.github_required', { values: { name: editTarget.name } })
        : undefined}
    />
  </div>
</Dialog>

<ConfirmationDialog
  open={!!confirmation}
  title={confirmation?.action === 'delete'
    ? _('additions.users.delete')
    : _('additions.users.reset_password')}
  okLabel={confirmation?.action === 'delete'
    ? _('additions.users.delete')
    : _('additions.users.reset_password')}
  onOk={() => {
    const { action, target } = /** @type {NonNullable<typeof confirmation>} */ (confirmation);

    run(async () => {
      if (action === 'delete') {
        await deleteUser(target.id);
      } else {
        issued = getIssuedPassword(target, await resetPassword(target), { reset: true });
      }
    });
  }}
  onClose={() => {
    confirmation = undefined;
  }}
>
  {confirmationMessage}
</ConfirmationDialog>

<IssuedPasswordDialog bind:issued />

<style>
  table {
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid var(--sui-secondary-border-color);
    padding: 8px;
    text-align: start;
    vertical-align: middle;
  }

  .self {
    color: var(--sui-secondary-foreground-color);
  }

  /* On a small screen, each user is an item of a list rather than a row of seven columns: the
     name, the username, then the other details on a line, with the options button beside */
  @media (width < 768px) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    tbody tr {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      border-bottom: 1px solid var(--sui-secondary-border-color);
      padding-block: 12px;
      padding-inline: 0 48px;
    }

    td {
      border: 0;
      padding: 0;
    }

    .name {
      order: -1;
      width: 100%;
      font-weight: var(--sui-font-weight-bold);

      .self {
        font-weight: normal;
      }
    }

    .username {
      width: 100%;
      color: var(--sui-secondary-foreground-color);
    }

    .detail {
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);

      &:empty {
        display: none;
      }

      & + .detail::before {
        content: '·';
        margin-inline: 6px;
      }

      /* The date goes on a line of its own, which says what it is */
      &[data-label] {
        width: 100%;

        &::before {
          content: attr(data-label) ':\00a0';
          margin: 0;
        }
      }
    }

    .actions {
      position: absolute;
      inset-block-start: 8px;
      inset-inline-end: 0;
    }
  }

  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
