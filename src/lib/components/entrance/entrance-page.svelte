<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import { _ } from 'svelte-i18n';
  import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
  import SignIn from '$lib/components/entrance/sign-in.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { inAuthPopup } from '$lib/services/backends/shared/auth';
  import { siteConfig, siteConfigError } from '$lib/services/config';
  import { dataLoaded, dataLoadedProgress } from '$lib/services/contents';
  import { prefs, prefsError } from '$lib/services/prefs';
  import { signInError, unauthenticated, user } from '$lib/services/user';

  $: $announcedPageStatus = $_('welcome_to_sveltia_cms');
</script>

<div role="none" class="container" inert={$user && $dataLoaded}>
  <div role="none" class="inner">
    <img
      loading="lazy"
      src={$siteConfig?.logo_url || `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`}
      alt=""
      class="logo"
    />
    <h1>Sveltia CMS</h1>
    {#if $siteConfigError}
      <div role="alert" class="message">
        {$siteConfigError.message}
        {$_('config.error.try_again')}
      </div>
    {:else if $prefsError}
      <div role="alert" class="message">
        {$_(`prefs.error.${$prefsError.type}`)}
      </div>
    {:else if !$siteConfig || !$prefs}
      <div role="alert" class="message">{$_('loading_site_config')}</div>
    {:else if $signInError.message && !$signInError.canRetry}
      <div role="alert">
        <div role="none" class="message">{$_('loading_site_data_error')}</div>
        <div role="none" class="error">
          {@html DOMPurify.sanitize(
            /** @type {string} */ (marked.parseInline($signInError.message)),
            { ALLOWED_TAGS: ['a', 'code'], ALLOWED_ATTR: ['href'] },
          )}
        </div>
      </div>
    {:else if $inAuthPopup}
      <div role="alert" class="message">{$_('authorizing')}</div>
    {:else if !$user || $unauthenticated}
      <SignIn />
    {:else if !$dataLoaded}
      <div role="alert" class="message">{$_('loading_site_data')}</div>
      {#if $dataLoadedProgress !== undefined}
        <div role="progressbar" aria-valuenow={$dataLoadedProgress}>
          <div role="none" style:width={`${$dataLoadedProgress}%`}></div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  .container {
    position: absolute;
    inset: 0;
    z-index: 101;
    flex: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 32px;
    transition: filter 250ms;

    &[inert] {
      filter: opacity(0);
    }

    .inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      min-width: 240px;
      max-width: 800px;
      min-height: 240px;
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

    :global(.message) {
      margin: 0 0 16px;
      font-size: var(--sui-font-size-large);
      font-weight: normal;
      text-align: center;
    }

    .error {
      border-radius: var(--sui-control-medium-border-radius);
      padding: 12px;
      background-color: var(--sui-secondary-background-color);
      font-size: var(--sui-font-size-default);
      line-height: 1.5;
      text-align: center;
    }
  }

  [role='progressbar'] {
    overflow: hidden;
    border-radius: 16px;
    width: 240px;
    height: 8px;
    background-color: var(--sui-secondary-background-color);

    div {
      height: 100%;
      background-color: var(--sui-info-foreground-color);
      transition: width 250ms;
    }
  }
</style>
