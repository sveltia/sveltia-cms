<!--
  @component
  Implement the preview for a Boolean field.
  @see https://decapcms.org/docs/widgets/#Boolean
  @see https://sveltiacms.app/en/docs/fields/boolean
-->
<script>
  import { _ } from '@sveltia/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { BooleanField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {BooleanField} fieldConfig Field configuration.
   * @property {boolean | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let { currentValue = false } = $props();
</script>

{#if typeof currentValue === 'boolean'}
  <p>
    {_(`boolean.${currentValue}`)}
  </p>
{/if}
