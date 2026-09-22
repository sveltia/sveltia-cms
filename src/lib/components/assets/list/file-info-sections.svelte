<!--
  @component
  Sections of the asset info panel describing the file itself, shared by repository assets and
  assets on external locations: kind, size, and the dimensions and duration of a media file.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { getPathInfo } from '@sveltia/utils/file';
  import mime from 'mime';

  import { formatSize } from '$lib/services/utils/file';
  import { formatDuration } from '$lib/services/utils/media/video';

  /**
   * @import { AssetKind, MediaDimensions } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} fileName File name or path, whose extension tells the file type.
   * @property {AssetKind} kind Asset kind, shown as the file type when there is no extension.
   * @property {number} [size] File size in bytes, if known.
   * @property {boolean} [hasDimensions] Whether the file is one with dimensions, e.g. an image, so
   * the section is shown even while they are still being read.
   * @property {MediaDimensions} [dimensions] Media dimensions, once read.
   * @property {number} [duration] Media duration in seconds, once read.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    fileName,
    kind,
    size = undefined,
    hasDimensions = false,
    dimensions = undefined,
    duration = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { extension = '' } = $derived(getPathInfo(fileName));
</script>

<section>
  <h4>{_('kind')}</h4>
  <p>
    <!-- A linked file may have no extension, e.g. an avatar URL, so fall back to the kind -->
    {_(`file_type_labels.${extension}`, {
      default: mime.getType(fileName) ?? (extension ? extension.toUpperCase() : _(kind)),
    })}
  </p>
</section>
{#if !!size}
  <section>
    <h4>{_('size')}</h4>
    <p>
      {#key appLocale.current}
        {formatSize(size)}
      {/key}
    </p>
  </section>
{/if}
{#if hasDimensions}
  <section>
    <h4>{_('dimensions')}</h4>
    <p>{dimensions ? `${dimensions.width}×${dimensions.height}` : '–'}</p>
  </section>
{/if}
{#if ['audio', 'video'].includes(kind)}
  <section>
    <h4>{_('duration')}</h4>
    <p>{duration ? formatDuration(duration) : '–'}</p>
  </section>
{/if}
