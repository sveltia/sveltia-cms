<script>
  import { AppShell } from '@sveltia/ui';
  import { marked } from 'marked';
  import { isLoading } from 'svelte-i18n';
  import EntrancePage from '$lib/components/entrance/entrance-page.svelte';
  import MainRouter from '$lib/components/global/main-router.svelte';
  import { user } from '$lib/services/auth';
  import { entriesLoaded } from '$lib/services/contents';
  import { initAppLocale } from '$lib/services/i18n';

  initAppLocale();

  // Disable deprecation warnings in Marked 5.0.0+
  // https://github.com/markedjs/marked/releases/tag/v5.0.1
  marked.use({ mangle: false, headerIds: false });
</script>

<svelte:head>
  <base target="_blank" />
  <meta name="referrer" content="same-origin" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google" content="notranslate" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
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
    {#if $user && $entriesLoaded}
      <MainRouter />
    {:else}
      <EntrancePage />
    {/if}
  {/if}
</AppShell>
