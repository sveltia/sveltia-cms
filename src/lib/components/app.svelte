<script>
  import { AppShell } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { isLoading } from 'svelte-i18n';

  import EntrancePage from '$lib/components/entrance/entrance-page.svelte';
  import BackendStatusIndicator from '$lib/components/global/infobars/backend-status-indicator.svelte';
  import UpdateNotification from '$lib/components/global/infobars/update-notification.svelte';
  import MainRouter from '$lib/components/global/main-router.svelte';
  import { appLogoType, appLogoURL, appTitle } from '$lib/services/app/branding';
  import { initAppLocale } from '$lib/services/app/i18n';
  import { announcedPageStatus, startViewTransition } from '$lib/services/app/navigation';
  import { backend } from '$lib/services/backends';
  import { cmsConfigLoaded, DEV_SITE_URL, initCmsConfig } from '$lib/services/config';
  import { dataLoaded } from '$lib/services/contents';
  import { user } from '$lib/services/user';
  import { initUserEnvDetection } from '$lib/services/user/env';

  /**
   * @import { CmsConfig } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CmsConfig} [config] Configuration specified with manual initialization.
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
    initCmsConfig(config);
  });

  onMount(() => {
    initUserEnvDetection();
  });

  // Fix the position of the custom mount element if needed
  // @see https://decapcms.org/docs/custom-mounting/
  // @see https://sveltiacms.app/en/docs/customization#custom-mount-element
  onMount(() => {
    const ncRoot = /** @type {HTMLElement | null} */ (document.querySelector('#nc-root'));

    if (!!ncRoot && window.getComputedStyle(ncRoot).position === 'static') {
      // Wait for the next frame to ensure the element is rendered before calculating its position
      window.requestAnimationFrame(() => {
        const { top, height } = ncRoot.getBoundingClientRect();

        if (height) {
          ncRoot.style.position = 'relative';
        } else {
          // Make sure the CMS UI won’t overlap with a header
          ncRoot.style.position = 'fixed';
          ncRoot.style.inset = `${top}px 0 0 0`;
        }
      });
    }
  });

  let transitioned = $state(false);

  $effect(() => {
    if ($dataLoaded && $user) {
      startViewTransition('forwards', () => {
        transitioned = true;
      });
    } else {
      startViewTransition('backwards', () => {
        transitioned = false;
      });
    }
  });
</script>

