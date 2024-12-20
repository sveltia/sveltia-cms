<script>
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';

  /**
   * @typedef {object} Props
   * @property {'lazy' | 'eager'} [loading] - Loading method.
   * @property {Asset} [asset] - Asset.
   * @property {string} [src] - Source URL.
   * @property {'tile' | 'icon'} [variant] - Style variant.
   * @property {boolean} [blurBackground] - Whether to show a blurred background (like Slack’s media
   * overlay).
   * @property {boolean} [cover] - Whether to use `object-fit: cover`.
   * @property {boolean} [checkerboard] - Whether to show a checkerboard background below a
   * transparent image.
   * @property {string} [alt] - Alt text for the image.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    loading = 'lazy',
    asset = undefined,
    src = undefined,
    variant = undefined,
    blurBackground = false,
    cover = false,
    checkerboard = false,
    alt = '',
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<AssetPreview
  kind="image"
  {loading}
  {asset}
  {src}
  {variant}
  {blurBackground}
  {cover}
  {checkerboard}
  {alt}
  {...rest}
/>
