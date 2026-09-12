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
  import { updateContentFromHashChange } from '$lib/services/app/navigation';
  import { getCollectionLabel, selectedCollection } from '$lib/services/contents/collection';
  import { contentUpdatesToast } from '$lib/services/contents/collection/data';
  import { listedEntries } from '$lib/services/contents/collection/view';
  import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
  import { showContentOverlay } from '$lib/services/contents/editor';
  import { CONTENTS_ROUTE_REGEX, resolveContentsRoute } from '$lib/services/contents/navigation';
  import { env } from '$lib/services/user/env.svelte';
  import { workflowDataReady } from '$lib/services/workflow';

  /**
   * Draft open in the content editor overlay, if any.
   */
  const entryDraft = new EntryDraftState();

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);
  /** Message key shown on the Not Found view, or an empty string when the route resolved. */
  let notFoundKey = $state('');
  /**
   * Whether the route can’t be resolved until the Editorial Workflow drafts are in. The route is
   * tried again once they are; the effect below re-runs {@link navigate}.
   */
  let awaitingDrafts = $state(false);
  /** @type {string | undefined} */
  let editorLocale = $state();

  const MainContent = $derived(
    'files' in (selectedCollection.current ?? {}) ? FileList : EntryList,
  );

  /**
   * Navigate to the content list or content details page given the URL hash.
   */
  const navigate = () => {
    ({ isIndexPage, isSearchPage, notFoundKey, awaitingDrafts, editorLocale } =
      resolveContentsRoute({ entryDraft }));
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
    updateContentFromHashChange(event, navigate, CONTENTS_ROUTE_REGEX);
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
