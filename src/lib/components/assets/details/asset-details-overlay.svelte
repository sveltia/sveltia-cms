<script>
  import { Group } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { getAssetBlob, isMediaKind, overlaidAsset, showAssetOverlay } from '$lib/services/assets';

  /**
   * A reference to the wrapper element.
   * @type {HTMLElement}
   */
  let wrapper;
  /**
   * A reference to the group element.
   * @type {HTMLElement}
   */
  let group;
  /**
   * @type {boolean}
   */
  let hiding = false;
  /**
   * @type {boolean}
   */
  let hidden = true;
  /**
   * @type {Blob | undefined}
   */
  let blob;

  $: ({ kind, blobURL, name } = $overlaidAsset || /** @type {Asset} */ ({}));

  $: (async () => {
    if ($overlaidAsset) {
      blob = await getAssetBlob($overlaidAsset);
    }
  })();

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    group.tabIndex = 0;
    group.focus();
  };

  onMount(() => {
    group = /** @type {HTMLElement} */ (wrapper.querySelector('[role="group"]'));

    group.addEventListener('transitionend', () => {
      if (!$showAssetOverlay) {
        hiding = false;
        hidden = true;
      }
    });
  });

  $: {
    if (wrapper) {
      if ($showAssetOverlay) {
        hiding = false;
        hidden = false;
        moveFocus();
      } else {
        hiding = true;
      }
    }
  }
</script>

<div
  role="none"
  class="wrapper"
  class:hiding
  {hidden}
  inert={!$showAssetOverlay}
  bind:this={wrapper}
>
  <Group aria-label={$_('asset_editor')}>
    {#key $overlaidAsset?.sha}
      <Toolbar />
      <div role="none" class="row">
        <div role="none" class="preview">
          {#if isMediaKind(kind)}
            <AssetPreview
              {kind}
              asset={$overlaidAsset}
              blurBackground={['image', 'video'].includes(kind)}
              checkerboard={kind === 'image'}
              alt={kind === 'image' ? name : undefined}
              controls={['audio', 'video'].includes(kind)}
            />
          {:else if blob?.type === 'application/pdf'}
            <iframe src={blobURL} title={name}></iframe>
          {:else if blob?.type && isTextFileType(blob.type)}
            {#await $overlaidAsset?.text ?? blob.text() then text}
              <pre role="figure">{text}</pre>
            {/await}
          {:else}
            <EmptyState>
              <span role="alert">{$_('preview_unavailable')}</span>
            </EmptyState>
          {/if}
        </div>
        {#if $overlaidAsset}
          <InfoPanel asset={$overlaidAsset} />
        {/if}
      </div>
    {/key}
  </Group>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    &[hidden] {
      display: none;
    }

    & > :global(.sui.group) {
      position: absolute;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      background-color: var(--sui-primary-background-color);
      transition: filter 250ms;
    }

    &[inert] > :global(.sui.group) {
      filter: opacity(0);
    }

    .row {
      flex: auto;
      display: flex;
      overflow: hidden;

      .preview {
        flex: auto;
        overflow: hidden;
        border-right: 1px solid var(--sui-primary-border-color);

        iframe,
        pre {
          display: block;
          width: 100%;
          height: 100%;
        }

        pre {
          margin: 0;
          padding: 16px;
          overflow: auto;
        }
      }
    }
  }
</style>
