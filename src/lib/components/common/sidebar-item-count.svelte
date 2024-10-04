<script>
  import { _ } from 'svelte-i18n';

  /** @type {'entries' | 'assets'} */
  export let type;
  /** @type {number} */
  export let count = 0;

  $: label = `(${$_(
    {
      // eslint-disable-next-line no-nested-ternary
      entries: count > 1 ? 'many_entries' : count === 1 ? 'one_entry' : 'no_entries',
      // eslint-disable-next-line no-nested-ternary
      assets: count > 1 ? 'many_assets' : count === 1 ? 'one_asset' : 'no_assets',
    }[type],
    { values: { count } },
  )})`;
</script>

<span class="count" aria-label={label}>{count}</span>

<style lang="scss">
  .count {
    color: var(--sui-tertiary-foreground-color);
    font-size: var(--sui-font-size-small);

    :global([aria-selected='true']) & {
      color: var(--sui-highlighted-foreground-color);
    }
  }
</style>
