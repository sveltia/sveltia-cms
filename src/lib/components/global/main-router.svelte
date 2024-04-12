<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import AssetsPage from '$lib/components/assets/assets-page.svelte';
  import UploadAssetsConfirmDialog from '$lib/components/assets/shared/upload-assets-confirm-dialog.svelte';
  import UploadAssetsDialog from '$lib/components/assets/shared/upload-assets-dialog.svelte';
  import ConfigPage from '$lib/components/config/config-page.svelte';
  import ContentsPage from '$lib/components/contents/contents-page.svelte';
  import TranslatorApiKeyDialog from '$lib/components/contents/details/editor/translator-api-key-dialog.svelte';
  import GlobalToolbar from '$lib/components/global/toolbar/global-toolbar.svelte';
  import UpdateNotification from '$lib/components/global/updater/update-notification.svelte';
  import SearchPage from '$lib/components/search/search-page.svelte';
  import WorkflowPage from '$lib/components/workflow/workflow-page.svelte';
  import { parseLocation, selectedPageName } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents';

  /**
   * @type {{ [key: string]: any }}
   */
  export const pages = {
    collections: ContentsPage,
    assets: AssetsPage,
    search: SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
  };

  /**
   * Select one of the pages given the URL path.
   * @todo Show Not Found page.
   */
  export const selectPage = () => {
    const { path } = parseLocation();
    const [, _pageName] = path.match(`^\\/(${Object.keys(pages).join('|')})\\b`) ?? [];

    if (!_pageName) {
      // Redirect any invalid page to the contents page
      window.location.replace(`#/collections/${get(selectedCollection)?.name}`);
    } else if (get(selectedPageName) !== _pageName) {
      selectedPageName.set(_pageName);
    }
  };

  onMount(() => {
    selectPage();
  });
</script>

<svelte:window
  on:hashchange={() => {
    selectPage();
  }}
/>

<div role="none" class="outer">
  <UpdateNotification />
  <GlobalToolbar />
  <svelte:component this={pages[$selectedPageName]} />
</div>

<UploadAssetsDialog />
<UploadAssetsConfirmDialog />
<TranslatorApiKeyDialog />

<style lang="scss">
  .outer {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
</style>
