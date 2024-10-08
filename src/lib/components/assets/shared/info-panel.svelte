<script>
  import { Button } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import mime from 'mime';
  import { _, locale as appLocale } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getAssetDetails, isMediaKind } from '$lib/services/assets';
  import { getCollectionsByEntry, getFilesByEntry } from '$lib/services/contents';
  import { getEntryTitle } from '$lib/services/contents/entry';
  import { dateFormatOptions, timeFormatOptions } from '$lib/services/utils/date';
  import { formatSize } from '$lib/services/utils/file';
  import { formatDuration } from '$lib/services/utils/media';

  /**
   * @type {Asset}
   */
  export let asset;

  /**
   * Whether to show the media preview.
   */
  export let showPreview = false;

  $: ({ path, size, kind, commitAuthor, commitDate } = asset);
  $: ({ extension = '' } = getPathInfo(path));
  $: canPreview = isMediaKind(kind) || path.endsWith('.pdf');

  /**
   * @type {string | undefined}
   */
  let publicURL = undefined;
  /**
   * @type {string | undefined}
   */
  let repoBlobURL = undefined;
  /**
   * @type {{ width: number, height: number } | undefined}
   */
  let dimensions = undefined;
  /**
   * @type {number | undefined}
   */
  let duration = undefined;
  /**
   * @type {Entry[]}
   */
  let usedEntries = [];

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    ({
      publicURL = undefined,
      repoBlobURL = undefined,
      dimensions = undefined,
      duration = undefined,
      usedEntries = [],
    } = asset ? await getAssetDetails(asset) : {});
  };

  $: {
    void asset;
    updateProps();
  }
</script>

{#snippet usedEntryLink(
  /** @type {Record<string, string>} */ { link, collectionLabel, entryLabel },
)}
  <p>
    <Button role="link" variant="link" onclick={() => goto(link)}>
      <span role="none">{collectionLabel} › {entryLabel}</span>
    </Button>
  </p>
{/snippet}

<div role="none" class="detail">
  {#if showPreview && canPreview}
    <div role="none" class="preview">
      <AssetPreview
        {kind}
        {asset}
        variant="tile"
        checkerboard={kind === 'image'}
        controls={['audio', 'video'].includes(kind)}
      />
    </div>
  {/if}
  <section>
    <h4>{$_('kind')}</h4>
    <p>
      {$_(`file_type_labels.${extension}`, {
        default: mime.getType(path) ?? extension.toUpperCase(),
      })}
    </p>
  </section>
  <section>
    <h4>{$_('size')}</h4>
    <p>{$appLocale ? formatSize(size) : ''}</p>
  </section>
  {#if canPreview}
    <section>
      <h4>{$_('dimensions')}</h4>
      <p>{dimensions ? `${dimensions.width}×${dimensions.height}` : '–'}</p>
    </section>
  {/if}
  {#if ['audio', 'video'].includes(kind)}
    <section>
      <h4>{$_('duration')}</h4>
      <p>{duration ? formatDuration(duration) : '–'}</p>
    </section>
  {/if}
  <section>
    <h4>{$_('public_url')}</h4>
    <p>
      {#if publicURL}
        <a href={publicURL}>{publicURL}</a>
      {:else}
        –
      {/if}
    </p>
  </section>
  <section>
    <h4>{$_('file_path')}</h4>
    <p>
      {#if repoBlobURL}
        <a href={repoBlobURL}>/{path}</a>
      {:else}
        /{path}
      {/if}
    </p>
  </section>
  {#if commitAuthor}
    <section>
      <h4>{$_('sort_keys.commit_author')}</h4>
      <p>{commitAuthor.name || commitAuthor.login || commitAuthor.email}</p>
    </section>
  {/if}
  {#if commitDate}
    <section>
      <h4>{$_('sort_keys.commit_date')}</h4>
      <p>
        {commitDate.toLocaleString($appLocale ?? undefined, {
          ...dateFormatOptions,
          ...timeFormatOptions,
        })}
      </p>
    </section>
  {/if}
  <section>
    <h4>{$_('used_in')}</h4>
    {#each usedEntries as entry (entry.sha)}
      {@const { slug } = entry}
      {#each getCollectionsByEntry(entry) as collection (collection.name)}
        {@const collectionLabel = collection.label || collection.name}
        {#each getFilesByEntry(collection, entry) as collectionFile (collectionFile.name)}
          {@render usedEntryLink({
            link: `/collections/${collection.name}/entries/${collectionFile.name}`,
            collectionLabel,
            entryLabel: collectionFile.label || collectionFile.name,
          })}
        {:else}
          {@render usedEntryLink({
            link: `/collections/${collection.name}/entries/${slug}`,
            collectionLabel,
            entryLabel: getEntryTitle(collection, entry, { useTemplate: true }),
          })}
        {/each}
      {/each}
    {:else}
      <p>{$_('sort_keys.none')}</p>
    {/each}
  </section>
</div>

<style lang="scss">
  .detail {
    flex: none;
    overflow-x: hidden;
    overflow-y: auto;
    width: 320px;
    padding: 16px;

    .preview {
      overflow: hidden;
      margin: 0 0 16px;
      border-radius: var(--sui-control-medium-border-radius);
      aspect-ratio: 1 / 1;
    }

    section {
      margin: 0 0 16px;

      & > :global(*) {
        margin: 0 0 4px;
        word-break: break-all;
      }
    }

    h4 {
      font-size: var(--sui-font-size-small);
      font-weight: 600;
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
