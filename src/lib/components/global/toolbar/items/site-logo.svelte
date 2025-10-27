<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { openProductionSite } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';

  const src = $derived($siteConfig?.logo?.src ?? $siteConfig?.logo_url);
  const showInHeader = $derived($siteConfig?.logo?.show_in_header ?? true);
</script>

{#if src && showInHeader}
  <Button
    variant="ghost"
    iconic
    aria-label={$_('visit_live_site')}
    onclick={() => {
      openProductionSite();
    }}
  >
    <img loading="lazy" {src} alt="" class="logo" />
  </Button>
{/if}

<style lang="scss">
  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
</style>
