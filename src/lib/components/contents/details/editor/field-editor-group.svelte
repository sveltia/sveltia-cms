<script>
  import { onMount } from 'svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    children = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();

  // eslint-disable-next-line arrow-body-style
  onMount(() => {
    // onUnmount
    return () => {
      wrapper?.dispatchEvent(new CustomEvent('Unmount'));
    };
  });
</script>

<section role="group" class="field" {...rest} bind:this={wrapper}>
  {@render children?.()}
</section>

<style>
  section {
    position: relative;
    padding: var(--field-editor-padding);

    &:not(:last-child)::after {
      position: absolute;
      inset: auto var(--field-editor-padding) 0 var(--field-editor-padding);
      overflow: hidden;
      height: 1px;
      background-color: var(--sui-tertiary-background-color);
      content: '';
    }

    :global {
      & > * {
        margin-inline: auto !important;
        max-width: 768px;
      }

      & > header {
        display: flex;
        align-items: center;
        margin: 0 -8px 8px;
        height: var(--sui-button-small-height);

        h4 {
          margin-inline: var(--sui-focus-ring-width) 0;
          font-size: var(--sui-font-size-small);
          font-weight: var(--sui-font-weight-bold);
          color: var(--sui-secondary-foreground-color);
        }

        .required {
          margin-block: 2px 0;
          margin-inline: 2px 0;
          color: var(--sui-error-foreground-color);
          font-size: var(--sui-font-size-large);
        }
      }

      @media (hover: hover) {
        &:not(:hover) > header button {
          opacity: 0;
        }
      }
    }
  }
</style>
