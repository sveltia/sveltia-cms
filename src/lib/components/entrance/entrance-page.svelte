<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
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

  let loadingError;

  onMount(() => {
    fetchSiteConfig();
  });

  $: {
    if ($siteConfig && !$siteConfig.error && $prefs && !$prefs.error && $user) {
      (async () => {
        try {
          await get(backend).fetchFiles();
          $entriesLoaded = true;
        } catch (ex) {
          loadingError = ex.cause || $_('unexpected_error');
          // eslint-disable-next-line no-console
          console.error(ex);
        }
      })();
    }
  }
</script>

<div class="container">
  <div class="inner">
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
    {:else if loadingError}
      <div>
        <h2>{$_('loading_site_data_error')}</h2>
        <div class="error" role="alert">
          {@html DOMPurify.sanitize(/** @type {string } */ (marked.parseInline(loadingError)), {
            ALLOWED_TAGS: ['a', 'code'],
            ALLOWED_ATTR: ['href'],
          })}
        </div>
      </div>
    {:else if !$entriesLoaded}
      <h2>{$_('loading_site_data')}</h2>
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

    :global(h2) {
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
