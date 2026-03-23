<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} title The panel title.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const id = $props.id();
</script>

<section role="group" class="panel" aria-labelledby="panel-{id}-label">
  <header>
    <h3 id="panel-{id}-label">{title}</h3>
  </header>
  <div>
    {@render children?.()}
  </div>
</section>

<style lang="scss">
  section {
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  header {
    flex: none;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--sui-secondary-border-color);
    padding: 0 16px;
    height: var(--sui-primary-toolbar-size);
  }

  h3 {
    font-size: var(--sui-font-size-x-large);
  }

  div {
    flex: auto;
    overflow: auto;

    :global {
      h4 {
        display: flex;
        align-items: center;
        padding: 12px 12px 8px;
        font-size: var(--sui-font-size-large);
      }

      & > .empty {
        padding: 16px;
      }

      .empty {
        color: var(--sui-secondary-foreground-color);
        font-size: var(--sui-font-size-small);
      }

      .sui.button.ref {
        display: flex;
        justify-content: flex-start;
        gap: 8px;
        padding: 8px;
        width: -moz-available;
        width: -webkit-fill-available;
        width: stretch;
        height: auto;
      }
    }
  }
</style>
