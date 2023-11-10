<script>
  import { Checkbox, TableCell, TableRow } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import Image from '$lib/components/common/image.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { formatSummary } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';

  /**
   * @type {Entry}
   */
  export let entry;
  /**
   * @type {EntryContent}
   */
  export let content;
  /**
   * @type {string}
   */
  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {ViewType}
   */
  export let viewType;

  $: firstImageField = $selectedCollection.fields?.find(({ widget }) => widget === 'image');
</script>

<TableRow
  selected={$selectedEntries.includes(entry)}
  on:click={() => {
    goto(`/collections/${$selectedCollection.name}/entries/${entry.slug}`);
  }}
>
  <TableCell class="checkbox">
    <Checkbox
      aria-label={$_('select_this_entry')}
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
  </TableCell>
  {#if firstImageField}
    <TableCell class="image">
      {#await getMediaFieldURL(content[firstImageField?.name], entry) then src}
        <Image {src} variant={viewType === 'list' ? 'icon' : 'tile'} />
      {/await}
    </TableCell>
  {/if}
  <TableCell class="title">
    <span>
      {formatSummary($selectedCollection, entry, locale)}
    </span>
  </TableCell>
</TableRow>
