<script>
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';

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
   * Show controls for the video.
   */
  export let controls = false;
</script>

<AssetPreview
  kind="video"
  {loading}
  {asset}
  {src}
  {variant}
  {blurBackground}
  {cover}
  {controls}
  {...$$restProps}
/>
