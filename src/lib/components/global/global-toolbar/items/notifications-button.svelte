<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
</script>

<Button
  variant="ghost"
  iconic
  hidden
  aria-label={$_('notifications')}
  on:click={() => {
    // @todo Implement this!
  }}
>
  <Icon slot="start-icon" name="notifications" />
</Button>
