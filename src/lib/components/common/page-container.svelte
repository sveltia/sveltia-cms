<script>
  import { Group } from '@sveltia/ui';
  import { hasOverlay } from '$lib/services/app/navigation';

  /**
   * CSS class name on the button.
   */
  let className = '';

  export { className as class };
</script>

<div role="none" id="page-container" class="outer" inert={$hasOverlay}>
  <Group class="browser {className}" {...$$restProps}>
    <slot name="primary_sidebar" />
    <slot name="main" />
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
      background-color: var(--sui-tertiary-background-color);
      border-width: 0 1px 0 0;
      border-color: var(--sui-primary-border-color);

      :global([role='radiogroup']) {
        width: 100%;
      }

      :global([role='listbox']) {
        gap: 4px;
        margin: 8px;
        border-width: 0;
        background-color: transparent;

        :global(button) {
          display: flex;
          justify-content: flex-start;
          border-radius: var(--sui-control-medium-border-radius);
          width: 100%;
          text-align: left;

          :global(span) {
            flex: none;
          }

          :global(span.label) {
            flex: auto;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          :global(span.icon.check) {
            display: none;
          }

          &:not(:first-child) {
            margin-top: 4px;
          }
        }

        :global(button:not(:focus)) {
          border-color: transparent;
        }

        :global([role='option'][aria-selected='true']) {
          color: var(--sui-highlight-foreground-color);
          background-color: var(--sui-selected-background-color);
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

      :global(.primary.global[role='toolbar']) {
        justify-content: center;
      }

      :global(.primary:not(.global)[role='toolbar']) {
        background-color: var(--sui-tertiary-background-color);
      }

      :global(.secondary[role='toolbar']) {
        border-width: 0 0 1px;
        border-color: var(--sui-primary-border-color);
      }
    }
  }
</style>
