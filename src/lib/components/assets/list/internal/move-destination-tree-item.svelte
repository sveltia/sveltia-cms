<!--
  @component
  A folder in the destination tree of the Move dialog, followed by its subfolders: a repository
  folder, or a cloud storage service or a folder on it.
-->
<script>
  import { Icon, TreeItem } from '@sveltia/ui';

  // The component recursively renders itself for the subfolders
  import MoveDestinationTreeItem from '$lib/components/assets/list/internal/move-destination-tree-item.svelte';
  import {
    getMoveDestinationIcon,
    getMoveDestinationKey,
    isBelowMoveDestination,
    isSameMoveDestination,
  } from '$lib/services/assets/data/move-destinations';

  /**
   * @import { AssetMoveDestination } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetMoveDestination} destination Folder to display.
   * @property {AssetMoveDestination | undefined} selectedDestination Selected folder, if any.
   * @property {(destination: AssetMoveDestination) => void} onSelectDestination Called with the
   * chosen folder.
   */

  /** @type {Props} */
  let { destination, selectedDestination, onSelectDestination } = $props();

  const { label, children } = $derived(destination);
  const selected = $derived(isSameMoveDestination(destination, selectedDestination));
  // Keep the branch that holds the selected folder open, so it can be seen without any digging
  const expanded = $derived(isBelowMoveDestination(destination, selectedDestination));
</script>

{#snippet childItems()}
  {#each children as child (getMoveDestinationKey(child))}
    <MoveDestinationTreeItem destination={child} {selectedDestination} {onSelectDestination} />
  {/each}
{/snippet}

<TreeItem
  {label}
  {selected}
  {expanded}
  items={children.length ? childItems : undefined}
  onSelect={() => {
    onSelectDestination(destination);
  }}
>
  {#snippet startIcon()}
    <Icon name={getMoveDestinationIcon(destination)} />
  {/snippet}
</TreeItem>
