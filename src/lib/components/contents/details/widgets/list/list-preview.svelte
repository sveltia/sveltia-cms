<!--
  @component
  Implement the preview for the List widget.
  @see https://decapcms.org/docs/widgets/#List
-->
<script>
  import ListPreviewComplex from '$lib/components/contents/details/widgets/list/list-preview-complex.svelte';
  import ListPreviewSimple from '$lib/components/contents/details/widgets/list/list-preview-simple.svelte';
  import { getListFieldInfo } from '$lib/services/contents/widgets/list/helper';

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
    ...allProps
    /* eslint-enable prefer-const */
  } = $props();

  const { hasSubFields } = $derived(getListFieldInfo(allProps.fieldConfig));
  const Component = $derived(hasSubFields ? ListPreviewComplex : ListPreviewSimple);
</script>

<Component {...allProps} />
