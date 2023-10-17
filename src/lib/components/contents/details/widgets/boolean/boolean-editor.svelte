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
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {BooleanField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {boolean}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let disabled = false;
</script>

<Switch bind:checked={currentValue} {disabled} />
