<script>
  import { Dialog, Icon, Tab, TabList } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AdvancedPanel from '$lib/components/prefs/panels/advanced-panel.svelte';
  import AppearancePanel from '$lib/components/prefs/panels/appearance-panel.svelte';
  import LanguagesPanel from '$lib/components/prefs/panels/languages-panel.svelte';
  import MediaPanel from '$lib/components/prefs/panels/media-panel.svelte';

  /**
   * Whether to open the dialog.
   */
  export let open = false;

  let selectedPanel = 'appearance';

  $: panels = [
    { key: 'appearance', icon: 'palette', component: AppearancePanel },
    { key: 'languages', icon: 'language', component: LanguagesPanel },
    { key: 'media', icon: 'photo_library', component: MediaPanel },
    { key: 'advanced', icon: 'build', component: AdvancedPanel },
  ];
</script>

<Dialog
  title={$_('settings')}
  bind:open
  showOk={false}
  showCancel={false}
  showClose={true}
  on:close
>
  <div role="none" class="wrapper">
    <TabList orientation="vertical" aria-label={$_('categories')}>
      {#each panels as { key, icon } (key)}
        <Tab
          label={$_(`prefs.${key}.title`)}
          selected={key === selectedPanel}
          aria-controls="prefs-tab-{key}"
          on:select={() => {
            selectedPanel = key;
          }}
        >
          <Icon slot="start-icon" name={icon} />
        </Tab>
      {/each}
    </TabList>
    {#each panels as { key, component } (key)}
      <svelte:component this={component} />
    {/each}
  </div>
</Dialog>

<style lang="scss">
  .wrapper {
    display: flex;

    :global(.tab-list) {
      flex: none;
      width: 160px !important;
    }

    :global(.tabpanel) {
      flex: auto;
      border-width: 0;

      :global(section) {
        &:not(:first-child) {
          margin: 16px 0 0;
        }
      }

      :global(p) {
        margin-top: 0;
      }

      :global(h4) {
        font-size: inherit;

        & ~ :global(div) {
          margin: 8px 0 0;
        }

        & ~ :global(p) {
          margin: 8px 0 0;
          color: var(--sui-secondary-foreground-color);
          font-size: var(--sui-font-size-small);
        }
      }
    }
  }
</style>
