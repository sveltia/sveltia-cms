<!--
  @component
  Implement the editor for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { Switch } from '@sveltia/ui';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { BooleanField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {BooleanField} fieldConfig Field configuration.
   * @property {boolean | 'mixed' | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
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

<Switch
  bind:checked={currentValue}
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
