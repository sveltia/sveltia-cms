<script>
  import MediaPreview from '$lib/components/common/media-preview.svelte';

  /**
   * Loading method.
   * @type {'lazy' | 'eager'}
   */
  export let loading = 'lazy';
  /**
   * Asset.
   * @type {Asset | undefined}
   */
  export let asset = undefined;
  /**
   * Source URL.
   * @type {string | undefined}
   */
  export let src = undefined;
  /**
   * Style variant.
   * @type {'tile' | 'icon' | undefined}
   */
  export let variant = undefined;
  /**
   * Whether to show a blurred background (like Slack’s media overlay).
   * @type {boolean}
   */
  export let blurBackground = false;
  /**
   * Whether to use `object-fit: cover`.
   * @type {boolean}
   */
  export let cover = false;
  /**
   * Whether to show a checkerboard background below a transparent image.
   * @type {boolean}
   */
  export let checkerboard = false;
  /**
   * Alt text for the image.
   * @type {string}
   */
  export let alt = '';
</script>

<MediaPreview
  type="image"
  {loading}
  {asset}
  {src}
  {variant}
  {blurBackground}
  {cover}
  {checkerboard}
  {alt}
  {...$$restProps}
/>
