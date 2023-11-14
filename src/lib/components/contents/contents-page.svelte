<script>
  import { Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import ContentDetailsOverlay from '$lib/components/contents/details/content-details-overlay.svelte';
  import EntryList from '$lib/components/contents/list/entry-list.svelte';
  import FileList from '$lib/components/contents/list/file-list.svelte';
  import PrimarySidebar from '$lib/components/contents/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/contents/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/contents/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/contents/list/secondary-toolbar.svelte';
  import { getCollection, getFile, selectedCollection } from '$lib/services/contents';
  import { contentUpdatesToast } from '$lib/services/contents/data';
  import { createDraft, entryDraft } from '$lib/services/contents/editor';
  import { formatSummary, listedEntries } from '$lib/services/contents/view';
  import { announcedPageTitle, parseLocation } from '$lib/services/navigation';

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

    if (!$selectedCollection) {
      $announcedPageTitle = $_('collection_not_found');

      return; // Not Found
    }

    const {
      name: collectionName,
      label,
      files,
      _i18n: { hasLocales, locales, defaultLocale = 'default' },
    } = $selectedCollection;

    const collectionLabel = label || collectionName;

    if (!_state) {
      const count = $listedEntries.length;

      $announcedPageTitle =
        // eslint-disable-next-line no-nested-ternary
        count > 1
          ? $_('viewing_x_collection_many_entries', {
              values: { collection: collectionLabel, count },
            })
          : count === 1
            ? $_('viewing_x_collection_one_entry')
            : $_('viewing_x_collection_no_entry');

      return;
    }

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

        $announcedPageTitle = $_('editing_x_collection_file', {
          values: {
            collection: collectionLabel,
            file: collectionFile.label || collectionFile.name,
          },
        });
      }
    } else {
      // Folder collection
      if (_state === 'new' && !_id && $selectedCollection.create) {
        createDraft({ collectionName }, params);

        $announcedPageTitle = $_('creating_x_collection_entry', {
          values: {
            collection: collectionLabel,
          },
        });
      }

      if (_state === 'entries' && _id) {
        const selectedEntry = $listedEntries.find(({ slug }) => slug === _id);

        if (selectedEntry) {
          createDraft(selectedEntry);

          $announcedPageTitle = $_('editing_x_collection_entry', {
            values: {
              collection: collectionLabel,
              entry: formatSummary(collection, selectedEntry, defaultLocale, {
                useTemplate: false,
              }),
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

<Toast bind:show={$contentUpdatesToast.saved} type="success">
  {$_('entry_saved')}
</Toast>

<Toast bind:show={$contentUpdatesToast.deleted} type="success">
  {$_($contentUpdatesToast.count === 1 ? 'entry_deleted' : 'entries_deleted', {
    values: { count: $contentUpdatesToast.count },
  })}
</Toast>
