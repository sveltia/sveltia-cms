<!--
  @component
  Implement the preview for a List field without subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { SimpleListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SimpleListField} fieldConfig Field configuration.
   * @property {string[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if Array.isArray(currentValue) && currentValue.length}
  <ul lang={getCanonicalLocale(locale)} dir="auto">
    {#each currentValue as item}
      <li>{item}</li>
    {/each}
  </ul>
{/if}
