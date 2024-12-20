<script>
  import { Alert, Dialog, Icon, Tab, TabList, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AccessibilityPanel from '$lib/components/prefs/panels/accessibility-panel.svelte';
  import AdvancedPanel from '$lib/components/prefs/panels/advanced-panel.svelte';
  import AppearancePanel from '$lib/components/prefs/panels/appearance-panel.svelte';
  import ContentsPanel from '$lib/components/prefs/panels/contents-panel.svelte';
  import LanguagesPanel from '$lib/components/prefs/panels/languages-panel.svelte';
  import MediaPanel from '$lib/components/prefs/panels/media-panel.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] - Whether to open the dialog.
   * @property {(() => void) | undefined} [onClose] - Custom `close` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let selectedPanel = $state('appearance');
  let toastMessage = $state('');
  let showToast = $state(false);

  const panels = [
    { key: 'appearance', icon: 'palette', component: AppearancePanel },
    { key: 'languages', icon: 'language', component: LanguagesPanel },
    { key: 'contents', icon: 'library_books', component: ContentsPanel },
    { key: 'media', icon: 'photo_library', component: MediaPanel },
    { key: 'accessibility', icon: 'accessibility_new', component: AccessibilityPanel },
    { key: 'advanced', icon: 'build', component: AdvancedPanel },
  ];
</script>

<Dialog
  title={$_('settings')}
  bind:open
  showOk={false}
  showCancel={false}
  showClose={true}
  onClose={() => {
    onClose?.();
  }}
>
  <div role="none" class="wrapper">
    <TabList orientation="vertical" aria-label={$_('categories')}>
      {#each panels as { key, icon } (key)}
        <Tab
          label={$_(`prefs.${key}.title`)}
          selected={key === selectedPanel}
          aria-controls="prefs-tab-{key}"
          onSelect={() => {
            selectedPanel = key;
          }}
        >
          {#snippet startIcon()}
            <Icon name={icon} />
          {/snippet}
        </Tab>
      {/each}
    </TabList>
    {#each panels as { key, component: Panel } (key)}
      <Panel
        onChange={({ message }) => {
          toastMessage = message;
          showToast = true;
        }}
      />
    {/each}
  </div>
</Dialog>

<Toast bind:show={showToast}>
  <Alert status="success">{toastMessage}</Alert>
</Toast>

<style lang="scss">
  .wrapper {
    display: flex;

    :global(.tab-list) {
      flex: none;
    }

    :global(.tab-panel) {
      flex: auto;
      border-width: 0;

      :global(section:not(:first-child)) {
        margin: 16px 0 0;
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
