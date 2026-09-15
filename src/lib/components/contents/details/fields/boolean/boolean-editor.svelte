<!--
  @component
  Implement the editor for a Boolean field.
  @see https://decapcms.org/docs/widgets/#Boolean
  @see https://sveltiacms.app/en/docs/fields/boolean
-->
<script>
  import { Switch } from '@sveltia/ui';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { BooleanField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {BooleanField} fieldConfig Field configuration.
   * @property {boolean | 'mixed' | undefined} currentValue Field value.
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

<!--
  A field that has never been set has no value yet, but a Sveltia UI `<Switch>` falls back to
  `false` and refuses an `undefined` binding, so the value goes through a getter and setter instead
-->
<Switch
  bind:checked={
    () => currentValue ?? false,
    (checked) => {
      currentValue = checked;
    }
  }
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
