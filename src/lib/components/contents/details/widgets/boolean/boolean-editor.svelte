<!--
  @component
  Implement the editor for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { Switch } from '@sveltia/ui';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {BooleanField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {boolean | 'mixed'}
   */
  export let currentValue = false;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;
</script>

<Switch
  bind:checked={currentValue}
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
