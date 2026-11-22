<!--
  @component
  Administration of the CMS, as opposed to the user’s own settings: the people who can use it and
  how they sign in, with Sveltia CMS Additions, and the CMS configuration. A section is chosen in
  the sidebar, and each has its own path, e.g. `/admin/users`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { onMount, untrack } from 'svelte';

  import MainArea from '$lib/components/admin/main-area.svelte';
  import ConfigPanel from '$lib/components/admin/panels/config-panel.svelte';
  import Sidebar from '$lib/components/admin/sidebar.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { getAdditions, requireAdditions } from '$lib/services/app/additions';
  import {
    ADMIN_PATH,
    getAdminPageAnnouncement,
    getAdminSectionKey,
    getAdminSectionPath,
    getAdminSections,
    lastAdminSectionKey,
  } from '$lib/services/app/admin';
  import {
    announcedPageStatus,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * Component showing each section. Those of Sveltia CMS Additions come with its chunk, which is
   * loaded along with the backend if it’s enabled.
   * @type {Record<string, any>}
   */
  const panels = $derived({
    ...Object.fromEntries(
      (getAdditions()?.adminSections ?? []).map(({ key, component }) => [key, component]),
    ),
    config: ConfigPanel,
  });

  /** Paths of the page, between which Back and Forward move like the other pages. */
  const ADMIN_ROUTE_REGEX = /^\/admin(?:\/|$)/;

  /**
   * Key of the section in the URL: an empty string for the page itself, or `undefined` for a path
   * that goes deeper than a section.
   */
  let sectionKey = $state(getAdminSectionKey(parseLocation().path));

  const sections = $derived(getAdminSections());
  const section = $derived(sections.find(({ key }) => key === sectionKey));

  // Say what’s shown now, as the other pages do. Only the section in the URL matters: the list of
  // sections changing, e.g. with developer mode, isn’t a page change
  $effect(() => {
    const key = sectionKey;

    announcedPageStatus.current = untrack(() =>
      getAdminPageAnnouncement({ sectionKey: key, sections, isSmallScreen: env.isSmallScreen }),
    );
  });

  // Remembered for the Administration button
  $effect(() => {
    if (section) {
      lastAdminSectionKey.current = section.key;
    }
  });

  // On a large screen, the page opens on its first section rather than on an empty area. The page
  // is only offered with at least one section
  $effect(() => {
    if (sectionKey === '' && !env.isSmallScreen) {
      window.location.replace(`#${getAdminSectionPath(sections[0].key)}`);
    }
  });

  onMount(() => {
    // Admins of Sveltia CMS Additions are the ones who update it
    // Their sections are only offered with Sveltia CMS Additions, whose chunk is loaded by then
    if (sections.some(({ key }) => key === 'users')) {
      requireAdditions().checkForUpdate();
    }
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(
      event,
      () => {
        sectionKey = getAdminSectionKey(parseLocation().path);
      },
      ADMIN_ROUTE_REGEX,
    );
  }}
/>

<PageContainer uiSettingsKey="admin-page" aria-label={_('administration')}>
  {#snippet primarySidebar()}
    {#if !env.isSmallScreen || sectionKey === ''}
      <Sidebar {sections} selectedKey={sectionKey} />
    {/if}
  {/snippet}
  {#snippet main()}
    {#if section}
      {@const Panel = panels[section.key]}
      <Panel title={_(section.labelKey)} />
    {:else if sectionKey !== ''}
      <MainArea title={_('page_not_found')}>
        <NotFound message={_('page_not_found')} backPath={ADMIN_PATH} />
      </MainArea>
    {/if}
  {/snippet}
</PageContainer>
