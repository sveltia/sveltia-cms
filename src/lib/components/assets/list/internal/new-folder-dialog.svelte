<!--
  @component
  New Folder dialog of the Asset Library, which creates a subfolder in the directory being browsed.
-->
<script>
  import CreateSubfolderDialog from '$lib/components/assets/list/create-subfolder-dialog.svelte';
  import { browsedDirPath, getTakenNames } from '$lib/services/assets/subfolders';
  import {
    listedAssets,
    listedSubfolders,
    showNewSubfolderDialog,
  } from '$lib/services/assets/view';

  /** Names already taken in the directory, by a subfolder or a file. */
  const takenNames = $derived(
    getTakenNames({
      subfolders: listedSubfolders.current,
      fileNames: listedAssets.current.map(({ name }) => name),
    }),
  );
</script>

<CreateSubfolderDialog
  bind:open={showNewSubfolderDialog.current}
  dirPath={browsedDirPath.current ?? ''}
  {takenNames}
/>
