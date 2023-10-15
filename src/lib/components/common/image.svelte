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
  export let alt = '';
  export let checkerboard = false;
  export let cover = false;

  /**
   * @type {HTMLImageElement}
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

<img class:checkerboard class:cover {loading} {src} {alt} {...$$restProps} bind:this={element} />

<style lang="scss">
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: var(--sui-tertiary-background-color);

    &:not([src]) {
      visibility: hidden;
    }

    &.cover {
      object-fit: cover;
    }

    /* prettier-ignore */
    &.checkerboard {
      background-image:
        linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%),
        linear-gradient(45deg, #eee 25%, #fff 25%, #fff 75%, #eee 75%);
      background-size: 16px 16px;
      background-position: 0 0, 8px 8px;
    }
  }
</style>
