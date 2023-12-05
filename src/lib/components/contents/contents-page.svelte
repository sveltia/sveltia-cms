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
  import { getCollection, getFile, selectedCollection } from '$lib/services/contents';
  import { contentUpdatesToast } from '$lib/services/contents/data';
  import { createDraft, entryDraft } from '$lib/services/contents/editor';
  import { formatSummary, listedEntries } from '$lib/services/contents/view';
  import { announcedPageStatus, parseLocation } from '$lib/services/navigation';

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
      $announcedPageStatus = $_('collection_not_found');

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

      $announcedPageStatus = $_(
        // eslint-disable-next-line no-nested-ternary
        count > 1
          ? 'viewing_x_collection_many_entries'
          : count === 1
            ? 'viewing_x_collection_one_entry'
            : 'viewing_x_collection_no_entry',
        { values: { collection: collectionLabel, count } },
      );

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

        $announcedPageStatus = $_('editing_x_collection_file', {
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

        $announcedPageStatus = $_('creating_x_collection_entry', {
          values: {
            collection: collectionLabel,
          },
        });
      }

      if (_state === 'entries' && _id) {
        const selectedEntry = $listedEntries.find(({ slug }) => slug === _id);

        if (selectedEntry) {
          createDraft(selectedEntry);

          $announcedPageStatus = $_('editing_x_collection_entry', {
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

<PageContainer class="content" aria-label={$_('content_library')}>
  <PrimarySidebar slot="primary_sidebar" />
  <Group
    slot="main"
    id="collection-container"
    class="main"
    aria-label={$_('x_collection', {
      values: { collection: $selectedCollection.label || $selectedCollection.name },
    })}
    aria-description={$selectedCollection.description}
  >
    <PageContainerMainArea>
      <PrimaryToolbar slot="primary_toolbar" />
      <SecondaryToolbar slot="secondary_toolbar" />
      <svelte:component
        this={$selectedCollection.files ? FileList : EntryList}
        slot="main_content"
      />
      <SecondarySidebar slot="secondary_sidebar" />
    </PageContainerMainArea>
  </Group>
</PageContainer>

{#if $entryDraft}
  <ContentDetailsOverlay />
{/if}

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
