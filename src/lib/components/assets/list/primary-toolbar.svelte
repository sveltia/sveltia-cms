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
   */

  /**
   * @typedef {object} Props
   * @property {string} rootLabel Label of the location: the asset folder or the cloud storage
   * service.
   * @property {string[]} [subfolderNames] Names of the subfolders leading to the one being browsed,
   * from the location root down. Empty at the root.
   * @property {(depth: number, back: boolean) => void} onBrowse Called to browse an ancestor of
   * the subfolder being browsed, with how many subfolder names to keep, `0` being the root, and
   * whether the ancestor is the previous page, as it is for the back button on small screens.
   * @property {Snippet} [actions] Action buttons, shown on large screens only.
   * @property {Snippet} [fab] Upload button placed in the floating action button wrapper.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    rootLabel,
    subfolderNames = [],
    onBrowse,
    actions = undefined,
    fab = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** The subfolder being browsed is the title; at the root, the location itself is. */
  const title = $derived(subfolderNames.at(-1) ?? rootLabel);
  /** Ancestor folders of the subfolder being browsed, each leading back to itself. */
  const breadcrumbs = $derived(
    subfolderNames.length
      ? [rootLabel, ...subfolderNames.slice(0, -1)].map((label, depth) => ({
          label,
          // eslint-disable-next-line jsdoc/require-jsdoc
          onClick: () => onBrowse(depth, false),
        }))
      : [],
  );
</script>

<Toolbar variant="primary" class="asset-library-toolbar" ariaLabel={_('folder')}>
  {#if env.isSmallScreen}
    <BackButton
      aria-label={_(subfolderNames.length ? 'back_to_parent_folder' : 'back_to_asset_folder_list')}
      onclick={() => {
        if (subfolderNames.length) {
          onBrowse(subfolderNames.length - 1, true);
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
