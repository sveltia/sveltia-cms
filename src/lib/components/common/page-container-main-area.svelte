<script module>
  /**
   * The instance that last set {@link mainAreaTitle}. A page transition can mount the next area
   * before the previous one is destroyed, and the outgoing cleanup must not wipe the incoming
   * title.
   * @type {object | undefined}
   */
  let titleOwner;
</script>

<script>
  import { mainAreaTitle } from '$lib/services/app/navigation';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [primaryToolbar] Primary toolbar content.
   * @property {Snippet} [secondaryToolbar] Secondary toolbar content.
   * @property {Snippet} [mainContent] Main content.
   * @property {Snippet} [secondarySidebar] Secondary sidebar content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    primaryToolbar = undefined,
    secondaryToolbar = undefined,
    mainContent = undefined,
    secondarySidebar = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  const instance = {};

  // The accessible name of the area also names the document, so the browser tab and history
  // entries say which collection or folder is open rather than just the app name
  $effect(() => {
    titleOwner = instance;
    mainAreaTitle.current = rest['aria-label'] ?? '';

    return () => {
      if (titleOwner === instance) {
        mainAreaTitle.current = '';
      }
    };
  });
</script>

<!-- One `main` per page: the area holding the page’s content, as opposed to the sidebar -->
<main class="wrapper" {...rest}>
  {@render primaryToolbar?.()}
  <div role="none" class="main-inner">
    <div role="none" class="main-inner-main">
      {@render secondaryToolbar?.()}
      {@render mainContent?.()}
    </div>
    {@render secondarySidebar?.()}
  </div>
</main>

<style>
  .wrapper {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    background-color: var(--sui-primary-background-color);

    @media (768px <= width) {
      view-transition-name: page-main;
    }

    :global {
      .sui.toolbar.primary {
        justify-content: center;

        @media (width < 768px) {
          background-color: var(--sui-secondary-background-color);
        }
      }
    }
  }

  :global(.resizable-pane) > .wrapper {
    border-start-start-radius: 16px;
  }

  .main-inner {
    flex: auto;
    display: flex;
    overflow: hidden;

    .main-inner-main {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :global {
      .secondary-sidebar {
        flex: none;
        overflow: auto;
        box-sizing: content-box;
        width: 320px;
        background-color: var(--sui-secondary-background-color);

        @media (768px <= width) {
          border-start-start-radius: 16px;
        }

        [role='listbox'] {
          padding: 12px;
        }
      }
    }
  }
</style>
