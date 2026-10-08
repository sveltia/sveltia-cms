<script>
  import { _ } from '@sveltia/i18n';
  import { Icon } from '@sveltia/ui';
  import { removeVisibilityResolver, waitForVisibility } from '@sveltia/utils/element';
  import { onMount, untrack } from 'svelte';

  import {
    getAssetBlobURL,
    getAssetThumbnailURL,
    revokeAssetBlobURLIfNeeded,
    revokeBlobURLIfNeeded,
  } from '$lib/services/assets/info';
  import { hasPDFThumbnail, THUMBNAIL_KINDS } from '$lib/services/assets/kinds';
  import { requestFlushSync } from '$lib/services/utils/render';
  import { watchAsync } from '$lib/services/utils/state.svelte';

  /**
   * @import { Asset, AssetKind } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetKind} kind Asset type.
   * @property {'lazy' | 'eager'} [loading] Loading method.
   * @property {Asset} [asset] Asset.
   * @property {string} [src] Source URL.
   * @property {'tile' | 'icon'} [variant] Style variant.
   * @property {boolean} [blurBackground] Whether to show a blurred background (like Slack’s media
   * overlay).
   * @property {boolean} [cover] Whether to use `object-fit: cover`.
   * @property {boolean} [checkerboard] Whether to show a checkerboard background below a
   * transparent image.
   * @property {boolean} [dissolve] Whether to add a short dissolve transition (fade-in effect) to
   * the image/video when it’s first loaded to avoid a sudden appearance.
   * @property {string} [alt] Alt text for the image.
   * @property {boolean} [controls] Whether to show controls for audio/video. If this is `false` and
   * {@link kind} is `audio`, an icon will be displayed instead.
   * @property {() => void} [onError] Function called once the preview falls back to an icon because
   * the media can’t be loaded, either as its URL lookup has failed or as the element has failed to
   * load it.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    kind,
    loading = 'lazy',
    asset = undefined,
    src = undefined,
    variant = undefined,
    blurBackground = false,
    cover = false,
    checkerboard = false,
    dissolve = true,
    alt = '',
    controls = false,
    onError = () => undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLImageElement | HTMLMediaElement | undefined} */
  let mediaElement = $state();
  let hasError = $state(false);
  let loaded = $state(false);
  /** @type {string | undefined} */
  let blurImageURL = $state();
  /**
   * The source URL: the `src` property, or for the `asset`-based flow, the URL looked up in
   * {@link updateSrc}. A change of the property replaces the looked-up URL.
   */
  let resolvedSrc = $derived(src);
  /**
   * The actual `src` applied to the media element. For the `asset`-based flow this mirrors
   * {@link resolvedSrc} (which is set after a visibility check inside {@link updateSrc}). For an
   * externally-provided `src` with `loading === 'lazy'`, it is deferred via
   * {@link waitForVisibility} so that the browser does not eagerly fetch off-screen images in grid
   * layouts.
   * @type {string | undefined}
   */
  let mediaSrc = $state();

  const isThumbnail = $derived(!!asset && !!variant && !controls);
  const isImage = $derived(
    kind === 'image' ||
      (!!asset && hasPDFThumbnail(asset.name)) ||
      (isThumbnail && THUMBNAIL_KINDS.includes(kind)),
  );

  let updatingSrc = false;
  /**
   * Object URLs created by this preview. Every `getAssetThumbnailURL()` call returns a URL of its
   * own, so these have to be released here — `revokeAssetBlobURLIfNeeded()` only knows about the
   * one URL shared on the asset itself. Kept outside the reactive graph so the cleanup below can
   * read it after the component is destroyed.
   * @type {string[]}
   */
  const ownedURLs = [];
  /**
   * The asset this preview last rendered, kept outside the reactive graph like {@link ownedURLs}.
   *
   * The cleanup below runs while the component is being destroyed, and reading the `asset` prop
   * there would read whatever the parent passes it from — a `$derived` holding the thumbnail of a
   * collapsed Object field or List item. Svelte answers a read made while an effect is being torn
   * down by walking that derived’s dependency graph to see whether it has to be recomputed, and
   * that walk doesn’t memoize: in a deeply nested entry editor, where every level multiplies the
   * number of paths to the same derived, expanding one field froze the browser for tens of seconds.
   * The cleanup reads this copy instead, so it touches nothing reactive.
   * @type {Asset | undefined}
   * @see https://github.com/sveltia/sveltia-cms/issues/1006
   */
  let currentAsset = undefined;
  /**
   * Whether the component has been destroyed. A URL lookup that finishes afterwards releases what
   * it created, as the cleanup below has already run, and reads nothing reactive.
   */
  let destroyed = false;

  /**
   * Remember an object URL this preview created, so that it can be released later.
   * @param {string | undefined} url Object URL.
   */
  const ownURL = (url) => {
    if (url && !ownedURLs.includes(url)) {
      ownedURLs.push(url);
    }
  };

  /**
   * Release an object URL this preview created, once no element is displaying it any more.
   * @param {string | undefined} url Object URL.
   */
  const releaseOwnedURL = (url) => {
    const index = url ? ownedURLs.indexOf(url) : -1;

    if (index > -1) {
      ownedURLs.splice(index, 1);
      revokeBlobURLIfNeeded(url);
    }
  };

  /**
   * Update the {@link resolvedSrc} value.
   */
  const updateSrc = async () => {
    /* v8 ignore next 3 -- the effect below only calls this for a mounted asset, one at a time */
    if (!asset || !mediaElement || updatingSrc) {
      return;
    }

    updatingSrc = true;
    hasError = false;

    if (loading === 'lazy') {
      await waitForVisibility(mediaElement);
    }

    // Read up front, as a derived can’t be read once the component has been destroyed
    const previousSrc = resolvedSrc;
    const thumbnail = isThumbnail;
    let nextSrc = previousSrc;

    try {
      const url = thumbnail ? await getAssetThumbnailURL(asset) : await getAssetBlobURL(asset);

      // The preview was removed while the URL was being looked up. Release it as the cleanup does,
      // which skips a URL another element is displaying
      if (destroyed) {
        revokeBlobURLIfNeeded(url);

        return;
      }

      nextSrc = url;
      resolvedSrc = url;
    } catch {
      hasError = true;
    }

    if (thumbnail) {
      ownURL(nextSrc);
    }

    if (previousSrc !== nextSrc) {
      releaseOwnedURL(previousSrc);
    }

    if (blurBackground && !blurImageURL && nextSrc) {
      blurImageURL = nextSrc;
    }

    updatingSrc = false;

    // For some reason this is required to update the `$effect` calling `checkLoaded()`, otherwise
    // navigating from `/assets` to `/assets/<collection>` on small screen leaves the preview empty.
    // Queued rather than immediate, so a grid full of previews settling at once costs one flush
    // instead of one per preview.
    requestFlushSync();
  };

  /**
   * Update the {@link loaded} state when the media is loaded.
   */
  const checkLoaded = async () => {
    /* v8 ignore next 3 -- the effect below only calls this once the media has a source */
    if (!mediaElement || !mediaSrc) {
      return;
    }

    // The element’s own readiness only means anything once the DOM actually reflects `mediaSrc`.
    // An `<img>` whose `src` attribute hasn’t been written yet reports `complete === true`, which
    // would otherwise mark the preview loaded — and, back when that signal also revoked the blob
    // URL, kill the image just as the real `src` was applied. @see
    // https://github.com/sveltia/sveltia-cms/issues/944
    const isSrcApplied = mediaElement.getAttribute('src') === mediaSrc;

    const isReady =
      isSrcApplied &&
      (isImage
        ? /** @type {HTMLImageElement} */ (mediaElement).complete
        : !!(/** @type {HTMLMediaElement} */ (mediaElement).readyState));

    if (!isReady) {
      // Not loaded yet; wait until it’s ready
      const failed = await new Promise((resolve) => {
        mediaElement?.addEventListener(isImage ? 'load' : 'loadedmetadata', () => resolve(false), {
          once: true,
        });
        mediaElement?.addEventListener('error', () => resolve(true), { once: true });
      });

      if (failed) {
        // Show the fallback icon rather than an empty tile that never finishes its transition
        hasError = true;

        return;
      }
    }

    // The preview may have been removed while the media was loading
    /* v8 ignore next 3 */
    if (!mediaElement) {
      return;
    }

    // Enable a dissolve transition
    if (dissolve) {
      await waitForVisibility(mediaElement);
    }

    loaded = true;
  };

  $effect(() => {
    // `blurImageURL` is only rendered when `blurBackground` is enabled, so don’t look up — and
    // create an object URL for — a thumbnail that nothing will display. Every thumbnail in an asset
    // grid would otherwise pay for a blurred backdrop it never shows.
    if (blurBackground && asset && !blurImageURL) {
      (async () => {
        const url = await getAssetThumbnailURL(asset, { cacheOnly: true });

        // The preview was removed while the thumbnail was being looked up
        if (destroyed) {
          revokeBlobURLIfNeeded(url);

          return;
        }

        blurImageURL = url;
        ownURL(blurImageURL);
      })();
    }
  });

  $effect(() => {
    // An asset on an external location comes as a plain URL rather than an `Asset`, and has no
    // cached thumbnail, so the image itself doubles as the blurred backdrop
    if (blurBackground && !asset && kind === 'image' && resolvedSrc) {
      blurImageURL = resolvedSrc;
    }
  });

  $effect(() => {
    currentAsset = asset;
  });

  // Notify the parent of a failure, whether the URL lookup or the media element has failed
  $effect(() => {
    if (hasError) {
      untrack(() => onError());
    }
  });

  $effect(() => {
    if (mediaElement && asset) {
      updateSrc();
    }
  });

  // The source can change or go away before the element becomes visible, which `watchAsync` takes
  // care of
  watchAsync(
    () => {
      // For the asset-based flow, `resolvedSrc` is set by `updateSrc` after a visibility check
      if (asset || !resolvedSrc || !mediaElement || loading !== 'lazy') {
        mediaSrc = resolvedSrc;

        return undefined;
      }

      // For externally-provided `src`, use Intersection Observer instead of relying on the native
      // `loading="lazy"` attribute, which browsers may ignore in grid/flex layouts
      mediaSrc = undefined;

      const currentSrc = resolvedSrc;
      const element = mediaElement;

      return (async () => {
        await waitForVisibility(element);

        return currentSrc;
      })();
    },
    (currentSrc) => {
      mediaSrc = currentSrc;
    },
  );

  $effect(() => {
    if (mediaElement && mediaSrc) {
      checkLoaded();
    }
  });

  // eslint-disable-next-line arrow-body-style
  onMount(() => {
    // Clean up
    return () => {
      destroyed = true;

      if (currentAsset) {
        revokeAssetBlobURLIfNeeded(currentAsset);
      }

      // The revocation is batched into the next frame and skips any URL an element is still
      // displaying, which is what keeps an image that hasn’t finished decoding — or one that
      // outlives this component — from losing its source. @see
      // https://github.com/sveltia/sveltia-cms/issues/944
      ownedURLs.splice(0).forEach((url) => {
        revokeBlobURLIfNeeded(url);
      });

      if (mediaElement) {
        removeVisibilityResolver(mediaElement);
      }
    };
  });
