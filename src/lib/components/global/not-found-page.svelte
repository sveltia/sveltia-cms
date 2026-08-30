<script>
  import { _ } from '@sveltia/i18n';
  import { onMount } from 'svelte';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';

  onMount(() => {
    $announcedPageStatus = _('page_not_found');
  });
</script>

<PageContainer aria-label={_('page_not_found')}>
  {#snippet main()}
    <PageContainerMainArea>
      {#snippet mainContent()}
        <NotFound message={_('page_not_found')} />
      {/snippet}
    </PageContainerMainArea>
  {/snippet}
</PageContainer>
