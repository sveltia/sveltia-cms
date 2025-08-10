<!--
  @component
  Implement the editor for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { Group } from '@sveltia/ui';

  import ListEditorComplex from '$lib/components/contents/details/widgets/list/list-editor-complex.svelte';
  import ListEditorSimple from '$lib/components/contents/details/widgets/list/list-editor-simple.svelte';
  import { getListFieldInfo } from '$lib/services/contents/widgets/list/helper';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    ...allProps
    /* eslint-enable prefer-const */
  } = $props();

  const widgetId = $props.id();

  const { hasSubFields } = $derived(getListFieldInfo(allProps.fieldConfig));
  const Component = $derived(hasSubFields ? ListEditorComplex : ListEditorSimple);
</script>

<Group aria-labelledby="list-{widgetId}-summary">
  <Component {...allProps} />
</Group>
