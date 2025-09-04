<script>
  import { hasOverlay } from '$lib/services/app/navigation';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [class] CSS class name on the button.
   * @property {Snippet} [primarySidebar] Primary sidebar content.
   * @property {Snippet} [main] Main content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    class: className = '',
    primarySidebar = undefined,
    main = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="group" id="page-container" class="outer {className}" inert={$hasOverlay} {...rest}>
  {@render primarySidebar?.()}
  {@render main?.()}
</div>

<style lang="scss">
  .outer {
    flex: auto;
    display: flex;
    overflow: hidden;

    &[inert] {
      display: none;
    }

    :global {
      .primary-sidebar {
        display: flex;
        flex-direction: column;
        flex: none;
        width: 240px;
        overflow-y: auto;

        @media (width < 768px) {
          flex: auto;
          width: auto;
          background-color: var(--sui-primary-background-color);
        }

        // Mobile header
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          height: var(--sui-primary-toolbar-size);

          h2 {
            padding: 0 10px;
            font-size: var(--sui-font-size-x-large);
          }
        }

        .sui.search-bar {
          margin-inline: 12px;
          --sui-textbox-background-color: var(--sui-tertiary-background-color);
        }

        [role='radiogroup'] {
          width: 100%;
        }

        [role='listbox'] {
          margin: 8px;
          border-width: 0;
          background-color: transparent;

          button {
            display: flex;
            justify-content: flex-start;
            border-radius: var(--sui-control-medium-border-radius);
            width: 100%;
            text-align: left;

            &:not(:first-child) {
              margin-top: 4px;
            }

            &:not(:focus) {
              border-color: transparent;
            }

            span {
              flex: none;
            }

            .label {
              flex: auto;
              overflow: hidden;
            }

            .icon {
              transition: color 200ms;
            }

            .icon.check {
              display: none;
            }

            .count {
              padding: 2px;
              color: var(--sui-tertiary-foreground-color);
              font-size: var(--sui-font-size-small);
              transition: color 200ms;
            }
          }

          [role='option'][aria-selected='true'] {
            color: var(--sui-highlight-foreground-color);
            background-color: var(--sui-selected-background-color);

            .count {
              color: var(--sui-highlighted-foreground-color);
            }
          }

          [role='option'].dragover {
            color: var(--sui-primary-accent-color-inverted) !important;
            background-color: var(--sui-primary-accent-color) !important;
          }
        }

        .sui.divider {
          margin: 8px 0;
        }
      }
    }
  }
</style>
