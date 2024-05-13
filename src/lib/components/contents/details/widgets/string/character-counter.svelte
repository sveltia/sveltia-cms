<script>
  import { _ } from 'svelte-i18n';

  /**
   * @type {StringField | TextField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({ minlength, maxlength } = fieldConfig);
  $: hasMin =
    Number.isInteger(minlength) && /** @type {number} */ (minlength) <= (maxlength ?? Infinity);
  $: hasMax = Number.isInteger(maxlength) && (minlength ?? 0) <= /** @type {number} */ (maxlength);
  $: count = currentValue ? [...currentValue.trim()].length : 0;
  $: tooShort = hasMin && count < /** @type {number} */ (minlength);
  $: tooLong = hasMax && count > /** @type {number} */ (maxlength);
  $: invalid = tooShort || tooLong;
</script>

{#if hasMin || hasMax}
  <div
    class="wrapper"
    aria-label={$_(
      // eslint-disable-next-line no-nested-ternary
      hasMin && hasMax
        ? count === 1
          ? 'character_counter.min_max.one'
          : 'character_counter.min_max.many'
        : // eslint-disable-next-line no-nested-ternary
          hasMin
          ? count === 1
            ? 'character_counter.min.one'
            : 'character_counter.min.many'
          : count === 1
            ? 'character_counter.max.one'
            : 'character_counter.max.many',
      { values: { count, min: minlength, max: maxlength } },
    )}
  >
    {#if hasMin}
      {minlength}
      {' / '}
    {/if}
    <span role="none" class="count" class:invalid>{count}</span>
    {#if hasMax}
      {' / '}
      {maxlength}
    {/if}
  </div>
{/if}

<style lang="scss">
  .wrapper {
    color: var(--sui-tertiary-foreground-color) !important;
    font-size: var(--sui-font-size-small);
    text-align: right;
  }

  .count {
    &.invalid {
      color: var(--sui-error-foreground-color);
    }

    &:not(.invalid) {
      color: var(--sui-success-foreground-color);
    }
  }
</style>
