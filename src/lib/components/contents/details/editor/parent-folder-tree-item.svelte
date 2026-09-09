<script>
  import { Icon, TreeItem } from '@sveltia/ui';

  // The component recursively renders itself for the child folders
  import ParentFolderTreeItem from '$lib/components/contents/details/editor/parent-folder-tree-item.svelte';

  /**
   * @import { NestedTreeNode } from '$lib/services/contents/collection/nested/tree';
   */

  /**
   * @typedef {object} Props
   * @property {NestedTreeNode} node Folder to display.
   * @property {string} selectedPath Path of the folder the entry is currently filed in.
   * @property {(path: string) => void} onSelectPath Called with the path of the chosen folder.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    node,
    selectedPath,
    onSelectPath,
    /* eslint-enable prefer-const */
  } = $props();

  const { path, label, children } = $derived(node);
  const selected = $derived(selectedPath === path);
  // Keep the branch that holds the current folder open, so it can be seen without any digging
  const expanded = $derived(!path || selected || selectedPath.startsWith(`${path}/`));
</script>

{#snippet childItems()}
  {#each children as child (child.path)}
    <ParentFolderTreeItem node={child} {selectedPath} {onSelectPath} />
  {/each}
{/snippet}

<TreeItem
  {label}
  {selected}
  {expanded}
  items={children.length ? childItems : undefined}
  onSelect={() => {
    onSelectPath(path);
  }}
>
  {#snippet startIcon()}
    <Icon name={path ? 'folder' : 'bookmark_manager'} />
  {/snippet}
</TreeItem>
