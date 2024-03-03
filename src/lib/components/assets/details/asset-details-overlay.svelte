<script>
  import { Group } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { overlaidAsset } from '$lib/services/assets';

  /**
   * A reference to the wrapper element.
   * @type {HTMLElement}
   */
  let wrapper;

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
        {#if $overlaidAsset?.kind === 'image'}
          <Image
            asset={$overlaidAsset}
            blurBackground={true}
            checkerboard={true}
            alt={$overlaidAsset.name}
          />
        {:else if $overlaidAsset?.kind === 'video'}
          <Video asset={$overlaidAsset} blurBackground={true} controls />
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
      }
    }
  }
</style>
