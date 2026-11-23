<!--
  @component
  The fields of the Add User and Edit User dialogs, in the order of the Users table’s columns. The
  username can’t be changed once the user has been created, so it’s read-only when editing.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Option, Select, TextInput } from '@sveltia/ui';

  import { ROLES } from '$lib/services/additions/user-form';

  /**
   * @typedef {object} Props
   * @property {string} username Username, bound to its field.
   * @property {string} name Name, bound to its field.
   * @property {string} email Email, bound to its field.
   * @property {string} role Role, bound to its field.
   * @property {string} github GitHub username, bound to its field.
   * @property {boolean} [editing] Whether an existing user is being edited.
   * @property {boolean} [showGitHub] Whether to show the GitHub username field.
   * @property {string} [githubLockedNote] Note explaining why the GitHub username can’t be removed,
   * shown while it’s empty.
   */

  /** @type {Props} */
  let {
    username = $bindable(),
    name = $bindable(),
    email = $bindable(),
    role = $bindable(),
    github = $bindable(),
    editing = false,
    showGitHub = false,
    githubLockedNote = undefined,
  } = $props();

  const id = $props.id();
  /** Whether the GitHub username has been emptied although it can’t be removed. */
  const githubMissing = $derived(!!githubLockedNote && !github.trim());
</script>

<TextInput
  bind:value={username}
  ariaLabel={_('additions.username')}
  showLabelAbove
  readonly={editing}
  autocapitalize="none"
  spellcheck="false"
  aria-describedby={editing ? `${id}-username` : undefined}
/>
{#if editing}
  <p id="{id}-username" class="note">{_('additions.users.username_description')}</p>
{/if}
<TextInput bind:value={name} ariaLabel={_('additions.users.name')} showLabelAbove />
<TextInput
  bind:value={email}
  ariaLabel={_('additions.users.email_optional')}
  showLabelAbove
  inputmode="email"
  aria-describedby="{id}-email"
/>
<p id="{id}-email" class="note">{_('additions.users.email_description')}</p>
<Select
  ariaLabel={_('additions.users.role')}
  showLabelAbove
  value={role}
  onChange={(event) => {
    role = event.detail.value;
  }}
>
  {#each ROLES as option (option)}
    <Option
      value={option}
      label={_(`additions.users.roles.${option}`)}
      selected={option === role}
    />
  {/each}
</Select>
{#if showGitHub}
  <TextInput
    bind:value={github}
    ariaLabel={_('additions.users.github_username_optional')}
    showLabelAbove
    autocapitalize="none"
    spellcheck="false"
    invalid={githubMissing}
    aria-describedby="{id}-github"
  />
  <p id="{id}-github" class="note">
    {githubMissing ? githubLockedNote : _('additions.users.github_username_description')}
  </p>
{/if}

<style>
  /* Close to the field it explains, rather than a full gap away, and lined up with its edge */
  .note {
    margin: -8px var(--sui-focus-ring-width) 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
