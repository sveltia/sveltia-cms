<script>
  import { onMount } from 'svelte';
  import { getAssetViewURL } from '$lib/services/assets/view';

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
  export let alt = '';
  export let checkerboard = false;
  export let cover = false;

  let element;

  onMount(() => {
    if (asset && !src) {
      (async () => {
        src = await getAssetViewURL(asset, loading, element);
      })();
    }
  });
</script>

<img class:checkerboard class:cover {loading} {src} {alt} {...$$restProps} bind:this={element} />

<style lang="scss">
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: var(--sui-tertiary-background-color);

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