<svelte:head>
  <meta name="referrer" content="same-origin" />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
  {#if $cmsConfigLoaded}
    <title>{$appTitle}</title>
    <link rel="icon" href={$appLogoURL} type={$appLogoType} />
  {/if}
  {#if DEV_SITE_URL}
    <link href="{DEV_SITE_URL}/admin/config.yml" type="application/yaml" rel="cms-config-url" />
  {/if}
</svelte:head>

<svelte:body
  onmousedown={(event) => {
    if (/** @type {HTMLElement | null} */ (event.target)?.matches('a')) {
      const link = /** @type {HTMLAnchorElement} */ (event.target);
      const { origin, pathname } = link;

      // Open external links and links to different paths in a new tab
      if (origin !== window.location.origin || pathname !== window.location.pathname) {
        link.target = '_blank';
      }
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
        {#if $user && $dataLoaded && transitioned}
          <MainRouter />
        {:else}
          <EntrancePage />
        {/if}
      </div>
    </div>
  {/if}
  <div role="status">{$announcedPageStatus}</div>
</AppShell>

<style lang="scss">
  // Design 5: Refined Enterprise — Global theme overrides
  :global {
    :root,
    :host {
      // Shift base hue to indigo (from 210 blue to 239 indigo)
      --sui-base-hue: 239;

      // Font: Inter instead of Merriweather Sans
      --sui-font-family-default: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --sui-font-weight-normal: 400;
      --sui-font-weight-bold: 600;

      // Override accent colors to match Design 5 indigo (#4f46e5)
      &[data-theme='light'] {
        --sui-primary-accent-color-text: hsl(243 76% 54%);
        --sui-primary-accent-color-light: hsl(243 76% 58%);
        --sui-primary-accent-color: hsl(243 76% 58%);
        --sui-primary-accent-color-dark: hsl(243 76% 50%);
        --sui-primary-accent-color-translucent: hsl(243 76% 58% / 30%);
      }

      &[data-theme='dark'] {
        --sui-primary-accent-color-text: hsl(243 80% 68%);
        --sui-primary-accent-color-light: hsl(243 80% 58%);
        --sui-primary-accent-color: hsl(243 80% 54%);
        --sui-primary-accent-color-dark: hsl(243 80% 48%);
        --sui-primary-accent-color-translucent: hsl(243 80% 58% / 35%);
      }

      // Custom variables for dark sidebar/toolbar
      --enterprise-nav-bg: #0f172a;
      --enterprise-nav-bg-secondary: #1e293b;
      --enterprise-nav-text: #94a3b8;
      --enterprise-nav-text-hover: #cbd5e1;
      --enterprise-nav-active: #e2e8f0;
      --enterprise-nav-active-bg: hsl(243 76% 58% / 15%);
      --enterprise-nav-active-text: #a5b4fc;
      --enterprise-nav-active-count: #818cf8;
      --enterprise-nav-border: rgb(255 255 255 / 6%);
      --enterprise-nav-section-label: #475569;
      --enterprise-search-bg: rgb(255 255 255 / 8%);
      --enterprise-search-border: rgb(255 255 255 / 10%);
    }
  }

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
      opacity: 1;
    }

    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  @keyframes slide-in-from-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }

    to {
      transform: translateX(0);
      opacity: 1;
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

  // RTL-specific keyframes that mirror the depth effect
  @keyframes slide-out-to-left-rtl {
    from {
      transform: translateX(0);
      opacity: 1;
    }

    to {
      transform: translateX(-100%);
      opacity: 0;
    }
  }

  @keyframes slide-out-to-right-rtl {
    from {
      transform: translateX(0);
      filter: brightness(1);
    }

    to {
      transform: translateX(20%);
      filter: brightness(0.5);
    }
  }

  @keyframes slide-in-from-right-rtl {
    from {
      transform: translateX(20%);
      filter: brightness(0.5);
    }

    to {
      transform: translateX(0);
      filter: brightness(1);
    }
  }

  @keyframes slide-in-from-left-rtl {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }

    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  :global {
    html:active-view-transition-type(forwards) {
      @media (width < 768px) {
        &::view-transition-old(page-root) {
          z-index: 999;
          animation: 100ms ease-in both slide-out-to-left;

          @media (prefers-reduced-motion) {
            animation: none;
          }
        }

        &::view-transition-new(page-root) {
          @media (width < 768px) {
            z-index: 1000;
            animation: 100ms ease-in both slide-in-from-right;
          }

          @media (prefers-reduced-motion) {
            animation: none;
          }
        }

        &:dir(rtl) {
          &::view-transition-old(page-root) {
            animation: 100ms ease-in both slide-out-to-right-rtl;
          }

          &::view-transition-new(page-root) {
            animation: 100ms ease-in both slide-in-from-left-rtl;
          }
        }
      }
    }

    html:active-view-transition-type(backwards) {
      @media (width < 768px) {
        &::view-transition-old(page-root) {
          z-index: 1000;
          animation: 100ms ease-in both slide-out-to-right;

          @media (prefers-reduced-motion) {
            animation: none;
          }
        }

        &::view-transition-new(page-root) {
          z-index: 999;
          animation: 100ms ease-in both slide-in-from-left;

          @media (prefers-reduced-motion) {
            animation: none;
          }
        }

        &:dir(rtl) {
          &::view-transition-old(page-root) {
            animation: 100ms ease-in both slide-out-to-left-rtl;
          }

          &::view-transition-new(page-root) {
            animation: 100ms ease-in both slide-in-from-right-rtl;
          }
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
