import { _, locale as appLocale } from '@sveltia/i18n';

import { announcedPageStatus, goto, parseLocation } from '$lib/services/app/navigation';
import {
  getCollection,
  getCollectionLabel,
  getFirstCollection,
  getSingletonCollection,
  getValidCollections,
  selectedCollection,
} from '$lib/services/contents/collection';
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
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { InternalCollection } from '$lib/types/private';
 */

/**
 * What the Content Library page shows for the current route.
 * @typedef {object} ContentsRouteState
 * @property {boolean} isIndexPage Whether the page shows the collection list only, on a small
 * screen.
 * @property {boolean} isSearchPage Whether the page shows the search results.
 * @property {string} notFoundKey Message key shown on the Not Found view, or an empty string when
 * the route resolved.
 * @property {boolean} awaitingDrafts Whether the route can’t be resolved until the Editorial
 * Workflow drafts are in, which happens after the initial data load. The route should be tried
 * again once they are.
 * @property {string} [editorLocale] Locale to open the editor in, given in the URL params, e.g.
 * `?_locale=fr`.
 */

/**
 * Regular expression matching the routes of the Content Library page.
 */
export const CONTENTS_ROUTE_REGEX =
  /^\/collections(?:\/(?<_collectionName>[^/]+)(?:\/(?<routeType>new|entries|filter))?(?:\/(?<subPath>.+?))?)?$/;

/**
 * Resolve the current URL hash to what the Content Library page shows: the collection list, a
 * collection’s entries, the search results, or the content editor with the addressed entry loaded
 * into the given draft. The stores that the page and its parts read are updated along the way.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Draft open in the content editor overlay.
 * @returns {ContentsRouteState} What the page shows.
 */
export const resolveContentsRoute = ({ entryDraft }) => {
  const { path, params } = parseLocation();
  const match = path.match(CONTENTS_ROUTE_REGEX);

  /** @type {ContentsRouteState} */
  const state = {
    isIndexPage: false,
    isSearchPage: false,
    notFoundKey: '',
    awaitingDrafts: false,
    editorLocale: params._locale,
  };

  delete params._locale;

  // `/collections/_singletons` should not be used unless there is only the singleton collection
  if (selectedCollection.current?.name === '_singletons' && getValidCollections().length) {
    selectedCollection.current = undefined;
  }

  if (!match?.groups) {
    showContentOverlay.current = false;

    // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
    return { ...state, isSearchPage: isSearchRoute(path) }; // Different page
  }

  const { _collectionName, routeType, subPath } = match.groups;

  if (!_collectionName) {
    if (env.isSmallScreen) {
      // Show the collection list only
      selectedCollection.current = undefined;
      showContentOverlay.current = false;
      announcedPageStatus.current = _('viewing_collection_list');

      return { ...state, isIndexPage: true };
    }

    // Redirect to the selected, first or singleton collection
    const collection =
      selectedCollection.current || getFirstCollection() || getSingletonCollection();

    goto(`/collections/${collection?.name}`, { replaceState: true });

    return state;
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

    return { ...state, notFoundKey: 'collection_not_found' };
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

    return { ...state, notFoundKey: 'page_not_found' };
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
      announcedPageStatus.current = _('loading');

      return { ...state, awaitingDrafts: true };
    }

    // The URL names a folder that no entry lives in, or a collection with no folders at all
    announcedPageStatus.current = _('page_not_found');

    return { ...state, notFoundKey: 'page_not_found' };
  }

  // A nested collection’s folder is browsed at `/collections/{name}/filter/{path}`, while the
  // collection route itself always shows the root folder. The editor routes leave the folder
  // alone, so closing the editor returns the user to where they were.
  if (!routeType || routeType === 'filter') {
    nestedFilterPath.current = routeType === 'filter' ? (subPath ?? '') : '';
    showContentOverlay.current = false;
    announcedPageStatus.current = _('viewing_x_collection', {
      values: { collection: collectionLabel, count: listedEntries.current.length },
    });

    return state;
  }

  showContentOverlay.current = true;

  // An entry opened with a deep link can’t be resolved until the drafts are in either. Show a
  // loading state in the meantime
  if (routeType === 'entries' && subPath && !workflowDataReady.current) {
    announcedPageStatus.current = _('loading_entries', { values: { count: 1 } });

    return { ...state, awaitingDrafts: true };
  }

  if (_fileMap) {
    // File/singleton collection
    if (routeType !== 'entries' || !subPath) {
      // A file collection has no `new` route, and `entries` needs a file name
      entryDraft.current = undefined;
      announcedPageStatus.current = _('file_not_found');

      return state;
    }

    const collectionFile = _fileMap[subPath];

    if (!collectionFile) {
      // The URL names a file that isn’t part of this collection
      entryDraft.current = undefined;
      announcedPageStatus.current = _('file_not_found');

      return state;
    }

    // An unpublished entry takes precedence over the published version, so the user can keep
    // editing the draft stored in the pull request
    const originalEntry = getUnpublishedEntry({ collectionName, subPath }) ??
      getCollectionFileEntry(collectionName, subPath) ??
        // File is not yet created
        {
          slug: collectionFile.name,
          locales: Object.fromEntries(
            collectionFile._i18n.initialLocales.map((_locale) => [_locale, {}]),
          ),
        };

    createDraft({ entryDraft, collection, collectionFile, originalEntry });

    announcedPageStatus.current = _(`edit_${collection._type}_announcement`, {
      values: { collection: collectionLabel, file: getCollectionFileLabel(collectionFile) },
    });

    return state;
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
      values: { collection: collectionLabel },
    });

    return state;
  }

  if (routeType === 'entries' && subPath) {
    const originalEntry =
      getUnpublishedEntry({ collectionName, subPath }) ??
      // Not `listedEntries`, which a nested collection limits to the folder being browsed,
      // while an entry can also be opened with a deep link
      getEntriesByCollection(collectionName).find((entry) => entry.subPath === subPath);

    if (!originalEntry) {
      entryDraft.current = undefined;
      announcedPageStatus.current = _('entry_not_found');

      return state;
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

    return state;
  }

  // `new` with a sub path or `entries` without one, e.g. `#/collections/posts/new/foo`
  entryDraft.current = undefined;
  announcedPageStatus.current = _('entry_not_found');

  return state;
};
