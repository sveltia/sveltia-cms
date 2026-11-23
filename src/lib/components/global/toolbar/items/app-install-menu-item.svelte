<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import { installPrompt, promptAppInstall } from '$lib/services/app/install';
</script>

{#if installPrompt.current}
  <MenuItem
    label={_('install_as_app')}
    onclick={async () => {
      await promptAppInstall();
    }}
  />
{/if}
