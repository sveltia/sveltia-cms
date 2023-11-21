<script>
  import { onMount } from 'svelte';
  import { getAssetPreviewURL } from '$lib/services/assets/view';

  /**
   * Media type.
   * @type {'image' | 'video'}
   */
  export let type;
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
   * Whether to add a short dissolve transition (fade-in effect) to the image/video when it’s first
   * loaded to avoid a sudden appearance.
   * @type {boolean}
   */
  export let dissolve = true;
  /**
   * Alt text for the image.
   * @type {string}
   */
  export let alt = '';

  /**
   * @type {HTMLImageElement | HTMLVideoElement}
   */
  let element;
  let updatingSrc = false;
  let loaded = false;

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

  $: {
    void element;
    void asset;
    updateSrc();
  }

  onMount(() => {
    const isVideo = element.matches('video');

    if (
      isVideo
        ? /** @type {HTMLVideoElement} */ (element).readyState > 0
        : /** @type {HTMLImageElement} */ (element).complete
    ) {
      loaded = true;
    } else {
      element.addEventListener(
        isVideo ? 'loadedmetadata' : 'load',
        () => {
          loaded = true;
        },
        { once: true },
      );
    }
  });
</script>

<div
  role="none"
  class="preview {variant ?? ''}"
  class:cover
  class:checkerboard
  class:dissolve
  class:loaded
>
  {#if type === 'video'}
    <!-- svelte-ignore a11y-media-has-caption -->
    <video playsinline {src} {...$$restProps} bind:this={element} />
  {:else}
    <img {loading} {src} {alt} {...$$restProps} bind:this={element} />
  {/if}
  {#if blurBackground}
    <div role="none" class="blur">
      <div role="none" class="overlay" />
      {#if type === 'video'}
        <!-- svelte-ignore a11y-media-has-caption -->
        <video playsinline {src} />
      {:else}
        <img {loading} {src} alt="" />
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 100%;
    height: 100%;

    &.tile {
      border-width: 1px;
      border-style: solid;
      border-color: transparent;
      padding: var(--tile-padding, 8px);
      background-color: var(--sui-secondary-background-color);
    }

    &.icon {
      width: 40px;
      height: 40px;
    }

    &.tile,
    &.icon {
      overflow: hidden;
      border-radius: var(--sui-control-medium-border-radius);
      aspect-ratio: 1 / 1;
    }

    .blur {
      display: contents;

      & > * {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      :global(.overlay) {
        z-index: -1;
        backdrop-filter: blur(32px) brightness(0.8);
      }

      img,
      video {
        width: 100%;
        height: 100%;
        z-index: -2;
        object-fit: contain;
        transform: scale(1.2);
      }
    }

    &.cover {
      padding: 0;
    }

    & > video,
    & > img {
      max-width: 100%;
      max-height: 100%;
    }

    &.dissolve {
      img,
      video {
        opacity: 0;
        transition: opacity 250ms;
      }

      &.loaded {
        img,
        video {
          opacity: 1;
        }
      }
    }
  }

  img {
    /* prettier-ignore */
    .checkerboard & {
      background-image:
        linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%),
        linear-gradient(45deg, #eee 25%, #fff 25%, #fff 75%, #eee 75%);
      background-size: 16px 16px;
      background-position: 0 0, 8px 8px;
    }

    :not(.checkerboard) & {
      background-color: #fff; // hardcoded
    }
  }

  video,
  img {
    object-fit: contain;

    &:not([src]) {
      visibility: hidden;
    }

    .cover & {
      object-fit: cover;
      aspect-ratio: 1 / 1;
    }
  }
</style>
