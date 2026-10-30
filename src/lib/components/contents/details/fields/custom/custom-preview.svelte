<!--
  @component
  Render a custom field preview registered via `CMS.registerFieldType()`, or the summary component
  of a custom field type for a collapsed List field item, which receives the same props.
  @see https://decapcms.org/docs/custom-widgets/
  @see https://sveltiacms.app/en/docs/api/field-types
-->
<script>
  import { createElement } from 'react';

  import { assetURLUpdates } from '$lib/services/api/asset-proxy';
  import { fieldStateContext } from '$lib/services/api/field-state';
  import { createReactRenderer } from '$lib/services/api/react-dom.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { buildPreviewProps } from '$lib/services/contents/fields/custom/preview';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { CustomField, CustomFieldPreview } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CustomField} fieldConfig Field configuration.
   * @property {any} currentValue Current field value.
   * @property {CustomFieldPreview} preview React component for preview, or a summary component.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    currentValue,
    preview,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let container = $state();
  /**
   * Renderer of the preview, which is a React component receiving Immutable Maps.
   */
  const reactRenderer = createReactRenderer(() => container);

  /**
   * Render the React component with the current props.
   */
  const renderComponent = () => {
    /* v8 ignore next 3 -- the effect below only calls this once everything is ready */
    if (!reactRenderer.ready) {
      return;
    }

    const props = buildPreviewProps({
      locale,
      keyPath,
      fieldConfig,
      currentValue,
      draft: entryDraft.current,
      preview,
    });

    if (props) {
      // Provide the state of this field to any built-in field preview reused within the custom
      // preview, which is typically given an ad hoc field configuration that doesn’t describe it
      reactRenderer.render(
        createElement(
          fieldStateContext.Provider,
          { value: { locale, keyPath } },
          createElement(preview, props),
        ),
      );
    }
  };

  $effect(() => {
    // A custom preview receives `entry` and `fieldsMetaData` and may render values from any field,
    // so this depends on the whole content of the locale. The expensive part is shared between
    // previews via a cache, which is why the values are not read through it and have to be tracked
    // here. The re-render stays cheap.
    void getValueMapSnapshot(entryDraft.current, locale);
    // Render again once an asset the preview got with `getAsset()` has a blob URL
    void assetURLUpdates.current;

    // Render the preview once the container and the library are ready, then keep it up to date
    if (reactRenderer.ready) {
      renderComponent();
    }
  });
</script>

<div bind:this={container}></div>

<style>
  div {
    /* Allow the React component to use the full width, but let it shrink beside a list item
      thumbnail rather than overflow */
    width: 100%;
    min-width: 0;
  }
</style>
