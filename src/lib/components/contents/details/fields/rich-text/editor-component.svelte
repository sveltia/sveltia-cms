<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Icon, Spacer } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { flatten, unflatten } from 'flat';
  import { onMount, untrack } from 'svelte';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import { applyTransformations } from '$lib/services/common/transformations';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { validateFields } from '$lib/services/contents/draft/validate/fields';

  /**
   * @import {
   * DraftValueStoreKey,
   * InternalLocaleCode,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import { EditorComponentMode, Field, FieldKeyPath, RawEntryContent } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} componentName Rich text editor component name.
   * @property {string} label Field label.
   * @property {EditorComponentMode} [mode] Editing mode for the component. Default: `'block'`.
   * @property {boolean} [collapsed] Whether to collapse the object by default (`block` mode only).
   * Default: `false`.
   * @property {string} [summary] Summary template for the placeholder text (`dialog` mode only),
   * e.g. `{{title}}`.
   * @property {Field[]} fields Subfield definitions.
   * @property {Record<string, any> | undefined} values Value map.
   * @property {(event: CustomEvent) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    componentName,
    label,
    mode = 'block',
    collapsed = false,
    summary,
    fields,
    values,
    onChange = () => undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {InternalLocaleCode} */
  let locale = $state('');
  /** @type {FieldKeyPath} */
  let keyPath = $state('');
  // Block mode only
  /** @type {TypedFieldKeyPath} */
  let typedKeyPath = $state('');
  /** @type {boolean} */
  // svelte-ignore state_referenced_locally
  let expanded = $state(!collapsed);
  // Dialog mode only
  /** @type {boolean} */
  let dialogOpen = $state(false);
  /**
   * Snapshot of values when dialog opens, used to restore on cancel.
   * @type {Record<string, any> | undefined}
   */
  let valuesSnapshot = $state(undefined);
  /**
   * Whether this is a freshly inserted component (no existing values). Initialized once in
   * `onMount` so it doesn’t change when `values` is later assigned defaults.
   */
  let isNewComponent = $state(false);

  const keyPathPrefix = $derived(!keyPath ? '' : `${keyPath}:${fieldId}:`);
  const typedKeyPathPrefix = $derived(!typedKeyPath ? '' : `${typedKeyPath}:${fieldId}:`);
  /**
   * Find the first string/text field from the fields definition.
   * @type {Field | undefined}
   */
  const displayField = $derived(
    fields.find((f) => f.widget === 'string' || f.widget === 'text' || !f.widget),
  );

  /**
   * Get the wrapper element.
   * @returns {HTMLElement | undefined} Wrapper.
   */
  export const getElement = () => wrapper;

  /**
   * Key to store the current values in the {@link entryDraft}. Usually `currentValues`, but we use
   * `extraValues` here to store additional values for a rich text editor component.
   * @type {DraftValueStoreKey}
   */
  const valueStoreKey = 'extraValues';
  /**
   * Previous values for the editor component, used to detect changes (block mode only).
   * @type {RawEntryContent | undefined}
   */
  let previousValues = undefined;

  /**
   * Current values for the editor component. These values are stored in the {@link entryDraft}
   * under the `extraValues` key, with the key path prefixed with the parent field’s key path, e.g.
   * `body:c12:image`.
   * @type {RawEntryContent | undefined}
   */
  const currentValues = $derived.by(() => {
    if (!($entryDraft && locale && keyPath)) {
      return undefined;
    }

    return unflatten(
      Object.fromEntries(
        Object.entries($state.snapshot($entryDraft[valueStoreKey][locale] ?? {}))
          .filter(([key]) => key.startsWith(keyPathPrefix))
          .map(([key, value]) => [key.replace(keyPathPrefix, ''), value]),
      ),
    );
  });

  /**
   * Open the dialog and take a snapshot of current values (dialog mode only).
   */
  const openDialog = () => {
    valuesSnapshot = currentValues ? { ...currentValues } : undefined;
    dialogOpen = true;
  };

  /**
   * Restore values from snapshot, used on cancel (dialog mode only).
   */
  const restoreValues = () => {
    if ($entryDraft && locale && keyPath && valuesSnapshot) {
      // Clear current values
      Object.keys($entryDraft[valueStoreKey][locale] ?? {}).forEach((key) => {
        if (key.startsWith(keyPathPrefix)) {
          delete $entryDraft[valueStoreKey][locale][key];
        }
      });
      // Restore snapshot
      Object.assign(
        $entryDraft[valueStoreKey][locale],
        Object.fromEntries(
          Object.entries(flatten(valuesSnapshot)).map(([key, value]) => [
            `${keyPathPrefix}${key}`,
            value,
          ]),
        ),
      );
    }
  };

  /**
   * Handle remove action (dialog mode only).
   */
  const handleRemove = () => {
    dialogOpen = false;
    onChange(new CustomEvent('remove'));
  };

  /**
   * Handle OK button click. Validates fields and only closes if valid (dialog mode only).
   */
  const handleOk = () => {
    const { validities: extraValidities } = validateFields('extraValues');

    entryDraft.update((_draft) => {
      if (!_draft) {
        return _draft;
      }

      return {
        ..._draft,
        validities: Object.fromEntries(
          Object.keys(_draft.validities).map((loc) => [
            loc,
            {
              ..._draft.validities[loc],
              ...extraValidities[loc],
            },
          ]),
        ),
      };
    });

    const localeValidities = extraValidities[locale] ?? {};

    const thisComponentValid = !Object.entries(localeValidities).some(
      ([key, validity]) => key.startsWith(keyPathPrefix) && !validity.valid,
    );

    if (thisComponentValid) {
      dialogOpen = false;
      onChange(new CustomEvent('update', { detail: currentValues }));
      valuesSnapshot = undefined;
    }
  };

  /**
   * Handle Cancel button click. Restores values from snapshot and closes dialog (dialog mode only).
   * If the component was newly inserted, remove it entirely instead of leaving it with empty state.
   */
  const handleCancel = () => {
    if (isNewComponent) {
      dialogOpen = false;
      onChange(new CustomEvent('remove'));
    } else {
      restoreValues();
      dialogOpen = false;
      valuesSnapshot = undefined;
    }
  };

  /**
   * Format a summary template by replacing `{{fieldName}}` placeholders with values (dialog mode
   * only). Supports nested properties and transformations like the CMS object field summary.
   * @param {string} template Summary template, e.g. `{{title}} - {{linkType.url | upper}}`.
   * @param {RawEntryContent} _values Current values (unflattened).
   * @returns {string | null} Formatted summary, or null if template is empty or result is empty.
   */
  const formatSimpleSummary = (template, _values) => {
    if (!template || !_values) {
      return null;
    }

    const flatValues = flatten(_values);

    const result = template.replaceAll(/{{(.+?)}}/g, (__, placeholder) => {
      const [tag, ...transformations] = placeholder.trim().split(/\s*\|\s*/);
      const fieldName = tag.replace(/^fields\./, '');
      let value = flatValues[fieldName];

      if (value === undefined || value === null) {
        return '';
      }

      if (transformations.length) {
        value = applyTransformations({
          fieldConfig: fields.find((f) => f.name === fieldName),
          value,
          transformations,
          locale,
        });
      }

      return String(value);
    });

    return result.trim() || null;
  };

  /**
   * The text to display in the placeholder (dialog mode only). Priority:
   * 1. Formatted summary template (if provided and produces non-empty result)
   * 2. First string field’s value
   * 3. Component label.
   */
  const displayText = $derived.by(() => {
    if (summary && currentValues) {
      const formatted = formatSimpleSummary(summary, currentValues);

      if (formatted) {
        return formatted;
      }
    }

    if (displayField && currentValues) {
      const value = currentValues[displayField.name];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return label;
  });

  onMount(() => {
    window.requestAnimationFrame(() => {
      // Get the locale and key path from the closest containers
      const localeContainer = /** @type {HTMLElement} */ (wrapper?.closest('[data-locale]'));
      const keyPathContainer = /** @type {HTMLElement} */ (wrapper?.closest('[data-key-path]'));

      locale = /** @type {string} */ (localeContainer?.dataset.locale);
      keyPath = /** @type {string} */ (keyPathContainer?.dataset.keyPath);

      if (mode !== 'dialog') {
        typedKeyPath = /** @type {string} */ (keyPathContainer?.dataset.typedKeyPath);
      }

      // Capture whether this is a newly inserted component (before $effect assigns defaults)
      isNewComponent = !values;

      // Auto-open dialog for freshly inserted components (dialog mode only)
      if (mode === 'dialog' && isNewComponent) {
        openDialog();
      }
    });

    return () => {
      // Remove the values and validities from the draft when the component is unmounted
      if ($entryDraft) {
        Object.keys($entryDraft[valueStoreKey][locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete $entryDraft[valueStoreKey][locale][key];
          }
        });

        Object.keys($entryDraft.validities[locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete $entryDraft.validities[locale][key];
          }
        });
      }
    };
  });

  $effect(() => {
    void [values, locale, keyPath];

    untrack(() => {
      if ($entryDraft && locale && keyPath) {
        const { defaultLocale } = $entryDraft;

        values ??= unflatten(getDefaultValues({ fields, locale, defaultLocale })) ?? {};
        values.__sc_component_name = componentName;

        if (!equal(values, currentValues)) {
          Object.assign(
            $entryDraft[valueStoreKey][locale],
            Object.fromEntries(
              Object.entries(flatten(values)).map(([key, value]) => [
                `${keyPathPrefix}${key}`,
                value,
              ]),
            ),
          );
        }
      }
    });
  });

  // Block mode: forward onChange whenever currentValues change
  $effect(() => {
    if (mode === 'dialog') return;

    void [currentValues];

    untrack(() => {
      if (!equal(previousValues, currentValues)) {
        onChange(new CustomEvent('update', { detail: currentValues }));
        previousValues = currentValues;
      }
    });
  });
