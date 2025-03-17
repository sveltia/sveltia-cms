<!--
  @component
  Implement the editor for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { Switch } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').BooleanField} fieldConfig Field configuration.
   * @property {boolean | 'mixed' | undefined} currentValue Field value.
   */

  /** @type {import('$lib/typedefs').WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    currentValue = $bindable(false),
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
