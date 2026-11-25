<!--
  @component
  Control that opens the preview page for an entry: the deploy preview built for an unpublished
  Editorial Workflow entry when there is one, otherwise the page on the live site. It reflects the
  state of the deployment, so a build that hasn’t finished yet is presented as such instead of a
  link that would only return a 404. It renders as either a toolbar button or a menu item, because
  the entry editor offers the link in both places.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, MenuItem } from '@sveltia/ui';

  import {
    getPreviewLinkControl,
    resolveEntryPreviewLink,
  } from '$lib/services/deployments/control';
  import { pageLiveness, pingURL } from '$lib/services/deployments/ping';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import {
   * Entry,
   * InternalCollection,
   * InternalCollectionFile,
   * InternalLocaleCode,
   * WorkflowPullRequest,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Entry} entry Entry to be previewed.
   * @property {InternalLocaleCode} [locale] Locale of the entry to be previewed. Defaults to the
   * default locale of the collection file or collection, for a list or card that has no locale of
   * its own.
   * @property {InternalCollection} collection Collection that the entry belongs to.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File/singleton collection
   * only.
   * @property {WorkflowPullRequest} [pullRequest] Pull request holding the entry, if it’s an
   * unpublished Editorial Workflow entry.
   * @property {'button' | 'menuitem'} [as] Form to be rendered.
   * @property {'primary' | 'secondary' | 'tertiary' | 'ghost' | 'link'} [variant] Style variant of
   * the button. Not used when the control is rendered as a menu item.
   * @property {'small' | 'medium' | 'large'} [size] Size of the button. Not used when the control
   * is rendered as a menu item.
   * @property {boolean} [iconic] Whether to show the icon alone, for a narrow screen where the
   * label wouldn’t fit alongside the other actions. The label becomes the accessible name. Not
   * used when the control is rendered as a menu item.
   * @property {boolean} [showTooltip] Whether to show the label as a tooltip on an icon-only
   * button, where nothing else says what it does. Not used when the control is rendered as a menu
   * item.
   * @property {number} [tabindex] `tabindex` of the button, e.g. `-1` to keep it out of the Tab
   * order inside a grid row, whose arrow keys move from row to row. Not used when the control is
   * rendered as a menu item.
   * @property {boolean} [trackDeployState] Whether to follow the deploy state of a published entry
   * and check that its page is live, as the entry editor does. Defaults to `true`. A list of
   * entries turns it off for its published rows: every answer of the deploy state lookup would
   * otherwise update every row, and opening the list would send the site a request for each one.
   * The live site holds those pages, so their links are offered either way. An unpublished entry’s
   * deploy preview is always followed.
   */

  /** @type {Props} */
  let {
    entry,
    locale = undefined,
    collection,
    collectionFile,
    pullRequest,
    as = 'button',
    variant = 'ghost',
    size = 'medium',
    iconic = false,
    tabindex = undefined,
    showTooltip = false,
    trackDeployState = true,
  } = $props();

  // `pageLiveness.current` is deliberately left out of this derivation. The effect below watches
  // `url` and writes that state, so reading it here would feed the check’s own result back into the
  // URL it checks. The liveness is folded into `control` alone, which the effect doesn’t read
  // @see https://github.com/sveltia/sveltia-cms/issues/943
  const link = $derived(
    resolveEntryPreviewLink({
      entry,
      locale: locale ?? (collectionFile ?? collection)._i18n.defaultLocale,
      collection,
      collectionFile,
      pullRequest,
      trackDeployState,
    }),
  );
  const url = $derived(link?.url);
  /* v8 ignore start -- only read while there’s a link, when nothing falls back */
  const control = $derived(
    link ? getPreviewLinkControl(link, url ? pageLiveness.current[url] : undefined) : undefined,
  );
  const awaitingPreview = $derived(link?.awaitingPreview ?? false);
  const disabled = $derived(control?.disabled ?? true);
  const label = $derived(control ? _(control.labelKey) : '');
  /* v8 ignore stop */
  const description = $derived(control?.descriptionKey ? _(control.descriptionKey) : undefined);

  /**
   * Open the resolved preview page in a new browser tab.
   */
  const open = () => {
    /* v8 ignore next 3 -- the control is disabled without a URL */
    if (url) {
      openNewTab(url);
    }
  };

  $effect(() => {
    // None of these reads the liveness store this effect writes, so the check can’t retrigger
    // itself however the URL is composed. The build state reported by the provider is read, so a
    // page found missing while it was building is checked again once the build has finished
    const canPing = trackDeployState && !!link?.pingable;
    const pageURL = url;
    const buildFinished = link?.state === 'ready';

    if (canPing && pageURL) {
      pingURL(pageURL, { recheckPending: buildFinished });
    }

    return undefined;
  });
</script>

{#if link}
  {#if as === 'menuitem'}
    <MenuItem {label} {disabled} aria-description={description} onclick={open} />
  {:else}
    <Button
      {variant}
      {size}
      {iconic}
      {tabindex}
      label={iconic ? undefined : label}
      aria-label={iconic ? label : undefined}
      tooltip={iconic && showTooltip ? label : undefined}
      {disabled}
      aria-description={description}
      onclick={open}
    >
      {#snippet endIcon()}
        <div role="none" class="icon-wrapper">
          <Icon
            class={awaitingPreview ? 'spinning' : undefined}
            name={awaitingPreview ? 'progress_activity' : 'open_in_new'}
          />
        </div>
      {/snippet}
    </Button>
  {/if}
{/if}

<style>
  .icon-wrapper {
    display: contents;

    & :global(.spinning) {
      animation: spin 1.6s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      & :global(.spinning) {
        animation: none;
      }
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
