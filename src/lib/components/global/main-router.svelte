<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import AssetsPage from '$lib/components/assets/assets-page.svelte';
  import UploadAssetsConfirmDialog from '$lib/components/assets/shared/upload-assets-confirm-dialog.svelte';
  import ConfigPage from '$lib/components/config/config-page.svelte';
  import ContentsPage from '$lib/components/contents/contents-page.svelte';
  import TranslatorApiKeyDialog from '$lib/components/contents/details/editor/translator-api-key-dialog.svelte';
  import GlobalToolbar from '$lib/components/global/global-toolbar/global-toolbar.svelte';
  import SearchPage from '$lib/components/search/search-page.svelte';
  import WorkflowPage from '$lib/components/workflow/workflow-page.svelte';
  import { selectedCollection } from '$lib/services/contents';
  import { entryDraft } from '$lib/services/contents/editor';
  import { parseLocation, selectedPageName } from '$lib/services/navigation';

  export const pages = {
    collections: ContentsPage,
    assets: AssetsPage,
    search: SearchPage,
    workflow: WorkflowPage,
    config: ConfigPage,
  };

  /**
   * Select one of the pages given the URL pash.
   *
   * @todo Show Not Found page.
   */
  export const selectPage = () => {
    const { path } = parseLocation();
    const [, _pageName] = path.match(new RegExp(`^\\/(${Object.keys(pages).join('|')})\\b`)) || [];

    // Reset the draft to prevent the page from becoming blank when navigating back
    $entryDraft = null;

    if (!_pageName) {
      // Redirect any invalid page to the contents page
      window.location.replace(`#/collections/${get(selectedCollection).name}`);
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

<div class="outer">
  <GlobalToolbar />
  <svelte:component this={pages[$selectedPageName]} />
</div>

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
