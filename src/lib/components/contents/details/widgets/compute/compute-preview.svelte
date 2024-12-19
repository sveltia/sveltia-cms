<!--
  @component
  Implement the preview for the experimental Compute widget.
-->
<script>
  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {StringField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {string | number}
   */
  export let currentValue;
</script>

<p lang={locale} dir="auto">{currentValue}</p>
