<script>
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getAssetURL, selectedAsset } from '$lib/services/assets';
</script>

<div class="editor">
  <Toolbar />
  <div class="row">
    <div class="preview">
      {#if $selectedAsset.kind === 'image'}
        <Image src={getAssetURL($selectedAsset)} alt={$selectedAsset.name} checkerboard={true} />
      {:else if $selectedAsset.kind === 'video'}
        <Video src={getAssetURL($selectedAsset)} controls />
      {:else}
        <EmptyState>
          <span>{$_('no_preview_available')}</span>
        </EmptyState>
      {/if}
    </div>
    <InfoPanel asset={$selectedAsset} />
  </div>
</div>

<style lang="scss">
  .editor {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-background-color);

    .row {
      flex: auto;
      display: flex;
      overflow: hidden;

      .preview {
        flex: auto;
        overflow: hidden;
        border-right: 1px solid var(--primary-border-color);
      }
    }
  }
</style>
