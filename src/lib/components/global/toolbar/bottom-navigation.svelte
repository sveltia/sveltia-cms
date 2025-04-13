<script>
  import { BottomNavigation, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PageSwitcher from '$lib/components/global/toolbar/items/page-switcher.svelte';
  import { hasOverlay } from '$lib/services/app/navigation';
</script>

<BottomNavigation inert={$hasOverlay}>
  <Toolbar variant="primary" aria-label={$_('global')}>
    <div role="none" class="buttons">
      <PageSwitcher />
    </div>
  </Toolbar>
</BottomNavigation>
