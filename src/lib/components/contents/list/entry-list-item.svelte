<script>
  import { Checkbox, GridCell, Row } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { getAssetByPublicPath } from '$lib/services/assets';
  import { getAssetURL } from '$lib/services/assets/view';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { parseSummary } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';

  /** @type {Entry} */
  export let entry;

  /** @type {EntryContent} */
  export let content;

  $: firstImageField = $selectedCollection.fields?.find(({ widget }) => widget === 'image');
</script>

<Row
  aria-selected={$selectedEntries.includes(entry)}
  on:click={() => {
    goto(`/collections/${$selectedCollection.name}/entries/${entry.slug}`);
  }}
>
  <GridCell class="checkbox">
    <Checkbox
      checked={$selectedEntries.includes(entry)}
      on:change={({ detail: { checked } }) => {
        selectedEntries.update((_entries) => {
          const index = _entries.indexOf(entry);

          if (_entries && index === -1) {
            _entries.push(entry);
          }

          if (!checked && index > -1) {
            _entries.splice(index, 1);
          }

          return _entries;
        });
      }}
    />
  </GridCell>
  {#if firstImageField}
    <GridCell class="image">
      {#if content[firstImageField.name]}
        {@const asset = getAssetByPublicPath(content[firstImageField.name])}
        <Image src={asset ? getAssetURL(asset) : content[firstImageField.name]} cover={true} />
      {/if}
    </GridCell>
  {/if}
  <GridCell class="title">
    <span>
      {#if $selectedCollection.summary}
        {parseSummary($selectedCollection, content)}
      {:else}
        <!--
        Fields other than `title` should be defined with `identifier_field` as per the
        Netlify document, but actually, `name` also works as a fallback.
      -->
        {content[$selectedCollection.identifier_field] ||
          content.title ||
          content.name ||
          content.label}
      {/if}
    </span>
  </GridCell>
</Row>
