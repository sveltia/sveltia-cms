<script>
  import { Group } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';
  import { tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { getAssetBlob, overlaidAsset, showAssetOverlay } from '$lib/services/assets';

  /**
   * A reference to the wrapper element.
   * @type {HTMLElement}
   */
  let wrapper;
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

    const group = /** @type {HTMLElement} */ (wrapper.querySelector('[role="group"]'));

    group.tabIndex = 0;
    group.focus();
  };

  $: {
    if (wrapper && $showAssetOverlay) {
      moveFocus();
    }
  }
</script>

<div role="none" class="wrapper" inert={!$showAssetOverlay} bind:this={wrapper}>
  <Group aria-label={$_('asset_editor')}>
    {#key $overlaidAsset?.sha}
      <Toolbar />
      <div role="none" class="row">
        <div role="none" class="preview">
          {#if ['image', 'audio', 'video'].includes(kind)}
            <AssetPreview
              {kind}
              asset={$overlaidAsset}
              blurBackground={kind === 'image' || kind === 'video'}
              checkerboard={kind === 'image'}
              alt={kind === 'image' ? name : undefined}
              controls={kind === 'audio' || kind === 'video'}
            />
          {:else if blob?.type === 'application/pdf'}
            <iframe src={blobURL} title={name} />
          {:else if blob?.type && isTextFileType(blob?.type)}
            {#await $overlaidAsset?.text ?? blob?.text() then text}
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

    & > :global(.sui.group) {
      position: fixed;
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
