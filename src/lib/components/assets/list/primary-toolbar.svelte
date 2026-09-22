<!--
  @component
  Primary toolbar of the Asset Library, shared by repository folders and external locations: back
  button on small screens, location title with an optional breadcrumb, action buttons on larger
  screens and the floating Upload button.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { FloatingActionButtonWrapper, Toolbar } from '@sveltia/ui';

  import Breadcrumb from '$lib/components/common/breadcrumb.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { BreadcrumbItem } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Location label.
   * @property {BreadcrumbItem[]} [breadcrumbs] Ancestor folders shown before the title on larger
   * screens, when a subfolder is browsed.
   * @property {string} [backLabel] Label of the back button on small screens. Default: back to the
   * asset folder list.
   * @property {() => void} [onBack] Called when the back button on small screens is clicked.
   * Default: go back to the asset folder list.
   * @property {Snippet} [actions] Action buttons, shown on large screens only.
   * @property {Snippet} [fab] Upload button placed in the floating action button wrapper.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title,
    breadcrumbs = [],
    backLabel = undefined,
    onBack = undefined,
    actions = undefined,
    fab = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Toolbar variant="primary" class="asset-library-toolbar" ariaLabel={_('folder')}>
  {#if env.isSmallScreen}
    <BackButton
      aria-label={backLabel ?? _('back_to_asset_folder_list')}
      onclick={() => {
        if (onBack) {
          onBack();
        } else {
          goBack('/assets');
        }
      }}
    />
  {/if}
  <h2 role="none">
    {#if !env.isSmallScreen && breadcrumbs.length}
      <Breadcrumb items={[...breadcrumbs, { label: title }]} />
    {:else}
      <bdi>{title}</bdi>
    {/if}
  </h2>
  {#if !(env.isSmallScreen || env.isMediumScreen)}
    {@render actions?.()}
  {/if}
  <FloatingActionButtonWrapper>
    {@render fab?.()}
  </FloatingActionButtonWrapper>
</Toolbar>

<style>
  /* Two floating buttons — New Folder and Upload — sit side by side on a small screen */
  :global(.asset-library-toolbar .floating-action-button-wrapper) {
    @media (width < 768px) {
      display: flex;
      gap: 12px;
    }
  }

  h2 {
    /* A long name is cut short rather than wrapped, so the toolbar stays one line tall */
    & > bdi {
      overflow: hidden;
      min-width: 0;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    :global {
      /* An ancestor folder in the breadcrumb reads as part of the heading, only dimmed to tell it
      from the current folder. The class is repeated to make the selectors specific enough to exempt
      the labels and the separators from the small type the toolbar gives any `<span>` in the
      heading, which is a rule with a scoping class of its own */

      .breadcrumb.breadcrumb.breadcrumb {
        /* Take the whole heading, so the trail is measured against the room it can actually use */
        flex: auto;
        font-size: inherit;

        .sui.button.crumb .label,
        .sui.icon.separator,
        span.current {
          font-size: inherit;
          opacity: 1;
        }

        .sui.button.crumb .label {
          font-weight: var(--sui-font-weight-normal, normal);
        }

        span.current {
          font-weight: inherit;
        }
      }
    }
  }
</style>
