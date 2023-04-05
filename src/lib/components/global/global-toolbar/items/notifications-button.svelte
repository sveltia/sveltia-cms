<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
</script>

<Button
  class="ternary iconic"
  hidden={true}
  on:click={() => {
    // @todo Implement this!
  }}
>
  <Icon slot="start-icon" name="notifications" label={$_('notifications')} />
</Button>
