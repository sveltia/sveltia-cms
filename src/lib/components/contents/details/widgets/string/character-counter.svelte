<script>
  import { _ } from 'svelte-i18n';
  import { validateStringField } from '$lib/services/contents/widgets/string/helper';

  /**
   * @type {StringField | TextField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({ minlength, maxlength } = fieldConfig);
  $: ({ count, hasMin, hasMax, invalid } = validateStringField(fieldConfig, currentValue));
</script>

{#if hasMin || hasMax}
  <div
    class="wrapper"
    aria-label={$_(
      hasMin && hasMax
        ? count === 1
          ? 'character_counter.min_max.one'
          : 'character_counter.min_max.many'
        : hasMin
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
    flex: none;
    color: var(--sui-tertiary-foreground-color) !important;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
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
