<!--
  @component
  Implement the preview for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { _ } from 'svelte-i18n';

  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { BooleanField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {BooleanField} fieldConfig Field configuration.
   * @property {boolean | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
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