</script>

{#if mode === 'dialog'}
  <!-- Dialog mode: compact placeholder that opens a dialog on click -->
  <span
    role="button"
    class="placeholder"
    bind:this={wrapper}
    contenteditable="false"
    tabindex="0"
    aria-label={label}
    title={label}
    data-key-path-prefix={keyPathPrefix}
    data-component-name={componentName}
    onclick={() => {
      openDialog();
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openDialog();
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        onChange(new CustomEvent('remove'));
      }
    }}
  >
    {displayText}
  </span>

  <Dialog title={label} bind:open={dialogOpen} size="large" showOk={false} showCancel={false}>
    <div role="none" class="fields">
      {#if locale && keyPath}
        {#each fields as fieldConfig (fieldConfig.name)}
          <FieldEditor
            {locale}
            keyPath="{keyPathPrefix}{fieldConfig.name}"
            typedKeyPath="{keyPathPrefix}{fieldConfig.name}"
            {fieldConfig}
            context="rich-text-editor-component"
            {valueStoreKey}
          />
        {/each}
      {/if}
    </div>
    {#snippet footer()}
      <Button
        variant="secondary"
        label={_('remove')}
        onclick={() => {
          handleRemove();
        }}
      />
      <Spacer flex={true} />
      <Button
        variant="primary"
        label={_(isNewComponent ? 'insert' : 'update')}
        onclick={() => {
          handleOk();
        }}
      />
      <Button
        variant="secondary"
        label={_('cancel')}
        onclick={() => {
          handleCancel();
        }}
      />
    {/snippet}
  </Dialog>
{:else}
  <!-- Block mode: expandable block with ObjectHeader -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    role="group"
    class="wrapper"
    bind:this={wrapper}
    contenteditable="false"
    tabindex="0"
    aria-label={label}
    data-key-path-prefix={keyPathPrefix}
    data-component-name={componentName}
    onkeydowncapture={(event) => {
      // Allow to select all in any `TextInput` within the component below using Ctrl+A
      event.stopPropagation();
    }}
    onkeydown={(event) => {
      if (
        !(/** @type {HTMLElement} */ (event.target).matches('button, input, textarea')) &&
        event.key !== 'Tab'
      ) {
        event.preventDefault();
      }

      if (event.target === wrapper && event.key === 'Backspace') {
        onChange(new CustomEvent('remove'));
      }
    }}
  >
    <ObjectHeader {label} controlId="object-{fieldId}-item-list" bind:expanded>
      {#snippet endContent()}
        <Button
          size="small"
          iconic
          aria-label={_('remove')}
          onclick={() => {
            onChange(new CustomEvent('remove'));
          }}
        >
          {#snippet startIcon()}
            <Icon name="close" />
          {/snippet}
        </Button>
      {/snippet}
    </ObjectHeader>
    <div role="none" class="item-list" id="object-{fieldId}-item-list">
      {#if locale && keyPath && expanded}
        {#each fields as fieldConfig (fieldConfig.name)}
          <VisibilityObserver>
            <FieldEditor
              {locale}
              keyPath="{keyPathPrefix}{fieldConfig.name}"
              typedKeyPath="{typedKeyPathPrefix}{fieldConfig.name}"
              {fieldConfig}
              context="rich-text-editor-component"
              {valueStoreKey}
            />
          </VisibilityObserver>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .wrapper {
    display: inline-block; // Cancel underline if the component is within a link
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: 4px;
    width: 100%;
    color: var(--sui-secondary-foreground-color); // Reset color within a link
    background-color: var(--sui-primary-background-color);
    white-space: normal;
    -webkit-user-select: none;
    user-select: none;

    &:focus {
      outline-color: var(--sui-primary-accent-color-translucent);
    }

    // Make the input fields compact within the built-in image component
    &:is([data-component-name='image'], [data-component-name='linked-image']) {
      :global {
        @media (768px <= width) {
          [data-field-type] {
            border-width: 0;
          }

          [data-field-type='string'] {
            display: flex;
            align-items: center;
            gap: 8px;
            padding-block: 0 16px;

            h4 {
              margin-bottom: 0 !important;
            }

            .field-wrapper {
              flex: auto;
            }
          }
        }

        button {
          margin: var(--sui-focus-ring-width);
        }
      }
    }

    & + :global(.wrapper) {
      margin-top: 16px;
    }
  }

  .placeholder {
    display: inline;
    border: dashed 1px currentColor;
    border-color: hsl(from currentColor h s l / 0.5);
    border-radius: 2px;
    padding-inline: 0.4em;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;

    &:hover {
      border-color: currentColor;
    }

    &:focus {
      outline: 2px solid var(--sui-primary-accent-color-translucent);
      outline-offset: 1px;
    }
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
