<script>
  import { Group } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { getAssetBlob, overlaidAsset } from '$lib/services/assets';
  import { isTextFileType } from '$lib/services/utils/files';

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

  onMount(() => {
    const group = /** @type {HTMLElement} */ (wrapper.closest('[role="group"]'));

    // Move the focus once the overlay is loaded
    group.tabIndex = 0;
    group.focus();

    // onUnmount
    return () => {
      $overlaidAsset = undefined;
    };
  });
</script>

<Group aria-label={$_('asset_editor')}>
  <div role="none" class="wrapper" bind:this={wrapper}>
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
            <span role="alert">{$_('no_preview_available')}</span>
          </EmptyState>
        {/if}
      </div>
      {#if $overlaidAsset}
        <InfoPanel asset={$overlaidAsset} />
      {/if}
    </div>
  </div>
</Group>

<style lang="scss">
  .wrapper {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--sui-primary-background-color);

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
