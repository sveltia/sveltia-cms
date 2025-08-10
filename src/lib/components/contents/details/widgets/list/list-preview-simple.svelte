<!--
  @component
  Implement the preview for the List widget without subfield(s).
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[] | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if Array.isArray(currentValue) && currentValue.length}
  <ul lang={locale} dir="auto">
    {#each currentValue as item}
      <li>{item}</li>
    {/each}
  </ul>
{/if}
