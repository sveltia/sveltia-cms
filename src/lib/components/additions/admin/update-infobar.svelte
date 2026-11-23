<!--
  @component
  A notice that a new release of Sveltia CMS Additions is out. Only an admin is told, as they’re
  the ones who update it, and the check for it is only made for them.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';

  import { RELEASES_URL } from '$lib/services/additions/site-settings';
  import { additionsUsers } from '$lib/services/additions/users.svelte';
  import { openNewTab } from '$lib/services/utils/window';
</script>

{#if additionsUsers.update}
  <Infobar dismissible={false} status="info">
    {_('additions.users.update_available', { values: additionsUsers.update })}
    <Button
      variant="link"
      label={_('additions.users.release_notes')}
      onclick={() => openNewTab(RELEASES_URL)}
    />
  </Infobar>
{/if}
