<!--
  @component
  Implement the preview for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObjectArray } from '$lib/services/utils/misc';

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
  $: hasLabels = isObjectArray(options);
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });

  /**
   * Get the display label by value.
   * @param {any} value Value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    hasLabels
      ? /** @type {object[]} */ (options).find((o) => o.value === value)?.label || value
      : value;
</script>

{#if multiple && Array.isArray(currentValue) && currentValue.length}
  <p>{listFormatter.format(currentValue.map(getLabel))}</p>
{:else if currentValue !== undefined}
  <p>{getLabel(currentValue)}</p>
{/if}
