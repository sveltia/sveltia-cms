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
  import ContentUpdatesToast from '$lib/components/contents/shared/content-updates-toast.svelte';
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
    resolveRoute,
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

  /** @type {Record<string, any>} */
  const pages = $derived({
    collections: ContentsPage,
    assets: AssetsPage,
    search: env.isSmallScreen
      ? SearchPage
      : searchMode.current
        ? { contents: ContentsPage, assets: AssetsPage }[searchMode.current]
        : SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
    // For small screens
    menu: MenuPage,
    settings: SettingsPage,
  });

  const SelectedPage = $derived(
    selectedPageName.current === NOT_FOUND_PAGE_NAME
      ? NotFoundPage
      : pages[selectedPageName.current],
  );

  /**
   * Select one of the pages given the URL path.
   */
  const selectPage = () => {
    // A Netlify/Decap CMS shorthand link to an entry has to be caught before the route is resolved,
    // which would otherwise drop the user on the collection list with no sign of where they meant
    // to go. The redirect triggers another `hashchange`, so this runs again with the real route
    if (redirectLegacyEntryLink()) {
      return;
    }

    const route = resolveRoute(parseLocation().path, Object.keys(pages));

    if ('redirect' in route) {
      window.location.replace(route.redirect);

      return;
    }

    if ('notFound' in route) {
      selectedPageName.current = NOT_FOUND_PAGE_NAME;
      searchMode.current = null;

      return;
    }

    if (selectedPageName.current !== route.pageName) {
      selectedPageName.current = route.pageName;
    }

    if (route.searchMode !== undefined) {
      searchMode.current = route.searchMode;
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

{#if canShowMobileSignInDialog.current}
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
<ContentUpdatesToast />
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
