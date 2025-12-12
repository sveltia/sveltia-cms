<!--
  @component
  Implement the editor for a List field.
  @see https://decapcms.org/docs/widgets/#List
-->
<script>
  import { Group } from '@sveltia/ui';

  import ListEditorComplex from '$lib/components/contents/details/widgets/list/list-editor-complex.svelte';
  import ListEditorSimple from '$lib/components/contents/details/widgets/list/list-editor-simple.svelte';
  import { getListFieldInfo } from '$lib/services/contents/widgets/list/helper';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { ComplexListField, SimpleListField, ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig: config,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();
</script>

<Group aria-labelledby="list-{fieldId}-summary">
  {#if getListFieldInfo(config).hasSubFields}
    <ListEditorComplex {...{ ...rest, fieldConfig: /** @type {ComplexListField} */ (config) }} />
  {:else}
    <ListEditorSimple {...{ ...rest, fieldConfig: /** @type {SimpleListField} */ (config) }} />
  {/if}
</Group>
