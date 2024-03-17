<script>
  import { Button } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getAssetDetails } from '$lib/services/assets';
  import { getCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';
  import { formatSize } from '$lib/services/utils/files';
  import { formatDuration } from '$lib/services/utils/media';

  /**
   * @type {Asset}
   */
  export let asset;

  /**
   * Whether to show the media preview.
   */
  export let showPreview = false;

  $: ({ path, size, kind, commitAuthor, commitDate, repoFileURL } = asset);
  $: [, extension = ''] = path.match(/\.([^.]+)$/) ?? [];
  $: canPreview = ['image', 'audio', 'video'].includes(kind);

  /**
   * @type {string | undefined}
   */
  let publicURL;
  /**
   * @type {{ width: number, height: number } | undefined}
   */
  let dimensions;
  /**
   * @type {number | undefined}
   */
  let duration;
  /**
   * @type {Entry[]}
   */
  let usedEntries = [];

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    ({ publicURL, dimensions, duration, usedEntries } = await getAssetDetails(asset));
  };

  $: {
    void asset;
    updateProps();
  }
</script>

<div role="none" class="detail">
  {#if showPreview && canPreview}
    <div role="none" class="preview">
      <AssetPreview
        {kind}
        {asset}
        variant="tile"
        checkerboard={kind === 'image'}
        controls={kind === 'audio' || kind === 'video'}
      />
    </div>
  {/if}
  <section>
    <h4>{$_('kind')}</h4>
    <p>{$_(`file_type_labels.${extension}`, { default: extension.toUpperCase() })}</p>
  </section>
  <section>
    <h4>{$_('size')}</h4>
    <p>{formatSize(size)}</p>
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
      {#if repoFileURL}
        <a href={repoFileURL}>/{path}</a>
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
      <p>{commitDate.toLocaleString($appLocale ?? undefined)}</p>
    </section>
  {/if}
  <section>
    <h4>{$_('used_in')}</h4>
    {#each usedEntries as { sha, slug, locales, collectionName, fileName } (sha)}
      {@const collection = /** @type {Collection} */ (getCollection(collectionName))}
      {@const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined}
      {@const { defaultLocale } = (collectionFile ?? collection)._i18n}
      {@const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0]}
      {@const { content } = locales[locale]}
      <p>
        <Button
          role="link"
          variant="link"
          on:click={() => {
            goto(`/collections/${collectionName}/entries/${fileName || slug}`);
          }}
        >
          <span role="none">
            {collection.label || collection.name} »
            {#if collectionFile}
              {collectionFile.label || collectionFile.name}
            {:else if content}
              {content[collection.identifier_field ?? ''] ||
                content.title ||
                content.name ||
                content.label}
            {/if}
          </span>
        </Button>
      </p>
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
    }

    h4 {
      font-size: var(--sui-font-size-small);
      font-weight: 600;
      color: var(--sui-secondary-foreground-color);
    }

    h4,
    p {
      margin: 0 0 4px;
      word-break: break-all;
    }
  }
</style>
