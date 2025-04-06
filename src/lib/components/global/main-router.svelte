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
  import PrefsPage from '$lib/components/prefs/prefs-page.svelte';
  import SearchPage from '$lib/components/search/search-page.svelte';
  import WorkflowPage from '$lib/components/workflow/workflow-page.svelte';
  import { isSmallScreen } from '$lib/services/app/env';
  import { parseLocation, selectedPageName } from '$lib/services/app/navigation';
  import { showAssetOverlay } from '$lib/services/assets';
  import { getFirstCollection, selectedCollection } from '$lib/services/contents/collection';
  import { showContentOverlay } from '$lib/services/contents/draft/editor';
  import { searchMode, showSearchBar } from '$lib/services/search';

  /** @type {Record<string, any>} */
  export const pages = {
    collections: ContentsPage,
    assets: AssetsPage,
    search: SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
    // For small screens
    menu: MenuPage,
    settings: PrefsPage,
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
        `#/collections/${$selectedCollection?.name ?? getFirstCollection()?.name}`,
      );
    } else if ($selectedPageName !== pageName) {
      $selectedPageName = pageName;
    }

    if (pageName === 'collections') {
      $searchMode = 'entries';
    } else if (pageName === 'assets') {
      $searchMode = 'assets';
    } else if (pageName === 'search') {
      $showSearchBar = true;
    } else {
      $showSearchBar = false;
      $searchMode = null;
    }
  };

  onMount(() => {
    selectPage();
  });

  onMount(() => {
    const mql = window.matchMedia('(width < 768px)');

    $isSmallScreen = mql.matches;

    mql.addEventListener('change', () => {
      $isSmallScreen = mql.matches;
    });
  });
</script>

<svelte:window
  onhashchange={() => {
    selectPage();
  }}
/>

<GlobalToolbar />
<SelectedPage />
<BottomNavigation />

<UploadAssetsDialog />
<UploadAssetsConfirmDialog />
<TranslatorApiKeyDialog />
<EntryParseErrorsToast />
