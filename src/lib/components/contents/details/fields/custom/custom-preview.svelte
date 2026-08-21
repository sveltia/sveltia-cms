<!--
  @component
  Render a custom field preview registered via `CMS.registerFieldType()`.
  @see https://decapcms.org/docs/custom-widgets/
  @see https://sveltiacms.app/en/docs/api/field-types
-->
<script>
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { onMount } from 'svelte';

  import { fieldStateContext } from '$lib/services/api/field-state';
  import { entryDraft } from '$lib/services/contents/draft';
  import { buildPreviewProps } from '$lib/services/contents/fields/custom/preview';

  /**
   * @import { Root } from 'react-dom/client';
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { CustomField, CustomFieldPreview } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CustomField} fieldConfig Field configuration.
   * @property {any} currentValue Current field value.
   * @property {CustomFieldPreview} preview React component for preview.
   */

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
  /** @type {Root | undefined} */
  let reactRoot = $state();

  /**
   * Render the React component with the current props.
   */
  const renderComponent = () => {
    if (!container) {
      return;
    }

    const props = buildPreviewProps({
      locale,
      fieldConfig,
      currentValue,
      draft: $entryDraft,
      preview,
    });

    if (props) {
      reactRoot ??= createRoot(container);

      // Provide the state of this field to any built-in field preview reused within the custom
      // preview, which is typically given an ad hoc field configuration that doesn’t describe it
      reactRoot.render(
        createElement(
          fieldStateContext.Provider,
          { value: { locale, keyPath } },
          createElement(preview, props),
        ),
      );
    }
  };

  onMount(() => {
    renderComponent();

    return () => {
      reactRoot?.unmount();
    };
  });

  $effect(() => {
    // This depends on the whole `$entryDraft` (read indirectly via `buildPreviewProps()`), because
    // a custom preview receives `entry` and `fieldsMetaData` and may render values from any field.
    // The expensive part is shared between previews via a cache, so the re-render stays cheap.
    if (reactRoot) {
      renderComponent();
    }
  });
</script>

<div bind:this={container}></div>

<style>
  div {
    /* Allow the React component to use the full width */
    width: 100%;
  }
</style>