</script>

<div
  role="none"
  class="preview {variant}"
  class:cover
  class:checkerboard
  class:dissolve
  class:loaded
>
  {#if hasError}
    <Icon name="draft" />
  {:else if isImage}
    <img {loading} src={mediaSrc} {alt} {...rest} bind:this={mediaElement} />
  {:else if kind === 'video'}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      src={mediaSrc}
      controls={controls || undefined}
      playsinline
      {...rest}
      bind:this={mediaElement}
    ></video>
  {:else if kind === 'audio'}
    {#if controls}
      <audio src={mediaSrc} controls playsinline {...rest} bind:this={mediaElement}></audio>
    {:else}
      <Icon name="audio_file" />
    {/if}
  {:else}
    <Icon name="draft" />
  {/if}
  {#if blurBackground}
    <div role="none" class="blur">
      <div role="status" class="overlay">
        {#if !isThumbnail && !loaded}
          {_('loading')}
        {/if}
      </div>
      <img role="none" loading="lazy" src={blurImageURL} alt="" class:loaded={!!blurImageURL} />
    </div>
  {/if}
</div>

<style>
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
      padding: var(--tile-padding, 12px);

      :global(.sui.icon) {
        font-size: 48px;
      }
    }

    &.icon {
      border-radius: var(--sui-control-medium-border-radius);
      width: var(--icon-size, 32px);
      height: var(--icon-size, 32px);
    }

    &:is(.tile, .icon) {
      overflow: hidden;
      aspect-ratio: 1 / 1;

      img {
        /* Prevent the image from being dragged */
        pointer-events: none;
      }
    }

    .blur {
      display: contents;

      & > * {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .overlay {
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: -1;
        backdrop-filter: blur(32px) brightness(0.8);
      }

      img {
        width: 100%;
        height: 100%;
        z-index: -2;
        object-fit: cover;
        transform: scale(1.2);

        &.loaded {
          opacity: 1;
        }
      }
    }

    &.cover {
      padding: 0;

      & > :is(:global(img, video)) {
        flex: auto;
      }
    }

    & > :is(:global(img, video)) {
      flex: 0;
      max-width: 100%;
      max-height: 100%;
    }

    &.dissolve {
      :is(:global(img, video)) {
        opacity: 0;
        transition: opacity 250ms;
      }

      &.loaded {
        :is(:global(img, video)) {
          opacity: 1;
        }
      }
    }
  }

  /* prettier-ignore */
  .checkerboard img {
    /* hardcoded, the same color as the checkerboard in Photoshop */
    background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%),
      linear-gradient(45deg, #ccc 25%, #fff 25%, #fff 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 4px 4px;
  }

  :not(.checkerboard) img {
    /* hardcoded, the same color as the transparent image preview in Chrome and Firefox */
    background-color: #e5e5e5;
  }

  :is(:global(img, video)) {
    object-fit: contain;

    &:not([src]) {
      visibility: hidden;
    }
  }

  .cover :is(:global(img, video)) {
    object-fit: cover;
    aspect-ratio: 1 / 1;
  }
</style>
