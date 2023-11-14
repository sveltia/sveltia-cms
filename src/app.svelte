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

  initAppLocale();
</script>

<svelte:head>
  <base target="_blank" />
  <meta name="referrer" content="same-origin" />
  <link rel="icon" href="data:image/svg+xml;base64,{btoa(SveltiaLogo)}" type="image/svg+xml" />
  {#if import.meta.env.DEV}
    <!--
      Local development can be done by loading a CMS config file from a separate local dev server.
      By default, this assumes a local SvelteKit site is running on port 5174 along with Sveltia CMS
      on port 5173. The port can be specified with the `VITE_CONFIG_PORT` environment variable. For
      example, run `VITE_CONFIG_PORT=3000 pnpm dev` for Next.js. You probably need to define the
      `Access-Control-Allow-Origin: *` HTTP response header with the dev server’s middleware, or
      loading the CMS config file may fail due to a CORS error.
    -->
    {@const port = import.meta.env.VITE_CONFIG_PORT || 5174}
    <link href="http://localhost:{port}/admin/config.yml" type="text/yaml" rel="cms-config-url" />
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
</AppShell>

<div role="alert">{$announcedPageTitle}</div>

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
