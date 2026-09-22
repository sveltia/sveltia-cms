<!--
  @component
  Breadcrumb trail of folders, the last of which is the current one. The ancestors are buttons
  leading back to themselves. When the trail doesn’t fit, the names are cut short first; once they
  can’t be cut any further, the ancestors between the first and the current folder are folded into
  a menu, the way Google Drive does.
-->
<script>
  import { _, isRTL } from '@sveltia/i18n';
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { untrack } from 'svelte';

  /**
   * @import { BreadcrumbItem } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {BreadcrumbItem[]} items Folders, from the root down to the current one.
   * @property {string} [class] The `class` attribute on the wrapper element.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    items,
    class: className = '',
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Width between the items.
   */
  const GAP = 4;

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /**
   * Hidden copy of the whole trail, laid out with nothing cut short or folded, so the room the
   * trail needs can be measured whatever is shown. Measuring the shown trail instead would depend
   * on its own state: once folded, it takes less room, and would look like it fits.
   * @type {HTMLElement | undefined}
   */
  let copy = $state();
  /**
   * Whether the middle ancestors are folded into a menu. Measured whenever the trail or the room
   * for it changes.
   */
  let folded = $state(false);

  const ancestors = $derived(items.slice(0, -1));
  /** The current folder, which every trail ends with. */
  const current = $derived(/** @type {BreadcrumbItem} */ (items.at(-1)));
  /** Ancestors between the first and the current folder, which can be folded into a menu. */
  const middle = $derived(ancestors.slice(1));
  const canFold = $derived(middle.length > 0);

  /**
   * Get the name shown by a trail item.
   * @param {Element} element Item.
   * @returns {string} Name.
   */
  const getName = (element) => element.querySelector('bdi')?.textContent ?? '';

  /**
   * Give each name the least room it gets, then fold or unfold the trail depending on the room for
   * it. A long name can be cut down to a few characters, while a short one keeps its own width, so
   * it isn’t padded when the trail has room to spare.
   */
  const measure = () => {
    /* v8 ignore next 3 -- the elements are bound by the time anything measures them */
    if (!wrapper || !copy) {
      return;
    }

    const em = parseFloat(getComputedStyle(wrapper).fontSize);
    /**
     * The least width of each name, by name. A plain object rather than a `Map`, as nothing
     * reactive depends on it.
     * @type {Record<string, number>}
     */
    const leastWidths = {};
    let width = (copy.children.length - 1) * GAP;

    [...copy.children].forEach((child) => {
      const { classList } = child;
      const { width: natural } = child.getBoundingClientRect();

      if (classList.contains('crumb') || classList.contains('current')) {
        const least = Math.min(natural, em * (classList.contains('current') ? 6 : 4.5));

        leastWidths[getName(child)] = least;
        width += least;
      } else {
        width += natural;
      }
    });

    // Let the shown trail be cut down to the least widths
    [...wrapper.children].forEach((child) => {
      const { classList } = child;

      if (classList.contains('crumb') || classList.contains('current')) {
        /** @type {HTMLElement} */ (child).style.minWidth = `${leastWidths[getName(child)]}px`;
      }
    });

    // The wrapper reports whole pixels, so allow for the rounding
    folded = canFold && width > wrapper.clientWidth + 1;
  };

  $effect(() => {
    // Measure again whenever the trail changes
    void items;

    const element = wrapper;

    /* v8 ignore next 3 -- the element is bound by the time the effect runs */
    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      // Sizing the names changes the layout, which mustn’t happen within the observation itself,
      // or the browser drops the notification along with a “loop completed” error
      requestAnimationFrame(() => {
        measure();
      });
    });

    observer.observe(element);
    // The measurement writes `folded`, which must not re-run the effect
    untrack(() => {
      measure();
    });
    // The names are wider once the font has loaded
    document.fonts.ready.then(() => {
      measure();
    });

    return () => {
      observer.disconnect();
    };
  });

  // The least widths above are given to the elements shown at the time, so a change of the shown
  // elements — a fold or an unfold — needs another pass
  $effect(() => {
    void folded;
    untrack(() => {
      measure();
    });
  });
</script>

{#snippet separator()}
  <Icon name={isRTL() ? 'chevron_left' : 'chevron_right'} class="separator" />
{/snippet}

{#snippet ancestor(/** @type {BreadcrumbItem} */ { label, onClick })}
  <Button variant="link" class="crumb" onclick={onClick}>
    <bdi>{label}</bdi>
  </Button>
  {@render separator()}
{/snippet}

<nav class={['breadcrumb', className, { folded }]} aria-label={_('folder')} bind:this={wrapper}>
  {#if folded}
    {@render ancestor(ancestors[0])}
    <MenuButton variant="ghost" iconic size="small" class="more" aria-label={_('more_folders')}>
      {#snippet endIcon()}
        <Icon name="more_horiz" />
      {/snippet}
      {#snippet popup()}
        <Menu ariaLabel={_('more_folders')}>
          {#each middle as { label, onClick }, index (index)}
            <MenuItem variant="ghost" {label} onclick={onClick}>
              {#snippet startIcon()}
                <Icon name="folder" />
              {/snippet}
            </MenuItem>
          {/each}
        </Menu>
      {/snippet}
    </MenuButton>
    {@render separator()}
  {:else}
    {#each ancestors as item, index (index)}
      {@render ancestor(item)}
    {/each}
  {/if}
  <span class="current"><bdi>{current.label}</bdi></span>
  <div class="copy" aria-hidden="true" inert bind:this={copy}>
    {#each ancestors as { label }, index (index)}
      <span class="crumb"><bdi>{label}</bdi></span>
      {@render separator()}
    {/each}
    <span class="current"><bdi>{current.label}</bdi></span>
  </div>
</nav>

<style>
  .breadcrumb {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    white-space: nowrap;

    /* A name is cut short with an ellipsis rather than wrapped, down to the least width the script
    above gives it, so the trail stays one line tall */

    & > :global(.crumb),
    & > .current {
      flex: 0 1 auto;
      overflow: hidden;
      min-width: 0;
      text-overflow: ellipsis;
    }

    .current {
      display: block;
    }

    .copy {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      visibility: hidden;
      pointer-events: none;

      & > * {
        flex: none;
      }
    }

    :global {
      .sui.button.crumb {
        display: block;
        color: var(--sui-secondary-foreground-color);
        font-size: inherit;

        .label {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        &:hover .label {
          color: var(--sui-primary-foreground-color);
        }
      }

      .separator,
      .more {
        flex: none;
        color: var(--sui-secondary-foreground-color);
      }
    }
  }
</style>
