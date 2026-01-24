<script>
  import { Alert, Dialog, Icon, Tab, TabList, TabPanel, Toast } from '@sveltia/ui';
  import { get } from 'svelte/store';
  import { _ } from 'svelte-i18n';

  import { panels } from '$lib/components/settings';

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
  let toastMessage = $state('');
  let showToast = $state(false);
</script>

<Dialog
  title={$_('settings')}
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
    <TabList orientation="vertical" aria-label={$_('categories')}>
      {#each get(panels) as { key, icon, enabled = true } (key)}
        {#if enabled}
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
        {/if}
      {/each}
    </TabList>
    {#each get(panels) as { key, component: Content } (key)}
      <TabPanel id="prefs-tab-{key}">
        <Content
          onChange={(/** @type {{ message: string }} */ { message }) => {
            toastMessage = message;
            showToast = true;
          }}
        />
      </TabPanel>
    {/each}
  </div>
</Dialog>

<Toast bind:show={showToast}>
  <Alert status="success">{toastMessage}</Alert>
</Toast>

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

        section:not(:first-child) {
          margin: 16px 0 0;
        }

        p {
          margin-top: 0;
        }

        h3 {
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

        h4 {
          margin-bottom: 4px;
          font-size: var(--sui-font-size-small);
        }
      }
    }
  }
</style>
