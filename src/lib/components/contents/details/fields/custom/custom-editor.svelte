<!--
  @component
  Render a custom field control registered via `CMS.registerFieldType()`.
  @see https://decapcms.org/docs/custom-widgets/
  @see https://sveltiacms.app/en/docs/api/field-types
-->
<script module>
  import { TextInput } from '@sveltia/ui';
  import { mount } from 'svelte';

  /** @type {string | undefined} */
  let cachedFieldClassName = undefined;

  /**
   * Get the CSS class name of a built-in text input, so that a custom control can be styled
   * consistently with built-in field types. The probe component is mounted once for the lifetime of
   * the app and intentionally never unmounted, to keep its scoped CSS available.
   *
   * `mount()` creates the DOM synchronously, so the class is readable right away. Don’t
   * `flushSync()` here: this is called from an effect, and a nested flush leaves Svelte without a
   * current batch once the effect returns, which throws when the effect has written to state it
   * also reads.
   * @returns {string} Class name, or an empty string if it could not be determined.
   */
  const getInputClassName = () => {
    if (cachedFieldClassName === undefined) {
      const target = document.createElement('div');

      mount(TextInput, { target });
      cachedFieldClassName = target.querySelector('input')?.className ?? '';
    }

    return cachedFieldClassName;
  };
</script>

