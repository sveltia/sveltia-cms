<!--
  @component
  Full-screen overlay showing an asset’s details, shared by repository assets and assets on
  external locations: a toolbar with the back button, title, action buttons and edit options menu,
  the preview and the info panel. On small screens, the action buttons move into the edit options
  menu, so they are rendered with `useButton` set to `false` there.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Toolbar, TruncatedText } from '@sveltia/ui';
  import { tick } from 'svelte';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [title] Asset name.
   * @property {string} [contentKey] Value that identifies the shown asset; the content is
   * re-rendered when it changes.
   * @property {() => void} onBack Called when the back button is clicked or Escape is pressed.
   * @property {Snippet<[boolean]>} actions Action buttons, given whether to render them as buttons
   * (`true`) or as menu items (`false`).
   * @property {Snippet<[Snippet]>} editOptions Edit options menu button, given the snippet of extra
   * menu items to be placed at the top of the menu.
   * @property {Snippet} preview Preview of the asset, or a not-found message.
   * @property {Snippet} [info] Info panel.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title = undefined,
    contentKey = undefined,
    onBack,
    actions,
    editOptions,
    preview,
    info = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    if (wrapper) {
      wrapper.tabIndex = 0;
      wrapper.focus();
    }
  };

  $effect(() => {
    if (wrapper) {
      if (showAssetOverlay.current) {
        moveFocus();
      }
    }
  });
</script>

{#snippet overflowItems()}
  {#if env.isSmallScreen}
    {@render actions(false)}
  {/if}
{/snippet}

<div role="group" class="wrapper" aria-label={_('asset_editor')} bind:this={wrapper}>
  {#key contentKey}
    <Toolbar variant="primary" aria-label={_('primary')}>
      <BackButton aria-label={_('cancel_editing')} useShortcut={true} onclick={onBack} />
      <h2 role="none">
        <TruncatedText>
          <bdi>{title}</bdi>
        </TruncatedText>
      </h2>
      {#if !env.isSmallScreen}
        {@render actions(true)}
      {/if}
      {@render editOptions(overflowItems)}
    </Toolbar>
    <div role="none" class="row">
      <div role="none" class="preview">
        {@render preview()}
      </div>
      {@render info?.()}
    </div>
  {/key}
</div>

<style>
  .wrapper {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--sui-secondary-background-color);

    .row {
      flex: auto;
      display: flex;
      overflow: hidden;

      @media (width < 768px) {
        flex-direction: column;

        .preview {
          flex: none !important;
          aspect-ratio: 1 / 1;
        }

        :global {
          .detail {
            flex: auto;
            width: auto;
          }
        }
      }

      .preview {
        flex: auto;
        overflow: hidden;

        :global {
          iframe {
            display: block;
            width: 100%;
            height: 100%;
          }
        }
      }

      :global {
        .detail {
          background-color: var(--sui-primary-background-color);
        }
      }
    }
  }
</style>
