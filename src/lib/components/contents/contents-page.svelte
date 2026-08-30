<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import ContentDetailsOverlay from '$lib/components/contents/details/content-details-overlay.svelte';
  import EntryList from '$lib/components/contents/list/entry-list.svelte';
  import FileList from '$lib/components/contents/list/file-list.svelte';
  import PrimarySidebar from '$lib/components/contents/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/contents/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/contents/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/contents/list/secondary-toolbar.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import SearchMainArea from '$lib/components/search/search-main-area.svelte';
  import {
    announcedPageStatus,
    goto,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';
  import {
    getCollection,
    getCollectionLabel,
    getFirstCollection,
    getSingletonCollection,
    getValidCollections,
    selectedCollection,
  } from '$lib/services/contents/collection';
  import { contentUpdatesToast } from '$lib/services/contents/collection/data';
  import {
    getCollectionFileEntry,
    getCollectionFileLabel,
  } from '$lib/services/contents/collection/files';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { entryDraft } from '$lib/services/contents/draft';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { showContentOverlay } from '$lib/services/contents/editor';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { isSearchRoute } from '$lib/services/search/navigation';
  import { env } from '$lib/services/user/env.svelte';
  import { getUnpublishedEntry, workflowDataReady } from '$lib/services/workflow';

  /**
   * @import { InternalCollection } from '$lib/types/private';
   */

  const ROUTE_REGEX =
    /^\/collections(?:\/(?<_collectionName>[^/]+)(?:\/(?<routeType>new|entries))?(?:\/(?<subPath>.+?))?)?$/;

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);
  /** Message key shown on the Not Found view, or an empty string when the route resolved. */
  let notFoundKey = $state('');
  let loadingEntry = $state(false);
  let editorLocale = $state();

  const MainContent = $derived('files' in ($selectedCollection ?? {}) ? FileList : EntryList);

  /**
   * Navigate to the content list or content details page given the URL hash.
   */
  const navigate = () => {
    const { path, params } = parseLocation();
    const match = path.match(ROUTE_REGEX);

    isIndexPage = false;
    isSearchPage = false;
    notFoundKey = '';
    loadingEntry = false;

    // Set the editor locale if specified in the URL params, e.g., `?_locale=fr`
    editorLocale = params._locale;
    delete params._locale;

    // `/collections/_singletons` should not be used unless there is only the singleton collection
    if ($selectedCollection?.name === '_singletons' && getValidCollections().length) {
      $selectedCollection = undefined;
    }

    if (!match?.groups) {
      $showContentOverlay = false;
      // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
      isSearchPage = isSearchRoute(path);

      return; // Different page
    }

    const { _collectionName, routeType, subPath } = match.groups;

    if (!_collectionName) {
      if (env.isSmallScreen) {
        // Show the collection list only
        $selectedCollection = undefined;
        $showContentOverlay = false;
        $announcedPageStatus = _('viewing_collection_list');
        isIndexPage = true;
      } else {
        // Redirect to the selected, first or singleton collection
        const collection = $selectedCollection || getFirstCollection() || getSingletonCollection();

        goto(`/collections/${collection?.name}`, { replaceState: true });
      }

      return;
    }

    /** @type {InternalCollection | undefined} */
    const collection = getCollection(_collectionName);

    if (!collection || collection.hide) {
      $selectedCollection = undefined;
    } else if ($selectedCollection?.name !== collection.name) {
      $selectedCollection = collection;
    }

    if (!collection || !$selectedCollection) {
      $showContentOverlay = false;
      $announcedPageStatus = _('collection_not_found');
      notFoundKey = 'collection_not_found';

      return; // Not Found
    }

    const { name: collectionName } = $selectedCollection;
    const collectionLabel = getCollectionLabel($selectedCollection);
    const _fileMap = '_fileMap' in $selectedCollection ? $selectedCollection._fileMap : undefined;

    if (!routeType) {
      if (subPath) {
        // A collection route takes no path of its own, so anything between the collection name and
        // an `entries`/`new` segment is a dead link, e.g. `#/collections/pages/foo/ever`
        $showContentOverlay = false;
        $announcedPageStatus = _('page_not_found');
        notFoundKey = 'page_not_found';

        return; // Not Found
      }

      $showContentOverlay = false;
      $announcedPageStatus = _('viewing_x_collection', {
        values: {
          collection: collectionLabel,
          count: $listedEntries.length,
        },
      });

      return;
    }

    $showContentOverlay = true;

    // An entry opened with a deep link can’t be resolved until the Editorial Workflow drafts have
    // been fetched, which happens after the initial data load. Show a loading state and try again
    // once they’re in; the effect below re-runs this function.
    if (routeType === 'entries' && subPath && !$workflowDataReady) {
      loadingEntry = true;
      $announcedPageStatus = _('loading_entries', { values: { count: 1 } });

      return;
    }

    if (_fileMap) {
      // File/singleton collection
      if (routeType === 'entries' && subPath) {
        const collectionFile = _fileMap[subPath];

        if (!collectionFile) {
          // The URL names a file that isn’t part of this collection
          $entryDraft = undefined;
          $announcedPageStatus = _('file_not_found');

          return; // Not Found
        }

        // An unpublished entry takes precedence over the published version, so the user can keep
        // editing the draft stored in the pull request
        const originalEntry =
          getUnpublishedEntry({ collectionName, subPath }) ??
          getCollectionFileEntry(collectionName, subPath);

        if (originalEntry) {
          createDraft({ collection, collectionFile, originalEntry });
        } else {
          // File is not yet created
          createDraft({
            collection,
            collectionFile,
            originalEntry: {
              slug: collectionFile.name,
              locales: Object.fromEntries(
                collectionFile._i18n.initialLocales.map((_locale) => [_locale, {}]),
              ),
            },
          });
        }

        $announcedPageStatus = _(`edit_${collection._type}_announcement`, {
          values: {
            collection: collectionLabel,
            file: getCollectionFileLabel(collectionFile),
          },
        });
      } else {
        // A file collection has no `new` route, and `entries` needs a file name
        $entryDraft = undefined;
        $announcedPageStatus = _('file_not_found');
      }

      return;
    }

    // Entry collection
    if (routeType === 'new' && !subPath) {
      createDraft({
        collection,
        dynamicValues: params,
        isIndexFile: !!window.history.state?.index,
      });

      $announcedPageStatus = _('create_entry_announcement', {
        values: {
          collection: collectionLabel,
        },
      });
    } else if (routeType === 'entries' && subPath) {
      const originalEntry =
        getUnpublishedEntry({ collectionName, subPath }) ??
        $listedEntries.find((entry) => entry.subPath === subPath);

      if (!originalEntry) {
        $entryDraft = undefined;
        $announcedPageStatus = _('entry_not_found');

        return; // Not Found
      }

      if (appLocale.current) {
        createDraft({ collection, originalEntry });

        $announcedPageStatus = _('edit_entry_announcement', {
          values: {
            collection: collectionLabel,
            entry: getEntrySummary($selectedCollection, originalEntry),
          },
        });
      }
    } else {
      // `new` with a sub path or `entries` without one, e.g. `#/collections/posts/new/foo`
      $entryDraft = undefined;
      $announcedPageStatus = _('entry_not_found');
    }
  };

  onMount(() => {
    navigate();

    return () => {
      $showContentOverlay = false;
    };
  });

  $effect(() => {
    if (loadingEntry && $workflowDataReady) {
      navigate();
    }
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, ROUTE_REGEX);
  }}
