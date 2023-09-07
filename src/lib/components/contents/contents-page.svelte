<script>
  import { onMount } from 'svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import ContentDetailsOverlay from '$lib/components/contents/details/content-details-overlay.svelte';
  import EntryList from '$lib/components/contents/list/entry-list.svelte';
  import FileList from '$lib/components/contents/list/file-list.svelte';
  import PrimarySidebar from '$lib/components/contents/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/contents/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/contents/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/contents/list/secondary-toolbar.svelte';
  import { getCollection, getFile, selectedCollection } from '$lib/services/contents';
  import { createDraft, entryDraft } from '$lib/services/contents/editor';
  import { listedEntries } from '$lib/services/contents/view';
  import { parseLocation } from '$lib/services/navigation';

  /**
   * Navigate to the content list or content details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    const { path, params } = parseLocation();
    const match = path.match(/^\/collections\/([^/]+)(?:\/(new|entries))?(?:\/(.+?))?$/);

    if (!match) {
      return; // Not Found
    }

    const [, _collectionName, _state, _id] = match;
    /**
     * @type {Collection | undefined}
     */
    const collection = _collectionName ? getCollection(_collectionName) : undefined;

    if (collection && !collection.hide && $selectedCollection !== collection) {
      $selectedCollection = collection;
    }

    $entryDraft = null;

    if (!_state) {
      return; // Not Found
    }

    const {
      name: collectionName,
      files,
      _i18n: { hasLocales, locales },
    } = $selectedCollection;

    if (files) {
      // File collection
      if (_state === 'entries' && _id) {
        const selectedEntry = getFile(collectionName, _id);
        const collectionFile = files.find((f) => f.name === _id);

        if (selectedEntry) {
          createDraft(selectedEntry);
        } else if (collectionFile) {
          // File is not yet created
          createDraft({
            collectionName,
            fileName: collectionFile.name,
            slug: collectionFile.name,
            locales: Object.fromEntries(
              (hasLocales ? locales : ['default']).map((_locale) => [_locale, {}]),
            ),
          });
        }
      }
    } else {
      // Folder collection
      if (_state === 'new' && !_id && $selectedCollection.create) {
        createDraft({ collectionName }, params);
      }

      if (_state === 'entries' && _id) {
        const selectedEntry = $listedEntries.find(({ slug }) => slug === _id);

        if (selectedEntry) {
          createDraft(selectedEntry);
        }
      }
    }
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  on:hashchange={() => {
    navigate();
  }}
/>

<PageContainer class="content">
  <PrimarySidebar slot="primary_sidebar" />
  <PrimaryToolbar slot="primary_toolbar" />
  <SecondaryToolbar slot="secondary_toolbar" />
  <svelte:component this={$selectedCollection.files ? FileList : EntryList} slot="main" />
  <SecondarySidebar slot="secondary_sidebar" />
</PageContainer>

{#if $entryDraft}
  <ContentDetailsOverlay />
{/if}
