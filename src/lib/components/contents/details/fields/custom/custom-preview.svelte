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
  import { immutableLoaded, loadImmutable } from '$lib/services/api/immutable';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
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
  /** @type {Root | undefined} */
  let reactRoot = $state();

  /**
   * Render the React component with the current props.
   */
  const renderComponent = () => {
    if (!container || !immutableLoaded.current) {
      return;
    }

    const props = buildPreviewProps({
      locale,
      fieldConfig,
      currentValue,
      draft: entryDraft.current,
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
    // The preview receives Immutable Maps. The library is normally loaded by the time the editor
    // opens, as `CMS.registerFieldType()` starts loading it, but wait for it in any case; the
    // effect below renders the preview once it’s there
    loadImmutable().catch((/** @type {Error} */ error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    });

    return () => {
      reactRoot?.unmount();
    };
  });

  $effect(() => {
    // A custom preview receives `entry` and `fieldsMetaData` and may render values from any field,
    // so this depends on the whole content of the locale. The expensive part is shared between
    // previews via a cache, which is why the values are not read through it and have to be tracked
    // here. The re-render stays cheap.
    void getValueMapSnapshot(entryDraft.current, locale);

    // Render the preview once the container and the library are ready, then keep it up to date
    if (immutableLoaded.current && container) {
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
