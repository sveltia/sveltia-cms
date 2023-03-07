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
  import { siteConfig } from '$lib/services/config';
  import { getCollection, selectedCollection } from '$lib/services/contents';
  import { createDraft, entryDraft } from '$lib/services/contents/editor';
  import { listedEntries } from '$lib/services/contents/view';
  import { parseLocation } from '$lib/services/navigation';

  /**
   * Navigate to the content list or content details page given the URL hash.
   *
   * @todo Show Not Found page.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const match = path.match(/^\/collections\/(\w+)(?:\/(new|entries))?(?:\/(.+?))?$/);

    if (!match) {
      return; // Not Found
    }

    const [, _collectionName, _state, _id] = match;
    const collection = _collectionName ? getCollection(_collectionName) : undefined;

    if (collection && !collection.hide && $selectedCollection !== collection) {
      $selectedCollection = collection;
    }

    $entryDraft = null;

    if (!_state) {
      return; // Not Found
    }

    if ($selectedCollection.files) {
      // File collection
      if (_state === 'entries' && _id) {
        const selectedEntry = $listedEntries.find(
          ({ collectionName, fileName }) =>
            collectionName === $selectedCollection.name && fileName === _id,
        );

        const collectionFile = $selectedCollection.files.find((f) => f.name === _id);

        if (selectedEntry) {
          createDraft($selectedCollection.name, selectedEntry);
        } else if (collectionFile) {
          // File is not yet created
          createDraft($selectedCollection.name, {
            fileName: collectionFile.name,
            locales: Object.fromEntries(
              ($siteConfig.i18n?.locales || ['default']).map((_locale) => [_locale, {}]),
            ),
          });
        }
      }
    } else {
      // Folder collection
      if (_state === 'new' && !_id && $selectedCollection.create) {
        createDraft($selectedCollection.name);
      }

      if (_state === 'entries' && _id) {
        const selectedEntry = $listedEntries.find(({ slug }) => slug === _id);

        if (selectedEntry) {
          createDraft($selectedCollection.name, selectedEntry);
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
