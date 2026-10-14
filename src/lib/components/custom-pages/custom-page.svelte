<!--
  @component
  Render a custom page registered via `CMS.registerCustomPage()`: a React component, or a web page
  embedded in an iframe.
  @see https://sveltiacms.app/en/docs/api/custom-pages
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Spacer, Toolbar } from '@sveltia/ui';
  import { createElement } from 'react';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { getReactDom, loadReactDom } from '$lib/services/api/react-dom';
  import { selectedCustomPage } from '$lib/services/app/custom-pages';
  import { announcedPageStatus, goBack } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { ComponentType } from 'react';
   * @import { Attachment } from 'svelte/attachments';
   */

  const page = $derived(selectedCustomPage.current);
  // A page that opens in a new tab has nothing to show here, so its route is a dead link too
  const shownPage = $derived(page && !page.newTab ? page : undefined);
  const label = $derived(shownPage?.label ?? _('page_not_found'));
  // The component on its own, so the page registered again with only a new label, for example,
  // keeps the rendered component and its state rather than mounting it anew
  const pageComponent = $derived(shownPage?.component);

  /**
   * Create an attachment rendering the given React component in the element, which is unmounted
   * along with the element, or when another component is given.
   * @param {ComponentType} component React component.
   * @returns {Attachment<HTMLElement>} Attachment.
   */
  const renderComponent = (component) => (element) => {
    /** @type {import('react-dom/client').Root | undefined} */
    let root;
    let detached = false;

    // `CMS.registerCustomPage()` starts loading the library, so it’s normally there by now
    loadReactDom().then(
      () => {
        if (!detached) {
          root = getReactDom().createRoot(element);
          root.render(createElement(component));
        }
      },
      /* v8 ignore next 4 -- the library is bundled with the tests, so loading can’t fail */
      (/** @type {Error} */ error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      },
    );

    return () => {
      detached = true;
      root?.unmount();
    };
  };

  $effect(() => {
    if (!shownPage) {
      announcedPageStatus.current = _('page_not_found');
    }
  });
</script>

<PageContainer aria-label={label}>
  {#snippet main()}
    <PageContainerMainArea aria-label={label}>
      {#snippet primaryToolbar()}
        <Toolbar variant="primary">
          {#if env.isSmallScreen}
            <BackButton onclick={() => goBack('/menu')} />
          {/if}
          <h2 role="none">{label}</h2>
          <Spacer flex />
        </Toolbar>
      {/snippet}
      {#snippet mainContent()}
        {#if !shownPage}
          <NotFound message={_('page_not_found')} />
        {:else if pageComponent}
          <div role="none" class="content" {@attach renderComponent(pageComponent)}></div>
        {:else}
          <iframe src={shownPage.url} title={shownPage.label}></iframe>
        {/if}
      {/snippet}
    </PageContainerMainArea>
  {/snippet}
</PageContainer>

<style>
  .content {
    flex: auto;
    overflow: auto;
  }

  iframe {
    flex: auto;
    border: 0;
    width: 100%;
  }
</style>
