<script>
  import { isTextFileType } from '@sveltia/utils/file';
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import { tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Toolbar from '$lib/components/assets/details/toolbar.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { getAssetBlob, isMediaKind, overlaidAsset, showAssetOverlay } from '$lib/services/assets';

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {HTMLElement | undefined} */
  let group = undefined;
  let hidden = $state(true);
  /** @type {Blob | undefined} */
  let blob = $state();

  const kind = $derived($overlaidAsset?.kind);
  const blobURL = $derived($overlaidAsset?.blobURL);
  const name = $derived($overlaidAsset?.name);

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    if (group) {
      group.tabIndex = 0;
      group.focus();
    }
  };

  $effect(() => {
    if ($overlaidAsset) {
      (async () => {
        blob = await getAssetBlob($overlaidAsset);
      })();
    }
  });

  $effect(() => {
    if (wrapper && !group) {
      group = /** @type {HTMLElement} */ (wrapper.querySelector('[role="group"]'));

      group.addEventListener('transitionend', () => {
        if (!$showAssetOverlay) {
          hidden = true;
        }
      });
    }
  });

  $effect(() => {
    if (wrapper) {
      if ($showAssetOverlay) {
        hidden = false;
        moveFocus();
      }
    }
  });
</script>

<div
  role="group"
  class="wrapper"
  {hidden}
  inert={!$showAssetOverlay}
  aria-label={$_('asset_editor')}
  bind:this={wrapper}
>
  {#key $overlaidAsset?.sha}
    <Toolbar />
    <div role="none" class="row">
      <div role="none" class="preview">
        {#if kind && isMediaKind(kind)}
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
            {#if name?.endsWith('.md')}
              {#await marked.parse(text, { breaks: true, async: true }) then rawHTML}
                <div role="figure" class="markdown">
                  {@html DOMPurify.sanitize(rawHTML)}
                </div>
              {:catch}
                <pre role="figure">{text}</pre>
              {/await}
            {:else}
              <pre role="figure">{text}</pre>
            {/if}
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
</div>

<style lang="scss">
  .wrapper {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--sui-secondary-background-color);
    transition: filter 250ms;

    &[hidden] {
      display: none;
    }

    &[inert] {
      filter: opacity(0);
    }

    .row {
      flex: auto;
      display: flex;
      overflow: hidden;

      @media (width < 768px) {
        flex-direction: column;

        .preview {
          flex: none !important;
          aspect-ratio: 1 / 1;
        }

        :global {
          .detail {
            flex: auto;
            width: auto;
          }
        }
      }

      .preview {
        flex: auto;
        overflow: hidden;

        iframe,
        pre,
        .markdown {
          display: block;
          width: 100%;
          height: 100%;
        }

        pre,
        .markdown {
          margin: 0;
          padding: 16px;
          overflow: auto;
        }

        pre {
          white-space: pre-wrap;
        }
      }

      :global {
        .detail {
          background-color: var(--sui-primary-background-color);
        }
      }
    }
  }
</style>
