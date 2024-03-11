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
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {BooleanField}
   */
  export let fieldConfig;
  /**
   * @type {boolean}
   */
  export let currentValue;

  $: ({
    // Widget-specific options
    before_input = '',
    after_input = '',
  } = fieldConfig);
</script>

{#if typeof currentValue === 'boolean'}
  <p>
    {before_input}
    {$_(`boolean.${currentValue}`)}
    {after_input}
  </p>
{/if}
