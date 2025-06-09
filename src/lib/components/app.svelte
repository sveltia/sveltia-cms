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
  import { DEV_SITE_URL, initSiteConfig, siteConfig } from '$lib/services/config';
  import { dataLoaded } from '$lib/services/contents';
  import { user } from '$lib/services/user';
  import { initUserEnvDetection } from '$lib/services/user/env';

  /**
   * @import { SiteConfig } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SiteConfig} [config] Configuration specified with manual initialization.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    config,
    /* eslint-enable prefer-const */
  } = $props();

  onMount(() => {
    initAppLocale();
  });

  onMount(() => {
    initSiteConfig(config);
  });

  onMount(() => {
    initUserEnvDetection();
  });

  // Fix the position of the custom mount element if needed
  // @see https://decapcms.org/docs/custom-mounting/
  onMount(() => {
    const ncRoot = /** @type {HTMLElement | null} */ (document.querySelector('#nc-root'));

    if (!!ncRoot && window.getComputedStyle(ncRoot).position === 'static') {
      const { top, height } = ncRoot.getBoundingClientRect();

      if (height) {
        ncRoot.style.position = 'relative';
      } else {
        // Make sure the CMS UI won’t overlap with a header
        ncRoot.style.position = 'fixed';
        ncRoot.style.inset = `${top}px 0 0 0`;
      }
    }
  });
</script>

<svelte:head>
  <meta name="referrer" content="same-origin" />
  <meta name="robots" content="noindex" />
  {#if $siteConfig}
    {@const logoURL = $siteConfig.logo_url}
    <link
      rel="icon"
      href={logoURL || `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`}
      type={logoURL ? (mime.getType(logoURL) ?? undefined) : 'image/svg+xml'}
    />
  {/if}
  {#if DEV_SITE_URL}
    <link href="{DEV_SITE_URL}/admin/config.yml" type="application/yaml" rel="cms-config-url" />
  {/if}
</svelte:head>

<svelte:body
  onmousedown={(event) => {
    // Open external links in a new browser tab, internal links in the same tab
    if (
      /** @type {HTMLElement | null} */ (event.target)?.matches('a') &&
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
  @view-transition {
    navigation: auto;
  }

  @keyframes slide-out-to-left {
    from {
      transform: translateX(0);
      filter: brightness(1);
    }

    to {
      transform: translateX(-20%);
      filter: brightness(0.5);
    }
  }

  @keyframes slide-out-to-right {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(100%);
    }
  }

  @keyframes slide-in-from-right {
    from {
      transform: translateX(100%);
    }

    to {
      transform: translateX(0);
    }
  }

  @keyframes slide-in-from-left {
    from {
      transform: translateX(-20%);
      filter: brightness(0.5);
    }

    to {
      transform: translateX(0);
      filter: brightness(1);
    }
  }

  :global {
    html:active-view-transition-type(forwards) {
      &::view-transition-old(page-root) {
        z-index: 999;
        animation: 100ms ease-out both slide-out-to-left;

        @media (prefers-reduced-motion) {
          animation: none;
        }
      }

      &::view-transition-new(page-root) {
        z-index: 1000;
        animation: 100ms ease-out both slide-in-from-right;

        @media (prefers-reduced-motion) {
          animation: none;
        }
      }
    }

    html:active-view-transition-type(backwards) {
      &::view-transition-old(page-root) {
        z-index: 1000;
        animation: 100ms ease-out both slide-out-to-right;

        @media (prefers-reduced-motion) {
          animation: none;
        }
      }

      &::view-transition-new(page-root) {
        z-index: 999;
        animation: 100ms ease-out both slide-in-from-left;

        @media (prefers-reduced-motion) {
          animation: none;
        }
      }
    }

    html:active-view-transition-type(unknown) {
      &::view-transition-old(page-root) {
        animation: none;
      }

      &::view-transition-new(page-root) {
        animation: none;
      }
    }

    body:not(:has(#nc-root)) {
      overflow: hidden;
    }

    #nc-root > .sui.app-shell {
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
    background-color: var(--sui-secondary-background-color);
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
