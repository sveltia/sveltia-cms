<script>
  import { Group, Icon, Listbox, Option } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { allAssetPaths, selectedAssetFolderPath } from '$lib/services/assets';
  import { getFolderLabel } from '$lib/services/assets/view';
  import { goto } from '$lib/services/navigation';
</script>

<Group class="primary-sidebar">
  <section>
    <h2>{$_('collections')}</h2>
    <Listbox>
      {#each ['', ...$allAssetPaths.map(({ internalPath }) => internalPath)] as folderPath}
        {@const selected = folderPath === $selectedAssetFolderPath}
        <Option
          {selected}
          label={getFolderLabel(folderPath)}
          on:click={() => {
            goto(folderPath ? `/assets/${folderPath}` : `/assets`);
          }}
          on:dragover={(event) => {
            event.preventDefault();

            if (!folderPath || selected) {
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
