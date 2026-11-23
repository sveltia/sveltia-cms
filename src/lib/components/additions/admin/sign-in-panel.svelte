<!--
  @component
  The sign-in settings of Sveltia CMS Additions, once loaded with the other settings.
-->
<script>
  import { onMount } from 'svelte';

  import SignInForm from '$lib/components/additions/admin/sign-in-form.svelte';
  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import MainArea from '$lib/components/admin/main-area.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { additionsUsers, loadUsers } from '$lib/services/additions/users.svelte';

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();

  const runner = new TaskRunner();

  /** Whether the settings have been loaded for this section, or tried to be. */
  let refreshed = $state(false);

  onMount(async () => {
    // Loaded again, as another admin may have changed them since another section loaded them, and
    // saving would put the old ones back. With the users, who are warned about if they can only
    // sign in with GitHub when it’s being turned off
    await runner.run(loadUsers);
    refreshed = true;
  });
</script>

<MainArea {title}>
  <ErrorMessage message={runner.error} />
  <!-- Edited from a copy of the settings, so it waits for the latest ones. If they can’t be loaded,
  those loaded before, if any, can still be edited -->
  {#if refreshed && additionsUsers.loaded}
    <SignInForm {runner} />
  {/if}
</MainArea>