<script>
  import { isObject } from '@sveltia/utils/object';
  import { createElement } from 'react';
  import { getContext, onMount } from 'svelte';

  import AssetPicker from '$lib/components/contents/details/fields/custom/asset-picker.svelte';
  import { fieldStateContext } from '$lib/services/api/field-state';
  import { immutableLoaded, loadImmutable } from '$lib/services/api/immutable';
  import { getReactDom, loadReactDom, reactDomLoaded } from '$lib/services/api/react-dom';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { updateNonPrimitiveValue } from '$lib/services/contents/draft/update';
  import {
    registerCustomFieldInstance,
    triggerCustomFieldValidation,
    unregisterCustomFieldInstance,
  } from '$lib/services/contents/draft/validate/custom-fields';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { buildControlProps, resolveControl } from '$lib/services/contents/fields/custom/editor';
  import { addFileToDraft } from '$lib/services/contents/fields/custom/files';

  /**
   * @import { Root } from 'react-dom/client';
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import {
   * CustomField,
   * CustomFieldAddFileOptions,
   * CustomFieldControl,
   * CustomFieldPickFileOptions,
   * CustomFieldPickedFile,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CustomField} fieldConfig Field configuration.
   * @property {any} currentValue Current field value.
   * @property {CustomFieldControl | string} control React component or component name string.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues', parentComponentNames = [] } =
    getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldId,
    keyPath,
    typedKeyPath,
    fieldConfig,
    currentValue,
    required = true,
    readonly = false,
    invalid = false,
    control,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let container = $state();
  /** @type {Root | undefined} */
  let reactRoot = $state();
  /** @type {any | undefined} */
  let componentInstance = $state();
  /** @type {AssetPicker | undefined} */
  let assetPicker = $state();

  const { i18n = false } = $derived(fieldConfig);
  const resolvedControl = $derived(resolveControl(control));
  const componentName = parentComponentNames.at(-1);

  /**
   * Handle value changes from the React component. Don’t use two-way binding here to avoid
   * unexpected behavior.
   * @param {any} value New value from the React component.
   */
  const handleChange = (value) => {
    const draft = entryDraft.current;

    if (!draft) {
      return;
    }

    if (Array.isArray(value) || isObject(value)) {
      updateNonPrimitiveValue({ draft, valueStoreKey, locale, keyPath, i18n, value });
    } else {
      draft[valueStoreKey][locale][keyPath] = value;
    }
  };

  /**
   * Add a file to the entry draft on behalf of the React component, so that it’s uploaded along
   * with the entry. The draft is read when the file is added rather than when the props are built,
   * so a control that keeps the function around can still use it after the draft has been updated.
   * @param {File | Blob} file File to be added.
   * @param {CustomFieldAddFileOptions} [options] Options.
   * @returns {Promise<string>} Blob URL to be stored in the field value.
   */
  const handleAddFile = async (file, options) => {
    if (!entryDraft.current) {
      throw new Error('addFile() can only be called while an entry is being edited');
    }

    return addFileToDraft({
      draft: entryDraft.current,
      fieldConfig,
      typedKeyPath,
      componentName,
      file,
      options,
    });
  };

  /**
   * Open the Select Assets dialog on behalf of the React component, so that the user can pick an
   * existing asset, upload a file, enter a URL or choose a stock photo, the way a built-in
   * File/Image field lets them.
   * @param {CustomFieldPickFileOptions} [options] Options.
   * @returns {Promise<CustomFieldPickedFile | CustomFieldPickedFile[] | null>} Picked file(s), or
   * `null` if the dialog is dismissed.
   * @throws {Error} When no entry is being edited.
   */
  const handlePickFile = async (options) => {
    if (!assetPicker) {
      throw new Error('pickFile() can only be called while an entry is being edited');
    }

    return assetPicker.pick(options);
  };

  /**
   * React ref callback to capture the component instance. React calls this with `null` on detach.
   * @param {any} instance The React component instance.
   */
  const handleRef = (instance) => {
    componentInstance = instance;

    if (instance) {
      // Register the instance for validation when it’s available
      registerCustomFieldInstance({ locale, keyPath, instance });
    } else {
      unregisterCustomFieldInstance({ locale, keyPath });
    }
  };

  /**
   * Render the React component with the current props.
   */
  const renderComponent = () => {
    if (!container || !resolvedControl || !immutableLoaded.current || !reactDomLoaded.current) {
      return;
    }

    reactRoot ??= getReactDom().createRoot(container);

    const props = buildControlProps({
      fieldId,
      fieldClassName: getInputClassName(),
      fieldConfig,
      currentValue,
      draft: entryDraft.current,
      locale,
      onChange: handleChange,
      addFile: handleAddFile,
      pickFile: handlePickFile,
      handleRef,
    });

    // Provide the state of this field to any built-in field control reused within the custom
    // control, which is typically given an ad hoc field configuration that doesn’t describe it
    reactRoot.render(
      createElement(
        fieldStateContext.Provider,
        { value: { locale, keyPath, required, readonly, invalid } },
        createElement(resolvedControl, props),
      ),
    );
    container?.querySelector('input')?.setAttribute('aria-invalid', String(invalid));
  };

  onMount(() => {
    // The control is a React component receiving Immutable Maps. Both libraries are normally loaded
    // by the time the editor opens, as `CMS.registerFieldType()` starts loading them, but wait for
    // them in any case; the effect below renders the control once they’re there
    Promise.all([loadImmutable(), loadReactDom()]).catch((/** @type {Error} */ error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    });

    return () => {
      reactRoot?.unmount();
      // Unregister the instance on unmount
      unregisterCustomFieldInstance({ locale, keyPath });
    };
  });

  $effect(() => {
    // Depend on every field in the locale, so that a control showing values derived from other
    // fields, such as dynamically generated select options, stays up to date. The values are read
    // through a cache shared between controls when the props are built, so they have to be tracked
    // here
    void getValueMapSnapshot(entryDraft.current, locale, valueStoreKey);

    // Render the component once the container and the library are ready, and update it when
    // currentValue changes externally (e.g., via revert or copy)
    if (immutableLoaded.current && reactDomLoaded.current && container && resolvedControl) {
      renderComponent();
    }

    // Trigger async validation when value changes (if the component has `isValid` method). The
    // result is cached; `awaitCustomFieldValidations()` lets a save attempt wait for it.
    if (typeof componentInstance?.isValid === 'function') {
      triggerCustomFieldValidation({ locale, keyPath, value: currentValue, fieldConfig });
    }
  });
</script>

<div role="none" bind:this={container}></div>

<AssetPicker bind:this={assetPicker} {fieldConfig} {typedKeyPath} {componentName} />
