<script>
  import { _ } from '@sveltia/i18n';

  import { validateStringField } from '$lib/services/contents/fields/string/validate';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { StringField, TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {StringField | TextField} fieldConfig Field configuration.
   * @property {InternalLocaleCode} locale Current locale.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { minlength, maxlength } = $derived(fieldConfig);
  const { count, hasMin, hasMax, invalid } = $derived(
    validateStringField({ fieldConfig, locale, value: currentValue }).detail,
  );
</script>

{#if hasMin || hasMax}
  <div
    class="wrapper"
    aria-label={_(
      hasMin && hasMax
        ? 'character_counter.min_max'
        : hasMin
          ? 'character_counter.min'
          : 'character_counter.max',
      { values: { count, min: minlength, max: maxlength } },
    )}
  >
    {#if hasMin}
      {minlength}
      <!-- eslint-disable-next-line svelte/no-useless-mustaches -->
      {' / '}
    {/if}
    <span role="none" class="count" class:invalid>{count}</span>
    {#if hasMax}
      <!-- eslint-disable-next-line svelte/no-useless-mustaches -->
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
    text-align: end;
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
