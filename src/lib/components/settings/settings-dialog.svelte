<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, Icon, Tab, TabList, TabPanel } from '@sveltia/ui';

  import { panels } from '$lib/components/settings';
  import PanelContainer from '$lib/components/settings/panel-container.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether to open the dialog.
   * @property {(() => void) | undefined} [onClose] Custom `close` event handler.
   */

  /** @type {Props} */
  let { open = $bindable(false), onClose = undefined } = $props();

  /** @type {string | undefined} */
  let selectedPanel = $state();

  // The first panel until another is selected: Account when it’s there, otherwise Appearance. Also
  // the first one when the selected panel is no longer offered
  const currentPanel = $derived(
    panels.current.some(({ key }) => key === selectedPanel)
      ? /** @type {string} */ (selectedPanel)
      : panels.current[0].key,
  );
</script>

<Dialog
  title={_('settings')}
  size="large"
  bind:open
  showOk={false}
  showCancel={false}
  showClose={true}
  onClose={() => {
    onClose?.();
  }}
>
  <div role="none" class="wrapper">
    <TabList orientation="vertical" ariaLabel={_('categories')}>
      {#each panels.current as { key, icon } (key)}
        <Tab
          label={_(`prefs.${key}.title`)}
          selected={key === currentPanel}
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
    {#each panels.current as { key, component } (key)}
      <TabPanel id="prefs-tab-{key}">
        <PanelContainer Panel={component} />
      </TabPanel>
    {/each}
  </div>
</Dialog>

<style>
  .wrapper {
    display: flex;

    :global {
      .sui.tab-list {
        flex: none;
      }

      .sui.tab-panel {
        flex: auto;
        border-width: 0;
      }
    }
  }
</style>
