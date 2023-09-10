<!--
  @component
  Implement the editor for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { Switch } from '@sveltia/ui';

  // svelte-ignore unused-export-let
  export let locale = '';

  // svelte-ignore unused-export-let
  export let keyPath = '';

  /**
   * @type {BooleanField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig = undefined;

  /**
   * @type {boolean}
   */
  export let currentValue = undefined;

  /**
   * @type {boolean}
   */
  export let disabled = false;
</script>

<Switch bind:checked={currentValue} {disabled} />
