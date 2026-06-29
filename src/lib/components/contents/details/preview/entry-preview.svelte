<script>
  import { _ } from '@sveltia/i18n';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import EntryPreviewIframe from '$lib/components/contents/details/preview/entry-preview-iframe.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import {
    customPreviewStyleRegistry,
    customPreviewTemplateRegistry,
  } from '$lib/services/contents/api/registries';
  import { entryDraft } from '$lib/services/contents/draft';
  import { preparePreviewTemplateProps } from '$lib/services/contents/editor/preview-templates';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

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
  } = $derived(/** @type {EntryDraft} */ ($entryDraft ?? {}));
  const styleURLs = $derived([...customPreviewStyleRegistry]);
  const reactComponent = $derived(customPreviewTemplateRegistry.get(fileName ?? collectionName));
  const reactProps = $derived(
    $entryDraft && reactComponent
      ? preparePreviewTemplateProps({ draft: $state.snapshot($entryDraft), locale })
      : undefined,
  );
</script>

{#snippet children()}
  {#each fields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldPreview
        keyPath={fieldConfig.name}
        typedKeyPath={fieldConfig.name}
        {locale}
        {fieldConfig}
      />
    </VisibilityObserver>
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
  div {
    --entry-preview-padding-block: 8px;
    --entry-preview-padding-inline: 16px;
    padding-block: var(--entry-preview-padding-block);
    padding-inline: var(--entry-preview-padding-inline);
  }
</style>
