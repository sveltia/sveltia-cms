<script>
  import { AppShell } from '@sveltia/ui';
  import mime from 'mime';
  import { onMount } from 'svelte';
  import { isLoading } from 'svelte-i18n';
  import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
  import EntrancePage from '$lib/components/entrance/entrance-page.svelte';
  import BackendStatusIndicator from '$lib/components/global/infobars/backend-status-indicator.svelte';
  import UpdateNotification from '$lib/components/global/infobars/update-notification.svelte';
  import MainRouter from '$lib/components/global/main-router.svelte';
  import { initAppLocale } from '$lib/services/app/i18n';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { backend } from '$lib/services/backends';
  import { initSiteConfig, siteConfig, siteURL } from '$lib/services/config';
  import { dataLoaded } from '$lib/services/contents';
  import { user } from '$lib/services/user';

  /**
   * Configuration specified with manual initialization.
   * @type {object | undefined}
   */
  export let config;

  $: logoURL = $siteConfig?.logo_url;

  onMount(() => {
    initAppLocale();
    initSiteConfig(config);
  });

  // Fix the position of the custom mount element if needed
  // @see https://decapcms.org/docs/custom-mounting/
  onMount(() => {
    const ncRoot = /** @type {?HTMLElement} */ (document.querySelector('#nc-root'));

    if (
      !!ncRoot &&
      !!ncRoot.clientWidth &&
      !!ncRoot.clientHeight &&
      window.getComputedStyle(ncRoot).position === 'static'
    ) {
      ncRoot.classList.add('relative');
    }
  });
</script>

<svelte:head>
  <meta name="referrer" content="same-origin" />
  <link
    rel="icon"
    href={logoURL || `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`}
    type={logoURL ? (mime.getType(logoURL) ?? undefined) : 'image/svg+xml'}
  />
  {#if siteURL}
    <link href="{siteURL}/admin/config.yml" type="application/yaml" rel="cms-config-url" />
  {/if}
</svelte:head>

<svelte:body
  on:mousedown={(event) => {
    // Open external links in a new browser tab, internal links in the same tab
    if (
      /** @type {?HTMLElement} */ (event?.target)?.matches('a') &&
      /** @type {HTMLAnchorElement} */ (event.target).origin !== window.location.origin
    ) {
      /** @type {HTMLAnchorElement} */ (event.target).target = '_blank';
    }
  }}
/>

<AppShell>
  {#if !$isLoading}
    <div role="none" class="outer">
      <UpdateNotification />
      {#if $backend}
        <BackendStatusIndicator />
      {/if}
      <div role="none" class="main">
        <EntrancePage />
        {#if $user && $dataLoaded}
          <MainRouter />
        {/if}
      </div>
    </div>
  {/if}
  <div role="status">{$announcedPageStatus}</div>
</AppShell>

<style lang="scss">
  :global(body:not(:has(#nc-root))) {
    overflow: hidden;
  }

  :global(#nc-root.relative) {
    position: relative;

    & > :global(.sui.app-shell) {
      position: absolute;
    }
  }

  .outer {
    display: flex;
    flex-direction: column;
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .main {
    position: relative;
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  [role='status'] {
    position: absolute;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }
</style>
