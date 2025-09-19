<!--
  @component
  Implement the preview for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import FilePreviewItem from '$lib/components/contents/details/widgets/file/file-preview-item.svelte';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if isMultiple(fieldConfig)}
  {#if Array.isArray(currentValue)}
    {#each currentValue as value}
      <FilePreviewItem {value} />
    {/each}
  {/if}
{:else if typeof currentValue === 'string' && currentValue}
  <FilePreviewItem value={currentValue} />
{/if}
