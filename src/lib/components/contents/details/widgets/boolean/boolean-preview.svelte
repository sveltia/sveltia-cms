<!--
  @component
  Implement the preview for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { _ } from 'svelte-i18n';

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
   * @type {BooleanField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {boolean}
   */
  export let currentValue = false;
</script>

{#if typeof currentValue === 'boolean'}
  <p>
    {$_(`boolean.${currentValue}`)}
  </p>
{/if}
