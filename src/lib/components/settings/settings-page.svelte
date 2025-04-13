<script>
  import { Alert, Icon, Menu, MenuItem, Spacer, Toast, Toolbar } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { panels } from '$lib/components/settings';
  import {
    goBack,
    goto,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';

  const routeRegex = /^\/settings(?:\/(?<panelKey>.+))?$/;

  /** @type {{ key: string, icon: string, component: import('svelte').Component } | undefined} */
  let selectedPanel = $state(undefined);
  let toastMessage = $state('');
  let showToast = $state(false);

  /**
   * Navigate to the index page or a specific page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const match = path.match(routeRegex);

    if (!match?.groups) {
      return; // Different page
    }

    const { panelKey } = match.groups;

    selectedPanel = panelKey ? panels.find((panel) => panel.key === panelKey) : undefined;
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, routeRegex);
  }}
/>

<PageContainer aria-label={$_('settings')}>
  {#snippet main()}
    <PageContainerMainArea>
      {#snippet primaryToolbar()}
        <Toolbar variant="primary">
          {#if selectedPanel}
            <BackButton onclick={() => goBack('/settings')} />
            <h2 role="none">{$_(`prefs.${selectedPanel.key}.title`)}</h2>
          {:else}
            <BackButton onclick={() => goBack('/menu')} />
            <h2 role="none">{$_('settings')}</h2>
          {/if}
          <Spacer flex />
        </Toolbar>
      {/snippet}
      {#snippet mainContent()}
        <div role="none" class="wrapper">
          {#if selectedPanel}
            {@const Content = selectedPanel.component}
            <div role="none" class="inner">
              <Content
                onChange={(/** @type {{ message: string }} */ { message }) => {
                  toastMessage = message;
                  showToast = true;
                }}
              />
            </div>
          {:else}
            <Menu aria-label={$_('settings')}>
              {#each panels as { key, icon } (key)}
                <MenuItem
                  label={$_(`prefs.${key}.title`)}
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

<Toast bind:show={showToast}>
  <Alert status="success">{toastMessage}</Alert>
</Toast>

<style lang="scss">
  .wrapper {
    overflow-y: auto;
    height: 100%;
    --sui-menu-border-width: 0;
    --sui-menu-border-radius: 0;
    --sui-menu-padding: 8px 0;

    .inner {
      padding: 16px;

      :global {
        section:not(:first-child) {
          margin: 16px 0 0;
        }

        p {
          margin-top: 0;
        }

        h4 {
          font-size: inherit;

          & ~ div {
            margin: 8px 0 0;
          }

          & ~ p {
            margin: 8px 0 0;
            color: var(--sui-secondary-foreground-color);
            font-size: var(--sui-font-size-small);
          }
        }
      }
    }
  }
</style>
