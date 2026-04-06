<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, Menu, MenuItem, Spacer, Toolbar } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { panels } from '$lib/components/settings';
  import PanelContainer from '$lib/components/settings/panel-container.svelte';
  import {
    goBack,
    goto,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';

  const ROUTE_REGEX = /^\/settings(?:\/(?<panelKey>.+))?$/;

  /** @type {{ key: string, icon: string, component: import('svelte').Component } | undefined} */
  let selectedPanel = $state(undefined);

  /**
   * Navigate to the index page or a specific page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const match = path.match(ROUTE_REGEX);

    if (!match?.groups) {
      return; // Different page
    }

    const { panelKey } = match.groups;

    selectedPanel = panelKey ? get(panels).find((panel) => panel.key === panelKey) : undefined;
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, ROUTE_REGEX);
  }}
/>

<PageContainer aria-label={_('settings')}>
  {#snippet main()}
    <PageContainerMainArea>
      {#snippet primaryToolbar()}
        <Toolbar variant="primary">
          {#if selectedPanel}
            <BackButton onclick={() => goBack('/settings')} />
            <h2 role="none">{_(`prefs.${selectedPanel.key}.title`)}</h2>
          {:else}
            <BackButton onclick={() => goBack('/menu')} />
            <h2 role="none">{_('settings')}</h2>
          {/if}
          <Spacer flex />
        </Toolbar>
      {/snippet}
      {#snippet mainContent()}
        <div role="none" class="wrapper">
          {#if selectedPanel}
            <PanelContainer Panel={selectedPanel.component} />
          {:else}
            <Menu aria-label={_('settings')}>
              {#each get(panels) as { key, icon } (key)}
                <MenuItem
                  label={_(`prefs.${key}.title`)}
                  onclick={() => goto(`/settings/${key}`, { transitionType: 'forwards' })}
                >
                  {#snippet startIcon()}
                    <Icon name={icon} />
                  {/snippet}
                </MenuItem>
              {/each}
            </Menu>
          {/if}
        </div>
      {/snippet}
    </PageContainerMainArea>
  {/snippet}
</PageContainer>

<style lang="scss">
  .wrapper {
    overflow-y: auto;
    height: 100%;
    --sui-menu-border-width: 0;
    --sui-menu-border-radius: 0;
    --sui-menu-padding: 8px 0;

    :global {
      & > .container {
        display: block;
        padding: 16px;
      }
    }
  }
</style>
