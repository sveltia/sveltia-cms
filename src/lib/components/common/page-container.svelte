<script>
  import { Group } from '@sveltia/ui';
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

<div role="none" id="page-container" class="outer" inert={$hasOverlay}>
  <Group class="browser {className}" {...rest}>
    {@render primarySidebar?.()}
    {@render main?.()}
  </Group>
</div>

<style lang="scss">
  .outer {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &[inert] {
      display: none;
    }

    & > :global([role='toolbar']) {
      flex: none;

      :global([role='search']) {
        flex: auto;
        width: auto;
        max-width: 480px;
      }
    }

    :global(.browser) {
      flex: auto;
      display: flex;
      overflow: hidden;
    }

    :global(.primary-sidebar) {
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

      :global(h2) {
        display: flex;
        align-items: center;
        padding: 16px 16px 0;
        height: 32px;
        font-size: var(--sui-font-size-x-large);

        @media (width >= 768px) {
          position: absolute;
          left: -99999px;
        }
      }

      :global([role='radiogroup']) {
        width: 100%;
      }

      :global([role='listbox']) {
        margin: 8px;
        border-width: 0;
        background-color: transparent;

        :global(button) {
          display: flex;
          justify-content: flex-start;
          border-radius: var(--sui-control-medium-border-radius);
          width: 100%;
          text-align: left;

          @media (width < 768px) {
            --sui-option-height: 48px;
          }

          :global(span) {
            flex: none;
          }

          :global(.label) {
            flex: auto;
            overflow: hidden;
            text-overflow: ellipsis;

            @media (width < 768px) {
              font-size: var(--sui-font-size-large);
            }
          }

          :global(.icon) {
            transition: color 200ms;
          }

          :global(.icon.check) {
            display: none;
          }

          :global(.count) {
            padding: 2px;
            color: var(--sui-tertiary-foreground-color);
            font-size: var(--sui-font-size-small);
            transition: color 200ms;
          }
        }

        :global(button:not(:first-child)) {
          margin-top: 4px;
        }

        :global(button:not(:focus)) {
          border-color: transparent;
        }

        :global([role='option'][aria-selected='true']) {
          color: var(--sui-highlight-foreground-color);
          background-color: var(--sui-selected-background-color);

          :global(.count) {
            color: var(--sui-highlighted-foreground-color);
          }
        }

        :global([role='option'].dragover) {
          color: var(--sui-primary-accent-color-inverted) !important;
          background-color: var(--sui-primary-accent-color) !important;
        }
      }

      :global(.sui.divider) {
        margin: 8px 0;
      }
    }

    :global(.main) {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background-color: var(--sui-primary-background-color);

      @media (width >= 768px) {
        border-top-left-radius: 16px;
      }

      :global(.primary.global[role='toolbar']) {
        justify-content: center;
      }
    }
  }
</style>
