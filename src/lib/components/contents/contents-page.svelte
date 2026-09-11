<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';
  import { onMount, untrack } from 'svelte';

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
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import {
    getCollectionFileEntry,
    getCollectionFileLabel,
  } from '$lib/services/contents/collection/files';
  import {
    getMetaPathConfig,
    isNestedFolder,
    nestedFilterPath,
  } from '$lib/services/contents/collection/nested';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
  import { showContentOverlay } from '$lib/services/contents/editor';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { isSearchRoute } from '$lib/services/search/navigation';
  import { env } from '$lib/services/user/env.svelte';
  import {
    getUnpublishedEntriesByCollection,
    getUnpublishedEntry,
    mergeUnpublishedEntries,
    workflowDataReady,
  } from '$lib/services/workflow';

  /**
   * @import { InternalCollection } from '$lib/types/private';
   */

  const ROUTE_REGEX =
    /^\/collections(?:\/(?<_collectionName>[^/]+)(?:\/(?<routeType>new|entries|filter))?(?:\/(?<subPath>.+?))?)?$/;

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);
  /** Message key shown on the Not Found view, or an empty string when the route resolved. */
  let notFoundKey = $state('');
  /**
   * Whether the route can’t be resolved until the Editorial Workflow drafts are in, which happens
   * after the initial data load. The route is tried again once they are; the effect below re-runs
   * {@link navigate}.
   */
  let awaitingDrafts = $state(false);
  let editorLocale = $state();

  /**
   * Draft open in the content editor overlay, if any.
   */
  const entryDraft = new EntryDraftState();

  const MainContent = $derived(
    'files' in (selectedCollection.current ?? {}) ? FileList : EntryList,
  );

  /**
   * Navigate to the content list or content details page given the URL hash.
   */
  const navigate = () => {
    const { path, params } = parseLocation();
    const match = path.match(ROUTE_REGEX);

    isIndexPage = false;
    isSearchPage = false;
    notFoundKey = '';
    awaitingDrafts = false;

    // Set the editor locale if specified in the URL params, e.g., `?_locale=fr`
    editorLocale = params._locale;
    delete params._locale;

    // `/collections/_singletons` should not be used unless there is only the singleton collection
    if (selectedCollection.current?.name === '_singletons' && getValidCollections().length) {
      selectedCollection.current = undefined;
    }

    if (!match?.groups) {
      showContentOverlay.current = false;
      // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
      isSearchPage = isSearchRoute(path);

      return; // Different page
    }

    const { _collectionName, routeType, subPath } = match.groups;

    if (!_collectionName) {
      if (env.isSmallScreen) {
        // Show the collection list only
        selectedCollection.current = undefined;
        showContentOverlay.current = false;
        announcedPageStatus.current = _('viewing_collection_list');
        isIndexPage = true;
      } else {
        // Redirect to the selected, first or singleton collection
        const collection =
          selectedCollection.current || getFirstCollection() || getSingletonCollection();

        goto(`/collections/${collection?.name}`, { replaceState: true });
      }

      return;
    }

    /** @type {InternalCollection | undefined} */
    const collection = getCollection(_collectionName);

    if (!collection || collection.hide) {
      selectedCollection.current = undefined;
    } else if (selectedCollection.current?.name !== collection.name) {
      selectedCollection.current = collection;
      // The folder being browsed belongs to the collection it was opened from, so it can’t carry
      // over to another one — a new entry would be created in a folder of the previous collection
      nestedFilterPath.current = '';
    }

    if (!collection || !selectedCollection.current) {
      showContentOverlay.current = false;
      announcedPageStatus.current = _('collection_not_found');
      notFoundKey = 'collection_not_found';

      return; // Not Found
    }

    const { name: collectionName } = selectedCollection.current;
    const collectionLabel = getCollectionLabel(selectedCollection.current);

    const _fileMap =
      '_fileMap' in selectedCollection.current ? selectedCollection.current._fileMap : undefined;

    if (!routeType && subPath) {
      // A collection route takes no path of its own, so anything between the collection name and
      // an `entries`/`new`/`filter` segment is a dead link, e.g. `#/collections/pages/foo/ever`
      showContentOverlay.current = false;
      announcedPageStatus.current = _('page_not_found');
      notFoundKey = 'page_not_found';

      return; // Not Found
    }

    if (
      routeType === 'filter' &&
      !isNestedFolder({
        collection,
        // A folder that only exists in a pull request is listed in the sidebar tree, so it has to
        // open from there as well
        entries: mergeUnpublishedEntries(
          getEntriesByCollection(collectionName),
          getUnpublishedEntriesByCollection(collectionName),
        ),
        dirPath: subPath ?? '',
      })
    ) {
      showContentOverlay.current = false;

      // The folder may live in a draft that hasn’t been fetched yet, as when the page is reloaded
      // while browsing it. Only an absent folder has to wait: one the published entries hold is
      // resolved right away
      if (!workflowDataReady.current) {
        awaitingDrafts = true;
        announcedPageStatus.current = _('loading');

        return;
      }

      // The URL names a folder that no entry lives in, or a collection with no folders at all
      announcedPageStatus.current = _('page_not_found');
      notFoundKey = 'page_not_found';

      return; // Not Found
    }

    // A nested collection’s folder is browsed at `/collections/{name}/filter/{path}`, while the
    // collection route itself always shows the root folder. The editor routes leave the folder
    // alone, so closing the editor returns the user to where they were.
    if (routeType === 'filter' || !routeType) {
      nestedFilterPath.current = routeType === 'filter' ? (subPath ?? '') : '';
    }

    if (!routeType || routeType === 'filter') {
      showContentOverlay.current = false;
      announcedPageStatus.current = _('viewing_x_collection', {
        values: {
          collection: collectionLabel,
          count: listedEntries.current.length,
        },
      });

      return;
    }

    showContentOverlay.current = true;

    // An entry opened with a deep link can’t be resolved until the drafts are in either. Show a
    // loading state in the meantime
    if (routeType === 'entries' && subPath && !workflowDataReady.current) {
      awaitingDrafts = true;
      announcedPageStatus.current = _('loading_entries', { values: { count: 1 } });

      return;
    }

    if (_fileMap) {
      // File/singleton collection
      if (routeType === 'entries' && subPath) {
        const collectionFile = _fileMap[subPath];

        if (!collectionFile) {
          // The URL names a file that isn’t part of this collection
          entryDraft.current = undefined;
          announcedPageStatus.current = _('file_not_found');

          return; // Not Found
        }

        // An unpublished entry takes precedence over the published version, so the user can keep
        // editing the draft stored in the pull request
        const originalEntry =
          getUnpublishedEntry({ collectionName, subPath }) ??
          getCollectionFileEntry(collectionName, subPath);

        if (originalEntry) {
          createDraft({ entryDraft, collection, collectionFile, originalEntry });
        } else {
          // File is not yet created
          createDraft({
            entryDraft,
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

        announcedPageStatus.current = _(`edit_${collection._type}_announcement`, {
          values: {
            collection: collectionLabel,
            file: getCollectionFileLabel(collectionFile),
          },
        });
      } else {
        // A file collection has no `new` route, and `entries` needs a file name
        entryDraft.current = undefined;
        announcedPageStatus.current = _('file_not_found');
      }

      return;
    }

    // Entry collection
    if (routeType === 'new' && !subPath) {
      // Decap CMS passes the folder for a new entry in a nested collection as `?path=`
      const initialPath = getMetaPathConfig(collection) ? params.path : undefined;

      if (initialPath !== undefined) {
        delete params.path;
      }

      createDraft({
        entryDraft,
        collection,
        dynamicValues: params,
        initialPath,
        isIndexFile: !!window.history.state?.index,
      });

      announcedPageStatus.current = _('create_entry_announcement', {
        values: {
          collection: collectionLabel,
        },
      });
    } else if (routeType === 'entries' && subPath) {
      const originalEntry =
        getUnpublishedEntry({ collectionName, subPath }) ??
        // Not `listedEntries`, which a nested collection limits to the folder being browsed,
        // while an entry can also be opened with a deep link
        getEntriesByCollection(collectionName).find((entry) => entry.subPath === subPath);

      if (!originalEntry) {
        entryDraft.current = undefined;
        announcedPageStatus.current = _('entry_not_found');

        return; // Not Found
      }

      if (appLocale.current) {
        createDraft({ entryDraft, collection, originalEntry });

        announcedPageStatus.current = _('edit_entry_announcement', {
          values: {
            collection: collectionLabel,
            entry: getEntrySummary(selectedCollection.current, originalEntry),
          },
        });
      }
    } else {
      // `new` with a sub path or `entries` without one, e.g. `#/collections/posts/new/foo`
      entryDraft.current = undefined;
      announcedPageStatus.current = _('entry_not_found');
    }
  };

  onMount(() => {
    navigate();

    return () => {
      showContentOverlay.current = false;
    };
  });

  $effect(() => {
    if (awaitingDrafts && workflowDataReady.current) {
      // Opening an entry reads and replaces the draft, which is no reason to navigate again
      untrack(() => navigate());
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
              appLocale.current && selectedCollection.current
                ? getCollectionLabel(selectedCollection.current)
                : '',
          },
        })}
        aria-description={selectedCollection.current?.description}
      >
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          {#if selectedCollection.current?._type === 'entry' && listedEntries.current.length}
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

{#if showContentOverlay.current}
  <ContentDetailsOverlay {entryDraft} {editorLocale} loading={awaitingDrafts} />
{/if}

<Toast bind:show={contentUpdatesToast.current.saved}>
  <Alert status="success">
    {_(contentUpdatesToast.current.published ? 'entry_saved_and_published' : 'entry_saved', {
      values: { count: contentUpdatesToast.current.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.deletionCancelled}>
  <Alert status="success">{_('workflow.deletion_cancelled')}</Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.discarded}>
  <Alert status="success">
    {_('workflow.changes_discarded', { values: { count: contentUpdatesToast.current.count } })}
  </Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.deleted}>
  <Alert status="success">
    {_(
      contentUpdatesToast.current.deletionPending ? 'workflow.deletion_pending' : 'entries_deleted',
      {
        values: { count: contentUpdatesToast.current.count },
      },
    )}
  </Alert>
</Toast>
