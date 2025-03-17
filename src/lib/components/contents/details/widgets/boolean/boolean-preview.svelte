<!--
  @component
  Implement the preview for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').BooleanField} fieldConfig - Field configuration.
   * @property {boolean | undefined} currentValue - Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    currentValue = false,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if typeof currentValue === 'boolean'}
  <p>
    {$_(`boolean.${currentValue}`)}
  </p>
{/if}
