<!--
  @component
  The main area of a Administration section: a toolbar with the section’s title and actions, above
  its content. On a small screen, the toolbar leads back to the Menu page, which lists the sections.
-->
<script>
  import { Spacer, Toolbar } from '@sveltia/ui';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { getAdditions } from '$lib/services/app/additions';
  import { goBack } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   * @property {Snippet} [actions] Buttons for the toolbar.
   * @property {Snippet} children Content.
   */

  /** @type {Props} */
  let { title, actions = undefined, children } = $props();

  // Sveltia CMS Additions, whose chunk is loaded along with the backend if it’s enabled
  const additions = $derived(getAdditions());
</script>

<PageContainerMainArea id="admin-container" aria-label={title}>
  {#snippet primaryToolbar()}
    <Toolbar variant="primary" ariaLabel={title}>
      {#if env.isSmallScreen}
        <BackButton
          onclick={() => {
            goBack('/menu');
          }}
        />
      {/if}
      <h2 role="none">{title}</h2>
      <Spacer flex />
      {@render actions?.()}
    </Toolbar>
  {/snippet}
  {#snippet mainContent()}
    <div role="none" class="content">
      {#if additions}
        <additions.UpdateInfobar />
      {/if}
      {@render children()}
    </div>
  {/snippet}
</PageContainerMainArea>

<style>
  h2 {
    font-size: var(--sui-font-size-x-large);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: auto;
    padding: 16px;
    height: 100%;
  }
</style>
