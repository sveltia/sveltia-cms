<script>
  import { Alert, Group, Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import ContentDetailsOverlay from '$lib/components/contents/details/content-details-overlay.svelte';
  import EntryList from '$lib/components/contents/list/entry-list.svelte';
  import FileList from '$lib/components/contents/list/file-list.svelte';
  import PrimarySidebar from '$lib/components/contents/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/contents/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/contents/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/contents/list/secondary-toolbar.svelte';
  import { announcedPageStatus, parseLocation } from '$lib/services/app/navigation';
  import { getCollection, selectedCollection } from '$lib/services/contents/collection';
  import { contentUpdatesToast } from '$lib/services/contents/collection/data';
  import { getFile } from '$lib/services/contents/collection/files';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { showContentOverlay } from '$lib/services/contents/draft/editor';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';

  const routeRegex =
    /^\/collections\/(?<_collectionName>[^/]+)(?:\/(?<routeType>new|entries))?(?:\/(?<subPath>.+?))?$/;

  const MainContent = $derived($selectedCollection?.files ? FileList : EntryList);

  /**
   * Navigate to the content list or content details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    const { path, params } = parseLocation();
    const match = path.match(routeRegex);

    if (!match?.groups) {
      return; // Not Found
    }

    const { _collectionName, routeType, subPath } = match.groups;
    /**
     * @type {Collection | undefined}
     */
    const collection = _collectionName ? getCollection(_collectionName) : undefined;

    if (collection && !collection.hide && $selectedCollection !== collection) {
      $selectedCollection = collection;
    }

    if (!collection || !$selectedCollection) {
      $announcedPageStatus = $_('collection_not_found');

      return; // Not Found
    }

    const { name: collectionName, label, create, files } = $selectedCollection;
    const collectionLabel = label || collectionName;

    const _fileMap = files
      ? /** @type {FileCollection} */ ($selectedCollection)._fileMap
      : undefined;

    if (!routeType) {
      const count = $listedEntries.length;

      $announcedPageStatus = $_(
        count > 1
          ? 'viewing_x_collection_many_entries'
          : count === 1
            ? 'viewing_x_collection_one_entry'
            : 'viewing_x_collection_no_entries',
        { values: { collection: collectionLabel, count } },
      );

      return;
    }

    $showContentOverlay = true;

    if (_fileMap) {
      // File collection
      if (routeType === 'entries' && subPath) {
        const originalEntry = getFile(collectionName, subPath);
        const collectionFile = _fileMap[subPath];

        if (originalEntry) {
          createDraft({ collection, collectionFile, originalEntry });
        } else {
          const { locales } = collectionFile._i18n;

          // File is not yet created
          createDraft({
            collection,
            collectionFile,
            originalEntry: {
              slug: collectionFile.name,
              locales: Object.fromEntries(locales.map((_locale) => [_locale, {}])),
            },
          });
        }

        $announcedPageStatus = $_('editing_x_collection_file', {
          values: {
            collection: collectionLabel,
            file: collectionFile.label || collectionFile.name,
          },
        });
      }
    } else {
      // Folder collection
      if (routeType === 'new' && !subPath && create) {
        createDraft({ collection, dynamicValues: params });

        $announcedPageStatus = $_('creating_x_collection_entry', {
          values: {
            collection: collectionLabel,
          },
        });
      }

      if (routeType === 'entries' && subPath) {
        const originalEntry = $listedEntries.find((entry) => entry.subPath === subPath);

        if (originalEntry) {
          createDraft({ collection, originalEntry });

          $announcedPageStatus = $_('editing_x_collection_entry', {
            values: {
              collection: collectionLabel,
              entry: getEntrySummary($selectedCollection, originalEntry),
            },
          });
        }
      }
    }
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  onhashchange={() => {
    navigate();
  }}
/>

<PageContainer class="content" aria-label={$_('content_library')}>
  {#snippet primarySidebar()}
    <PrimarySidebar />
  {/snippet}
  {#snippet main()}
    <Group
      id="collection-container"
      class="main"
      aria-label={$_('x_collection', {
        values: { collection: $selectedCollection?.label || $selectedCollection?.name },
      })}
      aria-description={$selectedCollection?.description}
    >
      <PageContainerMainArea>
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          <SecondaryToolbar />
        {/snippet}
        {#snippet mainContent()}
          <MainContent />
        {/snippet}
        {#snippet secondarySidebar()}
          <SecondarySidebar />
        {/snippet}
      </PageContainerMainArea>
    </Group>
  {/snippet}
</PageContainer>

<ContentDetailsOverlay />

<Toast bind:show={$contentUpdatesToast.saved}>
  <Alert status="success">
    {$_($contentUpdatesToast.published ? 'entry_saved_and_published' : 'entry_saved')}
  </Alert>
</Toast>

<Toast bind:show={$contentUpdatesToast.deleted}>
  <Alert status="success">
    {$_($contentUpdatesToast.count === 1 ? 'entry_deleted' : 'entries_deleted', {
      values: { count: $contentUpdatesToast.count },
    })}
  </Alert>
</Toast>
