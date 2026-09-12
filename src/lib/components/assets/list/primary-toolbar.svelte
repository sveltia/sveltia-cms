<!--
  @component
  Primary toolbar of the Asset Library, shared by repository folders and external locations: back
  button on small screens, location title, action buttons on larger screens and the floating Upload
  button.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { FloatingActionButtonWrapper, Toolbar } from '@sveltia/ui';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Location label.
   * @property {string} [path] Folder path shown next to the title on larger screens.
   * @property {Snippet} [actions] Action buttons, shown on large screens only.
   * @property {Snippet} [fab] Upload button placed in the floating action button wrapper.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title,
    path = undefined,
    actions = undefined,
    fab = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Toolbar variant="primary" aria-label={_('folder')}>
  {#if env.isSmallScreen}
    <BackButton
      aria-label={_('back_to_asset_folder_list')}
      onclick={() => {
        goBack('/assets');
      }}
    />
  {/if}
  <h2 role="none">
    <bdi>{title}</bdi>
    {#if !env.isSmallScreen && path !== undefined}
      <span role="none" dir="ltr">/{path}</span>
    {/if}
  </h2>
  {#if !(env.isSmallScreen || env.isMediumScreen)}
    {@render actions?.()}
  {/if}
  <FloatingActionButtonWrapper>
    {@render fab?.()}
  </FloatingActionButtonWrapper>
</Toolbar>
