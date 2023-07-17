<script>
  import { Group } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/editor';

  /**
   * CSS class name on the button.
   */
  let className = '';

  export { className as class };
</script>

<div class="outer" hidden={$entryDraft ? true : undefined}>
  <Group class="browser {className}" {...$$restProps}>
    <slot name="primary_sidebar" />
    <Group class="main">
      <slot name="primary_toolbar" />
      <div class="main-inner">
        <div class="main-inner-main">
          <slot name="secondary_toolbar" />
          <slot name="main" />
        </div>
        <slot name="secondary_sidebar" />
      </div>
    </Group>
  </Group>
</div>

<style lang="scss">
  .outer {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &[hidden] {
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

      :global(section) {
        padding: 8px 0;

        :global(h2) {
          position: absolute;
          left: -9999px;
        }

        :global([role='search']) {
          margin: 0 16px 16px;
        }

        :global([role='listbox']) {
          margin: 0 8px;
          border-width: 0;
          gap: 4px;

          :global(button) {
            display: flex;
            justify-content: flex-start;
            border-radius: var(--sui-control-medium-border-radius);
            padding: 0 12px;
            height: 32px;
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
            background-color: var(--sui-highlight-background-color);
          }

          :global([role='option'].dragover) {
            color: var(--sui-primary-accent-color-foreground) !important;
            background-color: var(--sui-primary-accent-color) !important;
          }
        }
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

      :global(.list-container) {
        flex: auto;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        padding: 16px;
        border-radius: var(--sui-control-medium-border-radius);
      }
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

      :global(.secondary-sidebar) {
        flex: none;
        overflow: auto;
        width: 320px;
        border-left: 1px solid var(--sui-primary-border-color);
      }
    }
  }
</style>
