<script>
  import { AppShell } from '@sveltia/ui';
  import { isLoading } from 'svelte-i18n';
  import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
  import EntrancePage from '$lib/components/entrance/entrance-page.svelte';
  import MainRouter from '$lib/components/global/main-router.svelte';
  import { dataLoaded } from '$lib/services/contents';
  import { initAppLocale } from '$lib/services/i18n';
  import { announcedPageTitle } from '$lib/services/navigation';
  import { user } from '$lib/services/user';

  const { DEV, VITE_SITE_URL } = import.meta.env;
  /**
   * The local live site URL. Local development can be done by loading a CMS config file from a
   * separate dev server. By default, this assumes a local SvelteKit site is running on port 5174
   * along with Sveltia CMS on port 5173. The site URL can be specified with the `VITE_SITE_URL`
   * environment variable. For example, run `VITE_SITE_URL=http://localhost:3000 pnpm dev` for
   * Next.js. You probably need to define the `Access-Control-Allow-Origin: *` HTTP response header
   * with the dev server’s middleware, or loading the CMS config file may fail due to a CORS error.
   */
  const siteURL = DEV ? VITE_SITE_URL || 'http://localhost:5174' : undefined;

  initAppLocale();
</script>

<svelte:head>
  <base target="_blank" />
  <meta name="referrer" content="same-origin" />
  <link rel="icon" href="data:image/svg+xml;base64,{btoa(SveltiaLogo)}" type="image/svg+xml" />
  {#if siteURL}
    <link href="{siteURL}/admin/config.yml" type="text/yaml" rel="cms-config-url" />
  {/if}
</svelte:head>

<AppShell>
  {#if !$isLoading}
    {#if $user && $dataLoaded}
      <MainRouter />
    {:else}
      <EntrancePage />
    {/if}
  {/if}
  <div role="alert">{$announcedPageTitle}</div>
</AppShell>

<style lang="scss">
  [role='alert'] {
    position: absolute;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }
</style>
