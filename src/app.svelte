<script>
  import { AppShell } from '@sveltia/ui';
  import { isLoading } from 'svelte-i18n';
  import EntrancePage from '$lib/components/entrance/entrance-page.svelte';
  import MainRouter from '$lib/components/global/main-router.svelte';
  import { user } from '$lib/services/auth';
  import { entriesLoaded } from '$lib/services/contents';
  import { initLocales } from '$lib/services/i18n';

  initLocales();
</script>

<svelte:head>
  <base target="_blank" />
  <meta name="referrer" content="same-origin" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google" content="notranslate" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  {#if import.meta.env.DEV}
    <!-- Assume a local SvelteKit site is running on port 5174 along with the CMS on port 5173 -->
    <link href="http://localhost:5174/admin/config.yml" type="text/yaml" rel="cms-config-url" />
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
