<script>
  import { _ } from 'svelte-i18n';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import EntryPreviewIframe from '$lib/components/contents/details/preview/entry-preview-iframe.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { customPreviewStyle } from '$lib/services/contents/editor';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
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

  const fields = $derived($entryDraft?.fields ?? []);

  /**
   * Custom stylesheet URL registered with the `CMS.registerPreviewStyle()` API.
   * @type {string | undefined}
   * @see https://decapcms.org/docs/customization/
   */
  const styleURL = customPreviewStyle.href;
</script>

{#snippet children()}
  {#each fields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldPreview keyPath={fieldConfig.name} {locale} {fieldConfig} />
    </VisibilityObserver>
  {/each}
{/snippet}

<VisibilityObserver>
  {#if styleURL}
    <EntryPreviewIframe {locale} {styleURL} {children} />
  {:else}
    <div role="document" aria-label={$_('content_preview')}>
      {@render children()}
    </div>
  {/if}
</VisibilityObserver>

<style lang="scss">
  div {
    padding: 8px 16px;
  }
</style>
