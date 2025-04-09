<script>
  import { onMount } from 'svelte';
  import AssetsPage from '$lib/components/assets/assets-page.svelte';
  import UploadAssetsConfirmDialog from '$lib/components/assets/shared/upload-assets-confirm-dialog.svelte';
  import UploadAssetsDialog from '$lib/components/assets/shared/upload-assets-dialog.svelte';
  import ConfigPage from '$lib/components/config/config-page.svelte';
  import ContentsPage from '$lib/components/contents/contents-page.svelte';
  import TranslatorApiKeyDialog from '$lib/components/contents/details/editor/translator-api-key-dialog.svelte';
  import EntryParseErrorsToast from '$lib/components/contents/shared/entry-parse-errors-toast.svelte';
  import BottomNavigation from '$lib/components/global/toolbar/bottom-navigation.svelte';
  import GlobalToolbar from '$lib/components/global/toolbar/global-toolbar.svelte';
  import MenuPage from '$lib/components/menu/menu-page.svelte';
  import SearchPage from '$lib/components/search/search-page.svelte';
  import SettingsPage from '$lib/components/settings/settings-page.svelte';
  import WorkflowPage from '$lib/components/workflow/workflow-page.svelte';
  import { isLargeScreen, isMediumScreen, isSmallScreen } from '$lib/services/app/env';
  import { parseLocation, selectedPageName } from '$lib/services/app/navigation';
  import { showAssetOverlay } from '$lib/services/assets';
  import { getFirstCollection, selectedCollection } from '$lib/services/contents/collection';
  import { showContentOverlay } from '$lib/services/contents/draft/editor';
  import { searchMode } from '$lib/services/search';

  /** @type {Record<string, any>} */
  export const pages = {
    collections: ContentsPage,
    assets: AssetsPage,
    search: SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
    // For small screens
    menu: MenuPage,
    settings: SettingsPage,
  };

  const SelectedPage = $derived(pages[$selectedPageName]);

  /**
   * Select one of the pages given the URL path.
   * @todo Show Not Found page.
   */
  export const selectPage = () => {
    $showContentOverlay = false;
    $showAssetOverlay = false;

    const { path } = parseLocation();

    const { pageName } =
      path.match(`^\\/(?<pageName>${Object.keys(pages).join('|')})\\b`)?.groups ?? {};

    if (!pageName) {
      // Redirect any invalid page to the contents page
      window.location.replace(
        $isSmallScreen
          ? '#/collections'
          : `#/collections/${$selectedCollection?.name ?? getFirstCollection()?.name}`,
      );
    } else if ($selectedPageName !== pageName) {
      $selectedPageName = pageName;
    }

    if (pageName === 'collections') {
      $searchMode = 'entries';
    } else if (pageName === 'assets') {
      $searchMode = 'assets';
    } else if (pageName !== 'search') {
      $searchMode = null;
    }
  };

  onMount(() => {
    const mqlSmall = window.matchMedia('(width < 768px)');
    const mqlMedium = window.matchMedia('(768px <= width < 1024px)');
    const mqlLarge = window.matchMedia('(1024px <= width)');

    $isSmallScreen = mqlSmall.matches;
    $isMediumScreen = mqlMedium.matches;
    $isLargeScreen = mqlLarge.matches;

    mqlSmall.addEventListener('change', () => {
      $isSmallScreen = mqlSmall.matches;
    });

    mqlMedium.addEventListener('change', () => {
      $isMediumScreen = mqlMedium.matches;
    });

    mqlMedium.addEventListener('change', () => {
      $isLargeScreen = mqlLarge.matches;
    });

    selectPage();
  });
</script>

<svelte:window
  onhashchange={() => {
    selectPage();
  }}
/>

{#if !$isSmallScreen}
  <GlobalToolbar />
{/if}

<div role="none" class="page-root">
  <SelectedPage />
</div>

{#if $isSmallScreen}
  <BottomNavigation />
{/if}

<UploadAssetsDialog />
<UploadAssetsConfirmDialog />
<TranslatorApiKeyDialog />
<EntryParseErrorsToast />

<style lang="scss">
  .page-root {
    position: relative;
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    view-transition-name: page-root;
  }
</style>
