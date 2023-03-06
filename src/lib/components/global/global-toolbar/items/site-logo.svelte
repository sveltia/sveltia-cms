<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { openProductionSite } from '$lib/services/navigation';
</script>

{#if $siteConfig?.logo_url}
  <Button
    class="ternary iconic"
    aria-label={$_('live_site')}
    on:click={() => {
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
