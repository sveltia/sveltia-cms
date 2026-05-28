<!--
  @component
  Implement the preview for a Text field.
  @see https://decapcms.org/docs/widgets/#Text
  @see https://sveltiacms.app/en/docs/fields/text
-->
<script>
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {TextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p lang={getCanonicalLocale(locale)} dir={getDirection(locale)}>{currentValue}</p>
{/if}

<style>
  p {
    white-space: pre-wrap;
  }
</style>
