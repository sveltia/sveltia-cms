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
</script>

<Dialog title={$_('settings')} bind:open showOk={false} showCancel={false} showClose={true}>
  <div class="wrapper">
    <TabList orientation="vertical">
      <Tab
        label={$_('prefs.appearance.title')}
        aria-selected={true}
        aria-controls="prefs-tab-appearance"
      >
        <Icon slot="start-icon" name="palette" />
      </Tab>
      <Tab label={$_('prefs.languages.title')} aria-controls="prefs-tab-languages">
        <Icon slot="start-icon" name="language" />
      </Tab>
      <Tab label={$_('prefs.media.title')} aria-controls="prefs-tab-media">
        <Icon slot="start-icon" name="photo_library" />
      </Tab>
      <Tab label={$_('prefs.advanced.title')} aria-controls="prefs-tab-advanced">
        <Icon slot="start-icon" name="build" />
      </Tab>
    </TabList>
    <AppearancePanel />
    <LanguagesPanel />
    <MediaPanel />
    <AdvancedPanel />
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
