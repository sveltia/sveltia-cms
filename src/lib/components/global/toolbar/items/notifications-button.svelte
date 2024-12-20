<svelte:options runes={true} />

<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
</script>

<Button
  variant="ghost"
  iconic
  hidden
  aria-label={$_('show_notifications')}
  onclick={() => {
    // @todo Implement this!
  }}
>
  {#snippet startIcon()}
    <Icon name="notifications" />
  {/snippet}
</Button>
