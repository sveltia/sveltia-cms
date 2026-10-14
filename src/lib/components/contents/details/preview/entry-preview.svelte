<script>
  import { _ } from '@sveltia/i18n';
  import { VisibilityObserver } from '@sveltia/ui';

  import EntryPreviewIframe from '$lib/components/contents/details/preview/entry-preview-iframe.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { immutableLoaded, loadImmutable } from '$lib/services/api/immutable';
  import {
    customPreviewStyleRegistry,
    customPreviewTemplateRegistry,
  } from '$lib/services/api/registries';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshots } from '$lib/services/contents/draft/value-map.svelte';
  import { preparePreviewTemplateProps } from '$lib/services/contents/editor/preview-templates';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    collectionName,
    fileName,
    fields = [],
  } = $derived(/** @type {EntryDraft} */ (entryDraft.current ?? {}));
  const styleURLs = $derived([...customPreviewStyleRegistry]);
  const reactComponent = $derived(customPreviewTemplateRegistry.get(fileName ?? collectionName));
  // The template receives Immutable Maps, so the props can only be built once the library is loaded
  const reactProps = $derived(
    entryDraft.current && reactComponent && immutableLoaded.current
      ? preparePreviewTemplateProps({
          entryDraft,
          // Only the values have to be detached from the draft. Snapshotting the whole draft on
          // every keystroke would also copy the collection configuration, the original entry and
          // values and the validation state, and re-render the template whenever any of them
          // changed, e.g. when a list item is expanded. The shared snapshots are used, so a locale
          // that hasn’t changed isn’t copied again
          draft: { ...entryDraft.current, currentValues: getValueMapSnapshots(entryDraft.current) },
          locale,
        })
      : undefined,
  );

  $effect(() => {
    if (reactComponent) {
      // Normally already in flight, as `CMS.registerPreviewTemplate()` starts loading the library
      /* v8 ignore next 4 -- the library is bundled with the tests, so loading can’t fail */
      loadImmutable().catch((/** @type {Error} */ error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
    }
  });
</script>

{#snippet children()}
  {#each fields as fieldConfig (fieldConfig.name)}
    <!-- Mark the field outside its observer, so that focusing it in the Edit Pane can scroll the
      preview to it even before it’s rendered -->
    <div role="none" data-lazy-key-path={fieldConfig.name}>
      <VisibilityObserver>
        <FieldPreview
          keyPath={fieldConfig.name}
          typedKeyPath={fieldConfig.name}
          {locale}
          {fieldConfig}
        />
      </VisibilityObserver>
    </div>
  {/each}
{/snippet}

<VisibilityObserver>
  {#if reactComponent && reactProps}
    <EntryPreviewIframe {locale} {styleURLs} {reactComponent} {reactProps} />
  {:else if styleURLs.length}
    <EntryPreviewIframe {locale} {styleURLs} {children} />
  {:else}
    <div role="document" aria-label={_('content_preview')}>
      {@render children()}
    </div>
  {/if}
</VisibilityObserver>

<style>
  [role='document'] {
    --entry-preview-padding-block: 8px;
    --entry-preview-padding-inline: 16px;
    padding-block: var(--entry-preview-padding-block);
    padding-inline: var(--entry-preview-padding-inline);
    /* Keep the content written by other users within the preview, even if it’s positioned */
    contain: paint;
  }
</style>
