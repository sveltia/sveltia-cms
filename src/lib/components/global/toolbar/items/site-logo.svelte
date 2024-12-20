<svelte:options runes={true} />

<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { openProductionSite } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
</script>

{#if $siteConfig?.logo_url}
  <Button
    variant="ghost"
    iconic
    aria-label={$_('visit_live_site')}
    onclick={() => {
      openProductionSite();
    }}
  >
    <img loading="lazy" src={$siteConfig.logo_url} alt="" class="logo" />
  </Button>
{/if}

<style lang="scss">
  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
</style>
