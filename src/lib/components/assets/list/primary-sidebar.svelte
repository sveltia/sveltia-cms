<script>
  import { Group, Icon, Listbox, Option } from '@sveltia/ui';
  import { _, locale } from 'svelte-i18n';
  import { allAssetPaths, selectedAssetFolderPath } from '$lib/services/assets';
  import { getFolderLabelByCollection } from '$lib/services/assets/view';
  import { goto } from '$lib/services/navigation';

  $: folders = [{ collectionName: '*', internalPath: undefined }, ...$allAssetPaths];
</script>

<Group class="primary-sidebar">
  <section>
    <h2>{$_('collections')}</h2>
    <Listbox>
      {#each folders as { collectionName, internalPath } (collectionName)}
        {@const selected = internalPath === $selectedAssetFolderPath}
        <Option
          {selected}
          label={$locale ? getFolderLabelByCollection(collectionName) : ''}
          on:click={() => {
            goto(internalPath ? `/assets/${internalPath}` : `/assets`);
          }}
          on:dragover={(event) => {
            event.preventDefault();

            if (!internalPath || selected) {
              event.dataTransfer.dropEffect = 'none';
            } else {
              event.dataTransfer.dropEffect = 'move';
              /** @type {HTMLElement} */ (event.target).classList.add('dragover');
            }
          }}
          on:dragleave={(event) => {
            event.preventDefault();
            /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
          }}
          on:dragend={(event) => {
            event.preventDefault();
            /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
          }}
          on:drop={(event) => {
            event.preventDefault();
            /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
            // @todo Move the assets while updating entries using the files, after showing a
            // confirmation dialog.
          }}
        >
          <Icon slot="start-icon" name="folder" />
        </Option>
      {/each}
    </Listbox>
  </section>
</Group>
