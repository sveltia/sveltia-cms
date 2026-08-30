<!--
  @component
  Implement the editor for a Compute field. The field is hidden in `FieldEditor`; the value itself
  is resolved by `updateComputedValues`, which walks the whole draft rather than relying on this
  editor being rendered.
-->
<script>
  import { TextInput } from '@sveltia/ui';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { ComputeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComputeField} fieldConfig Field configuration.
   * @property {string | number | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<TextInput
  dir="auto"
  value={String(currentValue)}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
