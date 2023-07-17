<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { get } from 'svelte/store';
  // @ts-ignore
  import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
  import SignIn from '$lib/components/entrance/sign-in.svelte';
  import { user } from '$lib/services/auth';
  import { backend } from '$lib/services/backends';
  import { fetchSiteConfig, siteConfig } from '$lib/services/config';
  import { entriesLoaded } from '$lib/services/contents';
  import { prefs } from '$lib/services/prefs';

  onMount(() => {
    fetchSiteConfig();
  });

  $: {
    if ($siteConfig && !$siteConfig.error && $prefs && !$prefs.error && $user) {
      (async () => {
        await get(backend).fetchFiles();
        $entriesLoaded = true;
      })();
    }
  }
</script>

<div class="container">
  <div>
    <img
      loading="lazy"
      src={$siteConfig?.logo_url || `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`}
      alt=""
      class="logo"
    />
    <h1>Sveltia CMS</h1>
    {#if !$siteConfig}
      <h2>{$_('loading_site_config')}</h2>
    {:else if $siteConfig.error}
      <h2>
        {$siteConfig.error}
        {$_('config.error.try_again')}
      </h2>
    {:else if $prefs?.error}
      <h2>
        {$_(`prefs.error.${$prefs.error}`)}
      </h2>
    {:else if !$user}
      <SignIn />
    {:else if !$entriesLoaded}
      <h2>{$_('loading_site_data')}</h2>
    {/if}
  </div>
</div>

<style lang="scss">
  .container {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;

    div {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      min-width: 240px;
      height: 240px;
    }

    .logo {
      max-width: 160px;
      height: auto;
    }

    h1 {
      font-size: 48px;
    }

    .logo ~ h1 {
      font-size: var(--sui-font-size-xxx-large);
    }

    :global(h2) {
      margin: 0 0 16px;
      font-size: var(--sui-font-size-large);
      font-weight: normal;
    }
  }
</style>
