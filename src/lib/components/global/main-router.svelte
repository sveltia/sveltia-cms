<script>
  import { onMount } from 'svelte';

  import AssetsPage from '$lib/components/assets/assets-page.svelte';
  import CloudinaryIframe from '$lib/components/assets/browser/cloudinary-iframe.svelte';
  import AssetUpdatesToast from '$lib/components/assets/shared/asset-updates-toast.svelte';
  import UploadAssetsConfirmDialog from '$lib/components/assets/shared/upload-assets-confirm-dialog.svelte';
  import UploadAssetsDialog from '$lib/components/assets/shared/upload-assets-dialog.svelte';
  import ConfigPage from '$lib/components/config/config-page.svelte';
  import ContentsPage from '$lib/components/contents/contents-page.svelte';
  import TranslatorApiKeyDialog from '$lib/components/contents/details/editor/translator-api-key-dialog.svelte';
  import EntryParseErrorsToast from '$lib/components/contents/shared/entry-parse-errors-toast.svelte';
  import MobilePromoInfobar from '$lib/components/global/infobars/mobile-promo-infobar.svelte';
  import NewLanguageInfobar from '$lib/components/global/infobars/new-language-infobar.svelte';
  import NotFoundPage from '$lib/components/global/not-found-page.svelte';
  import BottomNavigation from '$lib/components/global/toolbar/bottom-navigation.svelte';
  import GlobalToolbar from '$lib/components/global/toolbar/global-toolbar.svelte';
  import MenuPage from '$lib/components/menu/menu-page.svelte';
  import MobileSignInDialog from '$lib/components/menu/mobile-sign-in-dialog.svelte';
  import SearchPage from '$lib/components/search/search-page.svelte';
  import SettingsPage from '$lib/components/settings/settings-page.svelte';
  import WorkflowPage from '$lib/components/workflow/workflow-page.svelte';
  import {
    parseLocation,
    redirectLegacyEntryLink,
    selectedPageName,
  } from '$lib/services/app/navigation';
  import { canShowMobileSignInDialog } from '$lib/services/app/onboarding';
  import { searchMode } from '$lib/services/search';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * Page name used while the URL matches none of the routes below. It’s deliberately not a route
   * itself, so `#/not-found` is a dead link like any other unknown path.
   */
  const NOT_FOUND_PAGE_NAME = 'not-found';

  /**
   * Page names that make up the whole route. Unlike the content library and the other pages that
   * take a path of their own, anything following these in the URL is a dead link.
   */
  const STANDALONE_PAGE_NAMES = ['workflow', 'config', 'menu'];

  /** @type {Record<string, any>} */
  const pages = $derived({
    collections: ContentsPage,
    assets: AssetsPage,
    search: env.isSmallScreen
      ? SearchPage
      : $searchMode
        ? { contents: ContentsPage, assets: AssetsPage }[$searchMode]
        : SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
    // For small screens
    menu: MenuPage,
    settings: SettingsPage,
  });

  const SelectedPage = $derived(
    $selectedPageName === NOT_FOUND_PAGE_NAME ? NotFoundPage : pages[$selectedPageName],
  );

  /**
   * Show the Not Found page, which isn’t a route of its own, so `#/not-found` is a dead link like
   * any other unknown path.
   */
  const showNotFound = () => {
    $selectedPageName = NOT_FOUND_PAGE_NAME;
    $searchMode = null;
  };

  /**
   * Select one of the pages given the URL path.
   */
  export const selectPage = () => {
    // A Netlify/Decap CMS shorthand link to an entry has to be caught before the fallback below,
    // which would otherwise drop the user on the collection list with no sign of where they meant
    // to go. The redirect triggers another `hashchange`, so this runs again with the real route
    if (redirectLegacyEntryLink()) {
      return;
    }

    const { path } = parseLocation();

    // The page name has to fill the whole first path segment, so `/collections-foo` doesn’t pass
    // for the content library and land on a page that can’t make sense of the rest of the path
    const { pageName } =
      path.match(`^\\/(?<pageName>${Object.keys(pages).join('|')})(?=\\/|$)`)?.groups ?? {};

    if (!pageName) {
      if (path === '/') {
        // The bare `#/` path is where the app starts, so open the content library
        window.location.replace('#/collections');
      } else {
        // Any other unknown path is a dead link. Show a Not Found page instead of redirecting,
        // which would hide the fact that the URL the user followed no longer goes anywhere
        showNotFound();
      }

      return;
    }

    if (STANDALONE_PAGE_NAMES.includes(pageName) && path !== `/${pageName}`) {
      showNotFound();

      return;
    }

    if ($selectedPageName !== pageName) {
      $selectedPageName = pageName;
    }

    if (pageName === 'collections') {
      $searchMode = 'contents';
    } else if (pageName === 'assets') {
      $searchMode = 'assets';
    } else if (pageName !== 'search') {
      $searchMode = null;
    }
  };

  onMount(() => {
    selectPage();
  });
</script>

<svelte:window
  onhashchange={() => {
    selectPage();
  }}
/>

<NewLanguageInfobar />

{#if $canShowMobileSignInDialog}
  <MobilePromoInfobar />
  <MobileSignInDialog />
{/if}

{#if !env.isSmallScreen}
  <GlobalToolbar />
{/if}

<div role="none" class="page-root">
  <SelectedPage />
</div>

{#if env.isSmallScreen}
  <BottomNavigation />
{/if}

<UploadAssetsDialog />
<UploadAssetsConfirmDialog />
<AssetUpdatesToast />
<TranslatorApiKeyDialog />
<EntryParseErrorsToast />
<CloudinaryIframe />

<style>
  .page-root {
    position: relative;
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    view-transition-name: page-root;
  }
</style>
