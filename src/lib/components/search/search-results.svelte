<script>
  import { GridCell, Group, Row } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import BasicListView from '$lib/components/common/basic-list-view.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getAssetByPublicPath } from '$lib/services/assets';
  import { getAssetURL, getFolderLabel } from '$lib/services/assets/view';
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
          <!-- prettier-ignore -->
          {#each $searchResults.entries as
            { slug, locales, fileName, collectionName } (`${collectionName}/${fileName}/${slug}`)}
            {@const collection = getCollection(collectionName)}
            {@const file = fileName
              ? collection.files.find(({ name }) => name === fileName)
              : undefined}
            {@const { defaultLocale = 'default' } = collection._i18n}
            {@const { content } = locales[defaultLocale] || {}}
            {#if content}
              <Row
                on:click={() => {
                  goto(`/collections/${collectionName}/entries/${fileName || slug}`);
                }}
              >
                <GridCell class="image">
                  {#if !file}
                    {@const firstImageField = collection.fields?.find(
                      ({ widget }) => widget === 'image',
                    )}
                    {#if firstImageField && content[firstImageField.name]}
                      {@const asset = getAssetByPublicPath(content[firstImageField.name])}
                      <Image
                        src={asset ? getAssetURL(asset) : content[firstImageField.name]}
                        cover={true}
                      />
                    {/if}
                  {/if}
                </GridCell>
                <GridCell class="collection">
                  {collection.label}
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
              </Row>
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
            <Row
              on:click={() => {
                goto(`/assets/${path}`);
              }}
            >
              <GridCell class="image">
                {#if kind === 'image'}
                  <Image src={getAssetURL(asset)} checkerboard={true} cover={true} />
                {/if}
                {#if kind === 'video'}
                  <Video src={getAssetURL(asset)} cover={true} />
                {/if}
              </GridCell>
              <GridCell class="collection">
                {getFolderLabel(folder)}
              </GridCell>
              <GridCell class="title">
                {name}
              </GridCell>
            </Row>
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
      color: var(--secondary-foreground-color);

      & + div {
        overflow: auto;
        flex: auto;
      }
    }
  }
</style>
