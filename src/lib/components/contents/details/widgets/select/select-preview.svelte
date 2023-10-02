<!--
  @component
  Implement the preview for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObject } from '$lib/services/utils/misc';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {SelectField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string | string[]}
   */
  export let currentValue = undefined;

  $: ({ options, multiple } = fieldConfig);
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });

  /**
   * Get the display label by value.
   * @param {string} value Value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    /** @type {object} */ (
      options.find((option) =>
        isObject(option) ? /** @type {object} */ (option).value === value : false,
      )
    )?.label || value;
</script>

{#if multiple && Array.isArray(currentValue) && currentValue.length}
  <p>{listFormatter.format(currentValue.map(getLabel))}</p>
{:else if typeof currentValue === 'string' && currentValue.trim()}
  <p>{getLabel(currentValue)}</p>
{/if}
