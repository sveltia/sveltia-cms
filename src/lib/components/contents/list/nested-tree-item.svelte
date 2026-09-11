<script>
  import { Icon, TreeItem } from '@sveltia/ui';
  import { untrack } from 'svelte';

  // The component recursively renders itself for the child folders
  import NestedTreeItem from '$lib/components/contents/list/nested-tree-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { isDescendantPath, nestedFilterPath } from '$lib/services/contents/collection/nested';

  /**
   * @import { NestedTreeNode } from '$lib/services/contents/collection/nested/tree';
   */

  /**
   * @typedef {object} Props
   * @property {NestedTreeNode} node Folder to display.
   * @property {string} collectionName Name of the collection the folder belongs to.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    node,
    collectionName,
    /* eslint-enable prefer-const */
  } = $props();

  const { path, label, children } = $derived(node);
  const isCurrentCollection = $derived(selectedCollection.current?.name === collectionName);
  const selected = $derived(isCurrentCollection && nestedFilterPath.current === path);
  const hasCurrentDescendant = $derived(
    isCurrentCollection && isDescendantPath(path, nestedFilterPath.current),
  );

  let expanded = $state(false);

  // Open the tree down to the folder being browsed, but leave the folders the user has opened or
  // closed by hand alone
  $effect(() => {
    if (selected || hasCurrentDescendant) {
      untrack(() => {
        expanded = true;
      });
    }
  });
</script>

{#snippet childItems()}
  {#each children as child (child.path)}
    <NestedTreeItem node={child} {collectionName} />
  {/each}
{/snippet}

<TreeItem
  {label}
  {selected}
  bind:expanded
  items={children.length ? childItems : undefined}
  onSelect={() => {
    goto(`/collections/${collectionName}/filter/${path}`, { transitionType: 'forwards' });
  }}
>
  {#snippet startIcon()}
    <Icon name="folder" />
  {/snippet}
</TreeItem>
