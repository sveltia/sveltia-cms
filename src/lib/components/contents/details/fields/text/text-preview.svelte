<!--
  @component
  Implement the preview for a Text field.
  @see https://decapcms.org/docs/widgets/#Text
  @see https://sveltiacms.app/en/docs/fields/text
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

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
  <p lang={getCanonicalLocale(locale)} dir="auto">{currentValue}</p>
{/if}

<style lang="scss">
  p {
    white-space: pre-wrap;
  }
</style>
