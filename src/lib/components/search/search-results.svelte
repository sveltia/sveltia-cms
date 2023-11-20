<script>
  import { GridCell, GridRow, Group } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import Image from '$lib/components/common/image.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { getFolderLabelByPath } from '$lib/services/assets/view';
  import { getCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';
  import { searchResults, searchTerms } from '$lib/services/search';
</script>

<div class="wrapper">
  <header role="none">
    <h2 role="none">{$_('search_results_for_x', { values: { terms: $searchTerms } })}</h2>
  </header>
  <div role="none" class="results">
    <Group aria-labelledby="search-results-entries">
      <h3 role="none" id="search-results-entries">{$_('entries')}</h3>
      <div role="none">
        {#if $searchResults?.entries?.length}
          <ListingGrid
            viewType="list"
            aria-label={$_('entries')}
            aria-rowcount={$searchResults.entries.length}
          >
            {#each $searchResults.entries as entry (entry.id)}
              {@const { slug, locales, fileName, collectionName } = entry}
              {@const collection = getCollection(collectionName)}
              {@const file = fileName
                ? collection.files.find(({ name }) => name === fileName)
                : undefined}
              {@const { defaultLocale = 'default' } = collection._i18n}
              {@const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0]}
              {@const { content } = locales[locale] ?? {}}
              {#if content}
                <GridRow
                  on:click={() => {
                    goto(`/collections/${collectionName}/entries/${fileName || slug}`);
                  }}
                >
                  <GridCell class="image">
                    {#if !file}
                      {@const firstImageField = collection.fields?.find(
                        ({ widget }) => widget === 'image',
                      )}
                      {#await getMediaFieldURL(content[firstImageField?.name], entry) then src}
                        <Image {src} variant="icon" cover />
                      {/await}
                    {/if}
                  </GridCell>
                  <GridCell class="collection">
                    {collection.label || collection.name}
                  </GridCell>
                  <GridCell class="title">
                    {#if file}
                      {file.label}
                    {:else}
                      {content[collection.identifier_field] ||
                        content.title ||
                        content.name ||
                        content.label}
                    {/if}
                  </GridCell>
                </GridRow>
              {/if}
            {/each}
          </ListingGrid>
        {:else}
          {$_('no_entries_found')}
        {/if}
      </div>
    </Group>
    <Group aria-labelledby="search-results-assets">
      <h3 role="none" id="search-results-assets">{$_('assets')}</h3>
      <div role="none">
        {#if $searchResults?.assets?.length}
          <ListingGrid
            viewType="list"
            aria-label={$_('assets')}
            aria-rowcount={$searchResults.assets.length}
          >
            {#each $searchResults.assets as asset (asset.path)}
              {@const { path, name, folder, kind } = asset}
              <GridRow
                on:click={() => {
                  goto(`/assets/${path}`);
                }}
              >
                <GridCell class="image">
                  {#if kind === 'image'}
                    <Image {asset} variant="icon" cover />
                  {/if}
                  {#if kind === 'video'}
                    <Video {asset} variant="icon" cover />
                  {/if}
                </GridCell>
                <GridCell class="collection">
                  {$appLocale ? getFolderLabelByPath(folder) : ''}
                </GridCell>
                <GridCell class="title">
                  {name}
                </GridCell>
              </GridRow>
            {/each}
          </ListingGrid>
        {:else}
          {$_('no_files_found')}
        {/if}
      </div>
    </Group>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
  }

  header {
    display: flex;
    align-items: center;
    border-width: 0 0 1px 0;
    border-color: var(--sui-primary-border-color);
    padding: 0 16px;
    height: 40px;
    background-color: var(--sui-tertiary-background-color);

    h2 {
      font-size: var(--sui-font-size-x-large);
    }
  }

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
