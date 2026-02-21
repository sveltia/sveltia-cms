<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { appLogoURL } from '$lib/services/app/branding';
  import { openProductionSite } from '$lib/services/app/navigation';
  import { cmsConfig } from '$lib/services/config';
</script>

{#if $appLogoURL && ($cmsConfig?.logo?.show_in_header ?? true)}
  <Button
    variant="ghost"
    iconic
    aria-label={$_('visit_live_site')}
    onclick={() => {
      openProductionSite();
    }}
  >
    <img src={$appLogoURL} alt="" class="logo" />
  </Button>
{/if}

<style lang="scss">
  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
</style>
