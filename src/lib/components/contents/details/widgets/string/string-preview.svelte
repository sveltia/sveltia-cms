<!--
  @component
  Implement the preview for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
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
   * @type {StringField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({
    name: fieldName,
    // Widget-specific options
    type = 'text',
    before_input = '',
    after_input = '',
  } = fieldConfig);

  $: isEmail = type === 'email';

  $: isURL = (() => {
    if (type === 'url') {
      return true;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(currentValue);
      return true;
    } catch {
      return false;
    }
  })();
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p class:title={fieldName === 'title'}>
    {before_input}
    {#if isURL}
      <a href={encodeURI(currentValue)}>{currentValue}</a>
    {:else if isEmail}
      <a href="mailto:{encodeURI(currentValue)}">{currentValue}</a>
    {:else}
      {currentValue}
    {/if}
    {after_input}
  </p>
{/if}

<style lang="scss">
  .title {
    font-size: var(--sui-font-size-xxx-large);
    font-weight: 600;
  }
</style>
