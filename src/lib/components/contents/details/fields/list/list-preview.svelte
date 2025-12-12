<!--
  @component
  Implement the preview for a List field.
  @see https://decapcms.org/docs/widgets/#List
-->
<script>
  import ListPreviewComplex from '$lib/components/contents/details/fields/list/list-preview-complex.svelte';
  import ListPreviewSimple from '$lib/components/contents/details/fields/list/list-preview-simple.svelte';
  import { getListFieldInfo } from '$lib/services/contents/fields/list/helper';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { ComplexListField, SimpleListField, ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig: config,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if getListFieldInfo(config).hasSubFields}
  <ListPreviewComplex {...{ ...rest, fieldConfig: /** @type {ComplexListField} */ (config) }} />
{:else}
  <ListPreviewSimple {...{ ...rest, fieldConfig: /** @type {SimpleListField} */ (config) }} />
{/if}
