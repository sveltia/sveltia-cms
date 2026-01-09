<!--
  @component
  Implement the preview for the File and Image field types.
  @see https://decapcms.org/docs/widgets/#File
  @see https://decapcms.org/docs/widgets/#Image
  @see https://sveltiacms.app/en/docs/fields/file
  @see https://sveltiacms.app/en/docs/fields/image
-->
<script>
  import FilePreviewItem from '$lib/components/contents/details/fields/file/file-preview-item.svelte';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { widget: fieldType } = $derived(fieldConfig);
  const isImageField = $derived(fieldType === 'image');
</script>

{#if isMultiple(fieldConfig)}
  {#if Array.isArray(currentValue)}
    {#each currentValue as value}
      <FilePreviewItem {value} {isImageField} />
    {/each}
  {/if}
{:else if typeof currentValue === 'string' && currentValue}
  <FilePreviewItem value={currentValue} {isImageField} />
{/if}