/>

<PageContainer uiSettingsKey="contents-page" aria-label={_('content_library')}>
  {#snippet primarySidebar()}
    {#if !env.isSmallScreen || isIndexPage}
      <PrimarySidebar {isSearchPage} />
    {/if}
  {/snippet}
  {#snippet main()}
    {#if isSearchPage}
      <SearchMainArea />
    {:else if notFoundKey}
      <PageContainerMainArea aria-label={_('content_library')}>
        {#snippet mainContent()}
          <NotFound message={_(notFoundKey)} />
        {/snippet}
      </PageContainerMainArea>
    {:else if !env.isSmallScreen || !isIndexPage}
      <PageContainerMainArea
        aria-label={_('x_collection', {
          values: {
            collection:
              // `appLocale.current` is a key, because `getCollectionLabel` can return a localized
              // label
              appLocale.current && $selectedCollection
                ? getCollectionLabel($selectedCollection)
                : '',
          },
        })}
        aria-description={$selectedCollection?.description}
      >
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          {#if $selectedCollection?._type === 'entry' && $listedEntries.length}
            <SecondaryToolbar />
          {/if}
        {/snippet}
        {#snippet mainContent()}
          <MainContent />
        {/snippet}
        {#snippet secondarySidebar()}
          <SecondarySidebar />
        {/snippet}
      </PageContainerMainArea>
    {/if}
  {/snippet}
</PageContainer>

{#if $showContentOverlay}
  <ContentDetailsOverlay {editorLocale} loading={loadingEntry} />
{/if}

<Toast bind:show={$contentUpdatesToast.saved}>
  <Alert status="success">
    {_($contentUpdatesToast.published ? 'entry_saved_and_published' : 'entry_saved', {
      values: { count: $contentUpdatesToast.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={$contentUpdatesToast.deletionCancelled}>
  <Alert status="success">{_('workflow.deletion_cancelled')}</Alert>
</Toast>

<Toast bind:show={$contentUpdatesToast.discarded}>
  <Alert status="success">
    {_('workflow.changes_discarded', { values: { count: $contentUpdatesToast.count } })}
  </Alert>
</Toast>

<Toast bind:show={$contentUpdatesToast.deleted}>
  <Alert status="success">
    {_($contentUpdatesToast.deletionPending ? 'workflow.deletion_pending' : 'entries_deleted', {
      values: { count: $contentUpdatesToast.count },
    })}
  </Alert>
</Toast>
