<script>
  import { Group, TableCell, TableRow } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import BasicListView from '$lib/components/common/basic-list-view.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { getFolderLabelByPath } from '$lib/services/assets/view';
  import { getCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';
  import { searchResults } from '$lib/services/search';
</script>

<div class="results">
  <Group aria-labelledby="search-results-entries">
    <h3 id="search-results-entries">{$_('entries')}</h3>
    <div>
      {#if $searchResults?.entries?.length}
        <BasicListView>
          {#each $searchResults.entries as entry (entry.id)}
            {@const { slug, locales, fileName, collectionName } = entry}
            {@const collection = getCollection(collectionName)}
            {@const file = fileName
              ? collection.files.find(({ name }) => name === fileName)
              : undefined}
            {@const { defaultLocale = 'default' } = collection._i18n}
            {@const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0]}
            {@const { content } = locales[locale] || {}}
            {#if content}
              <TableRow
                on:click={() => {
                  goto(`/collections/${collectionName}/entries/${fileName || slug}`);
                }}
              >
                <TableCell class="image">
                  {#if !file}
                    {@const firstImageField = collection.fields?.find(
                      ({ widget }) => widget === 'image',
                    )}
                    {#await getMediaFieldURL(content[firstImageField?.name], entry) then src}
                      <Image {src} cover={true} />
                    {/await}
                  {/if}
                </TableCell>
                <TableCell class="collection">
                  {collection.label || collection.name}
                </TableCell>
                <TableCell class="title">
                  {#if file}
                    {file.label}
                  {:else}
                    {content[collection.identifier_field] ||
                      content.title ||
                      content.name ||
                      content.label}
                  {/if}
                </TableCell>
              </TableRow>
            {/if}
          {/each}
        </BasicListView>
      {:else}
        {$_('no_entries_found')}
      {/if}
    </div>
  </Group>
  <Group aria-labelledby="search-results-assets">
    <h3 id="search-results-assets">{$_('assets')}</h3>
    <div>
      {#if $searchResults?.assets?.length}
        <BasicListView>
          {#each $searchResults.assets as asset (asset.path)}
            {@const { path, name, folder, kind } = asset}
            <TableRow
              on:click={() => {
                goto(`/assets/${path}`);
              }}
            >
              <TableCell class="image">
                {#if kind === 'image'}
                  <Image {asset} checkerboard={true} cover={true} />
                {/if}
                {#if kind === 'video'}
                  <Video {asset} cover={true} />
                {/if}
              </TableCell>
              <TableCell class="collection">
                {$appLocale ? getFolderLabelByPath(folder) : ''}
              </TableCell>
              <TableCell class="title">
                {name}
              </TableCell>
            </TableRow>
          {/each}
        </BasicListView>
      {:else}
        {$_('no_files_found')}
      {/if}
    </div>
  </Group>
</div>

<style lang="scss">
  .results {
    flex: auto;
    display: flex;
    gap: 16px;
    overflow: hidden;
    padding: 16px;
    height: 100%;

    & > :global(.group) {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      width: 50%;
      height: 100%;
    }

    h3 {
      flex: none;
      margin: 0 0 8px;
      color: var(--sui-secondary-foreground-color);

      & + div {
        overflow: auto;
        flex: auto;
      }
    }
  }
</style>
