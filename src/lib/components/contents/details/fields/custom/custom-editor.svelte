<!--
  @component
  Render a custom field control registered via `CMS.registerFieldType()`.
  @see https://decapcms.org/docs/custom-widgets/
  @see https://sveltiacms.app/en/docs/api/field-types
-->
<script module>
  import { TextInput } from '@sveltia/ui';
  import { flushSync, mount } from 'svelte';

  /** @type {string | undefined} */
  let cachedFieldClassName = undefined;

  /**
   * Get the CSS class name of a built-in text input, so that a custom control can be styled
   * consistently with built-in field types. The probe component is mounted once for the lifetime of
   * the app and intentionally never unmounted, to keep its scoped CSS available.
   * @returns {string} Class name, or an empty string if it could not be determined.
   */
  const getInputClassName = () => {
    if (cachedFieldClassName === undefined) {
      const target = document.createElement('div');

      mount(TextInput, { target });
      // Wait for the component to be mounted
      flushSync();
      cachedFieldClassName = target.querySelector('input')?.className ?? '';
    }

    return cachedFieldClassName;
  };
</script>

<script>
  import { isObject } from '@sveltia/utils/object';
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { getContext, onMount } from 'svelte';

  import { fieldStateContext } from '$lib/services/api/field-state';
  import { entryDraft } from '$lib/services/contents/draft';
  import { updateNonPrimitiveValue } from '$lib/services/contents/draft/update';
  import {
    registerCustomFieldInstance,
    triggerCustomFieldValidation,
    unregisterCustomFieldInstance,
  } from '$lib/services/contents/draft/validate/custom-fields';
  import { buildControlProps, resolveControl } from '$lib/services/contents/fields/custom/editor';

  /**
   * @import { Root } from 'react-dom/client';
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { CustomField, CustomFieldControl } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CustomField} fieldConfig Field configuration.
   * @property {any} currentValue Current field value.
   * @property {CustomFieldControl | string} control React component or component name string.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldId,
    keyPath,
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

  const { i18n = false } = $derived(fieldConfig);
  const resolvedControl = $derived(resolveControl(control));

  /**
   * Handle value changes from the React component. Don’t use two-way binding here to avoid
   * unexpected behavior.
   * @param {any} value New value from the React component.
   */
  const handleChange = (value) => {
    if (Array.isArray(value) || isObject(value)) {
      updateNonPrimitiveValue({ valueStoreKey, locale, keyPath, i18n, value });
    } else if ($entryDraft) {
      $entryDraft[valueStoreKey][locale][keyPath] = value;
    }
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
    if (!container || !resolvedControl) {
      return;
    }

    reactRoot ??= createRoot(container);

    const props = buildControlProps({
      fieldId,
      fieldClassName: getInputClassName(),
      fieldConfig,
      currentValue,
      // Reading the draft here makes the `$effect` below rerender the component whenever any field
      // in the entry is updated, so that a control showing values derived from other fields, such
      // as dynamically generated select options, stays up to date
      draft: $entryDraft,
      locale,
      onChange: handleChange,
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
    renderComponent();

    return () => {
      reactRoot?.unmount();
      // Unregister the instance on unmount
      unregisterCustomFieldInstance({ locale, keyPath });
    };
  });

  $effect(() => {
    // Update the component when currentValue changes externally (e.g., via revert or copy)
    if (reactRoot && resolvedControl) {
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
