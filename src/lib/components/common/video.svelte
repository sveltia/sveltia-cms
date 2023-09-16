<script>
  import { getAssetPreviewURL } from '$lib/services/assets/view';

  /**
   * @type {'lazy' | 'eager'}
   */
  export let loading = 'lazy';
  /**
   * @type {Asset}
   */
  export let asset = undefined;
  /**
   * @type {string}
   */
  export let src = undefined;
  export let cover = false;

  let element;

  $: {
    if (element && asset) {
      (async () => {
        src = await getAssetPreviewURL(asset, loading, element);
      })();
    }
  }
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
