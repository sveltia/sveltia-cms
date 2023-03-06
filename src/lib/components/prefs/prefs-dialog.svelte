<script>
  import { Dialog, Tab, TabList } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AppearancePanel from '$lib/components/prefs/panels/appearance-panel.svelte';
  import EditorPanel from '$lib/components/prefs/panels/editor-panel.svelte';
  import MediaPanel from '$lib/components/prefs/panels/media-panel.svelte';

  /**
   * Whether to open the dialog.
   */
  export let open = false;
</script>

<Dialog title={$_('preferences')} bind:open showOk={false} showCancel={false} showClose={true}>
  <div class="wrapper">
    <TabList orientation="vertical">
      <Tab
        label={$_('prefs.appearance.title')}
        iconName="design_services"
        aria-selected={true}
        aria-controls="prefs-tab-appearance"
      />
      <Tab label={$_('prefs.editor.title')} iconName="edit_note" aria-controls="prefs-tab-editor" />
      <Tab
        label={$_('prefs.media.title')}
        iconName="photo_library"
        aria-controls="prefs-tab-media"
      />
    </TabList>
    <AppearancePanel />
    <EditorPanel />
    <MediaPanel />
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
          color: var(--secondary-foreground-color);
          font-size: 12px;
        }
      }
    }
  }
</style>
