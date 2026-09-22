<!--
  @component
  Info panel for a folder in the Asset Library, shown in the sidebar while no asset is focused: the
  folder name, its path and what it holds. Shared by repository folders and cloud storage services,
  which work out the folder to describe.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Icon } from '@sveltia/ui';

  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';

  /**
   * @typedef {object} Props
   * @property {string} name Folder name.
   * @property {string} [path] Folder path, shown with a leading slash. Omitted for a location
   * without a path, like the All Assets folder.
   * @property {number} [folderCount] Number of subfolders. Omitted for a location that isn’t
   * browsed by subfolder, which lists every asset below it at once.
   * @property {number} assetCount Number of assets.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    name,
    path = undefined,
    folderCount = undefined,
    assetCount,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#snippet preview()}
  <div role="none" class="folder-preview">
    <Icon name="folder" />
  </div>
{/snippet}

<InfoPanelLayout {preview}>
  <section>
    <h4>{_('folder')}</h4>
    <p><bdi>{name}</bdi></p>
  </section>
  {#if path !== undefined}
    <section>
      <h4>{_('folder_path')}</h4>
      <p><bdi dir="ltr">{`/${path}`}</bdi></p>
    </section>
  {/if}
  <section>
    <h4>{_('folder_contents')}</h4>
    {#if folderCount !== undefined}
      <p>{_('x_folders', { values: { count: folderCount } })}</p>
    {/if}
    <p>{_('x_assets', { values: { count: assetCount } })}</p>
  </section>
</InfoPanelLayout>

<style>
  .folder-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sui-secondary-foreground-color);

    :global(.sui.icon) {
      font-size: 96px;
    }
  }
</style>
