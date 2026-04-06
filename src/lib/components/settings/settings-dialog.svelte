<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, Icon, Tab, TabList, TabPanel } from '@sveltia/ui';
  import { get } from 'svelte/store';

  import { panels } from '$lib/components/settings';
  import PanelContainer from '$lib/components/settings/panel-container.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether to open the dialog.
   * @property {(() => void) | undefined} [onClose] Custom `close` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let selectedPanel = $state('appearance');
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
    <TabList orientation="vertical" aria-label={_('categories')}>
      {#each get(panels) as { key, icon, enabled = true } (key)}
        {#if enabled}
          <Tab
            label={_(`prefs.${key}.title`)}
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
        {/if}
      {/each}
    </TabList>
    {#each get(panels) as { key, component } (key)}
      <TabPanel id="prefs-tab-{key}">
        <PanelContainer Panel={component} />
      </TabPanel>
    {/each}
  </div>
</Dialog>

<style lang="scss">
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
