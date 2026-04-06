<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';
</script>

<Button
  variant="ghost"
  iconic
  hidden
  aria-label={_('show_notifications')}
  onclick={() => {
    // @todo Implement this!
  }}
>
  {#snippet startIcon()}
    <Icon name="notifications" />
  {/snippet}
</Button>
