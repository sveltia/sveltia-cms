<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
  import SignIn from '$lib/components/entrance/sign-in.svelte';
  import { fetchSiteConfig, siteConfig } from '$lib/services/config';
  import { dataLoaded } from '$lib/services/contents';
  import { announcedPageTitle } from '$lib/services/navigation';
  import { prefs } from '$lib/services/prefs';
  import { authError, unauthenticated, user } from '$lib/services/user';

  $: $announcedPageTitle = $_('welcome_to_sveltia_cms');

  onMount(() => {
    fetchSiteConfig();
  });
</script>

<div role="none" class="container">
  <div role="none" class="inner">
    <img
      loading="lazy"
      src={$siteConfig?.logo_url || `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`}
      alt=""
      class="logo"
    />
    <h1>Sveltia CMS</h1>
    {#if !$siteConfig || !$prefs}
      <div role="alert" class="message">{$_('loading_site_config')}</div>
    {:else if $siteConfig.error}
      <div role="alert" class="message">
        {$siteConfig.error}
        {$_('config.error.try_again')}
      </div>
    {:else if $prefs.error}
      <div role="alert" class="message">
        {$_(`prefs.error.${$prefs.error}`)}
      </div>
    {:else if $authError}
      <div role="alert">
        <div role="none" class="message">{$_('loading_site_data_error')}</div>
        <div role="none" class="error">
          {@html DOMPurify.sanitize(/** @type {string } */ (marked.parseInline($authError)), {
            ALLOWED_TAGS: ['a', 'code'],
            ALLOWED_ATTR: ['href'],
          })}
        </div>
      </div>
    {:else if !$user || $unauthenticated}
      <SignIn />
    {:else if !$dataLoaded}
      <div role="alert" class="message">{$_('loading_site_data')}</div>
    {/if}
  </div>
</div>

<style lang="scss">
  .container {
    position: fixed;
    inset: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;

    .inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      min-width: 240px;
      max-width: 800px;
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

    .message {
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
</style>
