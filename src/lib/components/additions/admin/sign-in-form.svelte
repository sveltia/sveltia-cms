<!--
  @component
  Sign-in settings of Sveltia CMS Additions: signing in with GitHub, and the sign-up rules that let
  members of a GitHub organization in without an account.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Option, Select, Switch, TextInput } from '@sveltia/ui';

  import { saveSignInSettings } from '$lib/services/additions/site-settings';
  import { isGitHubOnly, SIGN_UP_ROLES } from '$lib/services/additions/user-form';
  import { additionsUsers } from '$lib/services/additions/users.svelte';

  /**
   * @import { TaskRunner } from '$lib/services/additions/task.svelte';
   * @import { SignUpRule } from '$lib/services/additions/users.svelte';
   */

  /**
   * @typedef {object} Props
   * @property {TaskRunner} runner Runner of the section’s requests, which shows the error they end
   * with.
   */

  /** @type {Props} */
  let { runner } = $props();

  // Edited here, then saved together
  let github = $state(additionsUsers.signInMethods.github);
  /** @type {SignUpRule[]} */
  let rules = $state(structuredClone($state.snapshot(additionsUsers.signUpRules)));

  /**
   * Number of active users who could no longer sign in once signing in with GitHub is turned off,
   * as they have no password.
   */
  const lockedOutCount = $derived(
    !github && additionsUsers.signInMethods.github
      ? additionsUsers.users.filter((target) => !target.disabled && isGitHubOnly(target)).length
      : 0,
  );
</script>

<div role="none" class="sign-in">
  <Switch
    bind:checked={github}
    label={_('additions.users.sign_in.github')}
    onChange={runner.clearDone}
  />
  <p>{_('additions.users.sign_in.github_description')}</p>
  {#if lockedOutCount}
    <p role="alert" class="warning">
      {_('additions.users.sign_in.github_only_warning', { values: { count: lockedOutCount } })}
    </p>
  {/if}
  <h3>{_('additions.users.sign_in.rules')}</h3>
  <p>{_('additions.users.sign_in.rules_description')}</p>
  {#each rules as rule, index (index)}
    {@const org = rule.org.trim()}
    <div role="group" class="rule" aria-label={org || _('additions.users.sign_in.org')}>
      <TextInput
        bind:value={rule.org}
        ariaLabel={_('additions.users.sign_in.org')}
        showLabelAbove
        autocapitalize="none"
        spellcheck="false"
        oninput={runner.clearDone}
      />
      <Select
        ariaLabel={_('additions.users.role')}
        showLabelAbove
        value={rule.role}
        onChange={(event) => {
          rule.role = event.detail.value;
          runner.clearDone();
        }}
      >
        {#each SIGN_UP_ROLES as role (role)}
          <Option
            value={role}
            label={_(`additions.users.roles.${role}`)}
            selected={role === rule.role}
          />
        {/each}
      </Select>
      <Button
        variant="tertiary"
        label={org
          ? _('additions.users.sign_in.remove_rule', { values: { org } })
          : _('additions.users.sign_in.remove_empty_rule')}
        onclick={() => {
          rules.splice(index, 1);
          runner.clearDone();
        }}
      />
    </div>
  {/each}
  <Button
    variant="tertiary"
    label={_('additions.users.sign_in.add_rule')}
    onclick={() => {
      rules.push({ type: 'github_org', org: '', role: 'viewer' });
      runner.clearDone();
    }}
  />
  {#if runner.doneMessageKey}
    <div role="status">{_(runner.doneMessageKey)}</div>
  {/if}
  <Button
    variant="secondary"
    label={_('additions.users.sign_in.save')}
    disabled={runner.busy}
    onclick={() =>
      runner.run(
        async () => {
          await saveSignInSettings({
            signInMethods: { github },
            signUpRules: rules.map(({ org, ...rest }) => ({ ...rest, org: org.trim() })),
          });
          rules = structuredClone($state.snapshot(additionsUsers.signUpRules));
        },
        { doneMessageKey: 'additions.users.sign_in.saved' },
      )}
  />
</div>

<style>
  .sign-in {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 960px;

    & > :global(.button) {
      align-self: flex-start;
    }
  }

  h3,
  p {
    margin: 0;
  }

  .warning {
    color: var(--sui-warning-foreground-color);
  }

  h3 {
    margin-top: 12px;
    font-size: var(--sui-font-size-large);
  }

  .rule {
    display: flex;
    flex-wrap: wrap;
    /* The Remove button lines up with the fields, below their labels */
    align-items: end;
    gap: 8px;
  }
</style>
