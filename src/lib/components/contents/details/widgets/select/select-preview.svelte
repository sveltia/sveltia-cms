<!--
  @component
  Implement the preview for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObjectArray } from '@sveltia/utils/array';
  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {SelectField}
   */
  export let fieldConfig;
  /**
   * @type {string | string[]}
   */
  export let currentValue;

  $: ({ options, multiple } = fieldConfig);
  $: hasLabels = isObjectArray(options);
  $: listFormatter = getListFormatter(locale);

  /**
   * Get the display label by value.
   * @param {any} value - Value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    hasLabels
      ? /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === value)
          ?.label || value
      : value;
</script>

{#if multiple && Array.isArray(currentValue) && currentValue.length}
  <p lang={locale} dir="auto">{listFormatter.format(currentValue.map(getLabel).sort())}</p>
{:else if currentValue !== undefined}
  <p lang={locale} dir="auto">{getLabel(currentValue)}</p>
{/if}
