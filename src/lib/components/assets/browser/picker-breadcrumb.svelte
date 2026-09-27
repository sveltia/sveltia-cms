<!--
  @component
  Breadcrumb trail of the subfolder being browsed in the asset picker. Each ancestor leads back to
  itself, like the breadcrumb of the Asset Library. Nothing is shown at the root.
-->
<script>
  import Breadcrumb from '$lib/components/common/breadcrumb.svelte';
  import { getFolderBreadcrumbItems } from '$lib/services/assets/subfolders';

  /**
   * @typedef {object} Props
   * @property {string} rootLabel Label of the location root: the asset folder or the cloud storage
   * service.
   * @property {string} path Path of the subfolder being browsed, relative to the location root.
   * Empty at the root.
   * @property {(path: string) => void} [onNavigate] Called with the relative path of an ancestor
   * folder to go back to, or an empty string for the root.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    rootLabel,
    path,
    onNavigate = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const items = $derived(
    getFolderBreadcrumbItems({
      rootLabel,
      subfolderNames: path ? path.split('/') : [],
      /**
       * Go back to the ancestor selected in the breadcrumb.
       * @param {{ path: string }} ancestor Ancestor.
       */
      onBrowse: ({ path: ancestorPath }) => {
        onNavigate?.(ancestorPath);
      },
    }),
  );
</script>

{#if items.length}
  <Breadcrumb class="picker-breadcrumb" {items} />
{/if}

<style>
  :global(.picker-breadcrumb) {
    flex: none;
    padding: 0 8px 8px;

    :global(.current) {
      font-weight: var(--sui-font-weight-bold);
    }
  }
</style>
