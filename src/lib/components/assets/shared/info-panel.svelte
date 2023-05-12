<script>
  import { Button } from '@sveltia/ui';
  import { flatten } from 'flat';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { getAssetURL } from '$lib/services/assets/view';
  import { user } from '$lib/services/auth';
  import { allBackendServices } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { allEntries, getCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';
  import { formatSize } from '$lib/services/utils/files';
  import { formatDuration, getMediaMetadata } from '$lib/services/utils/media';

  /** @type {Asset} */
  export let asset;

  let repoFileURL = undefined;
  let dimensions = undefined;
  let duration = undefined;

  $: ({ path, size, kind, commitAuthor, commitDate } = asset);
  $: src = getAssetURL(asset);
  $: srcPath = getAssetURL(asset, { pathOnly: true });
  $: [, extension = ''] = path.match(/\.([^.]+)$/) || [];

  $: {
    if (['image', 'video', 'audio'].includes(kind) && src) {
      (async () => {
        ({ dimensions, duration } = await getMediaMetadata(src, kind));
      })();
    }
  }

  $: {
    if ($user?.backendName !== 'local') {
      const { name, repo, branch = 'master' } = $siteConfig.backend;

      repoFileURL = `${allBackendServices[name].url.replace(
        '{repo}',
        repo,
      )}/tree/${branch}/${path}`;
    }
  }

  $: usedEntries = $allEntries.filter(({ locales }) =>
    Object.values(locales).find((content) =>
      Object.values(flatten(content)).find((value) => value === srcPath),
    ),
  );
</script>

<div class="detail">
  <section>
    <h4>{$_('kind')}</h4>
    <p>{$_(`file_type_labels.${extension}`, { default: extension.toUpperCase() })}</p>
  </section>
  <section>
    <h4>{$_('size')}</h4>
    <p>{formatSize(size)}</p>
  </section>
  {#if ['image', 'video'].includes(kind)}
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
    <p><a href={src}>{src}</a></p>
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
      <p>{commitAuthor.name || commitAuthor.email}</p>
    </section>
  {/if}
  {#if commitDate}
    <section>
      <h4>{$_('sort_keys.commit_date')}</h4>
      <p>{commitDate.toLocaleString($appLocale)}</p>
    </section>
  {/if}
  <section>
    <h4>{$_('used_in')}</h4>
    {#each usedEntries as { sha, slug, locales, collectionName, fileName } (sha)}
      {@const collection = getCollection(collectionName)}
      {@const { defaultLocale = 'default' } = collection._i18n}
      {@const { content } = locales[defaultLocale] || {}}
      <p>
        <Button
          class="link"
          on:click={() => {
            goto(`/collections/${collectionName}/entries/${fileName || slug}`);
          }}
        >
          <span>
            {collection.label || collection.name} »
            {#if collection.files}
              {collection.files.find(({ name }) => name === fileName).label}
            {:else if content}
              {content[collection.identifier_field] ||
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

    section {
      margin: 0 0 16px;
    }

    h4,
    p {
      margin: 0 0 4px;
      font-size: inherit;
      word-break: break-all;
    }
  }
</style>
