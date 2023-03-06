<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
</script>

<Button
  class="ternary iconic"
  iconName="notifications"
  iconLabel={$_('notifications')}
  hidden={true}
  on:click={() => {
    // @todo Implement this!
  }}
/>
