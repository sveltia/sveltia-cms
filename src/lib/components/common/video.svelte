<script>
  import { getAssetPreviewURL } from '$lib/services/assets/view';

  /**
   * @type {'lazy' | 'eager'}
   */
  export let loading = 'lazy';
  /**
   * @type {Asset | undefined}
   */
  export let asset = undefined;
  /**
   * @type {string | undefined}
   */
  export let src = undefined;
  export let cover = false;

  /**
   * @type {HTMLVideoElement}
   */
  let element;
  let updatingSrc = false;

  /**
   * Update the {@link src} property.
   */
  const updateSrc = async () => {
    if (asset && element && !updatingSrc) {
      updatingSrc = true;
      src = await getAssetPreviewURL(asset, loading, element);
      updatingSrc = false;
    }
  };

  // @ts-ignore Arguments are triggers
  $: updateSrc(element, asset);
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<video class:cover playsinline {src} {...$$restProps} bind:this={element} />

<style lang="scss">
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;

    &:not([src]) {
      visibility: hidden;
    }

    &.cover {
      object-fit: cover;
    }
  }
</style>
