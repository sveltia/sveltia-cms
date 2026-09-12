<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Icon, Spacer, VisibilityObserver } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { flatten, unflatten } from 'flat';
  import { onMount, untrack } from 'svelte';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import { normalizeContent } from '$lib/services/contents/draft/create/normalize';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import {
    getEntryDraftByElement,
    setEntryDraftContext,
  } from '$lib/services/contents/draft/state.svelte';
  import { validateFields } from '$lib/services/contents/draft/validate/fields';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
  import { formatComponentSummary } from '$lib/services/contents/fields/rich-text/components/summary';
  import { unflattenMap } from '$lib/services/utils/object';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
   * @import {
   * DraftValueStoreKey,
   * EntryDraft,
   * InternalLocaleCode,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import { EditorComponentMode, Field, FieldKeyPath, RawEntryContent } from '$lib/types/public';
   */

  /**
   * Entry draft state of the editor this component is rendered in. Lexical mounts the component
   * outside the Svelte component tree, so the state can’t come from the context; it’s looked up
   * through the DOM once the component is in place, along with the locale and key path below.
   * @type {EntryDraftState | undefined}
   */
  let entryDraft = $state();

  // The field editors rendered below expect the state in the context, which has to be set now,
  // before the state is resolved, so hand them a stand-in that follows it
  setEntryDraftContext({
    /**
     * Get the current draft.
     * @returns {EntryDraft | null | undefined} Draft.
     */
    get current() {
      return entryDraft?.current;
    },
    /**
     * Replace the current draft.
     * @param {EntryDraft | null | undefined} draft Draft.
     */
    set current(draft) {
      if (entryDraft) {
        entryDraft.current = draft;
      }
    },
    /**
     * Get whether the current draft has been modified.
     * @returns {boolean} Result.
     */
    get modified() {
      return entryDraft?.modified ?? false;
    },
  });

  /**
   * @typedef {object} Props
   * @property {string} componentName Rich text editor component name.
   * @property {string} label Field label.
   * @property {EditorComponentMode} [mode] Editing mode for the component. Default: `'block'`.
   * @property {boolean} [inline] Whether the component is inline. Default: `false`.
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
    inline = false,
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
    if (!(entryDraft?.current && locale && keyPath)) {
      return undefined;
    }

    const valueMap = getValueMapSnapshot(entryDraft.current, locale, valueStoreKey);

    return unflattenMap(
      Object.fromEntries(
        getKeysByPrefix(valueMap, keyPathPrefix).map((key) => [
          key.slice(keyPathPrefix.length),
          valueMap[key],
        ]),
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
    const draft = entryDraft?.current;

    if (draft && locale && keyPath && valuesSnapshot) {
      // Clear current values
      Object.keys(draft[valueStoreKey][locale] ?? {}).forEach((key) => {
        if (key.startsWith(keyPathPrefix)) {
          delete draft[valueStoreKey][locale][key];
        }
      });
      // Restore snapshot
      Object.assign(
        draft[valueStoreKey][locale],
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
    const draft = entryDraft?.current;

    if (!draft) {
      return;
    }

    const { validities: extraValidities } = validateFields('extraValues', { draft });

    Object.keys(draft.validities).forEach((loc) => {
      Object.assign(draft.validities[loc], extraValidities[loc]);
    });

    const localeValidities = extraValidities[locale] ?? {};

    const thisComponentValid = !Object.entries(localeValidities).some(
      ([key, validity]) => key.startsWith(keyPathPrefix) && !validity.valid,
    );

    if (thisComponentValid) {
      isNewComponent = false;
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
   * The text to display in the placeholder (dialog mode only). Priority:
   * 1. Formatted summary template (if provided and produces non-empty result)
   * 2. First string field’s value
   * 3. Component label.
   */
  const displayText = $derived.by(() => {
    // Fall back to the `values` prop when `currentValues` has no field data yet, e.g. on initial
    // render or before the store has been notified with the values.
    const hasFieldValues = fields.some((f) => currentValues?.[f.name] !== undefined);
    const vals = hasFieldValues ? currentValues : values;
    const formatted = formatComponentSummary({ template: summary, values: vals, fields, locale });

    if (formatted) {
      return formatted;
    }

    if (displayField && vals) {
      const value = vals[displayField.name];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return label;
  });

  onMount(() => {
    window.requestAnimationFrame(() => {
      // Get the draft state, locale and key path from the closest containers
      entryDraft = getEntryDraftByElement(wrapper);

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
      const draft = entryDraft?.current;

      // Remove the values and validities from the draft when the component is unmounted
      if (draft) {
        Object.keys(draft[valueStoreKey][locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete draft[valueStoreKey][locale][key];
          }
        });

        Object.keys(draft.validities[locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete draft.validities[locale][key];
          }
        });
      }
    };
  });

  watch(
    () => [values, locale, keyPath],
    () => {
      if (entryDraft?.current && locale && keyPath) {
        const { defaultLocale } = entryDraft.current;

        values ??= unflatten(getDefaultValues({ fields, locale, defaultLocale })) ?? {};
        values.__sc_component_name = componentName;

        // Reconcile the values parsed from the document with the component’s field definitions,
        // which may have changed since the document was written. Unlike an entry draft, missing
        // values are not filled in, because these values live in the document text and doing so
        // would rewrite it just by opening the entry
        const normalizedValues = unflatten(
          normalizeContent({
            fields,
            content: flatten(values),
            locale,
            defaultLocale,
            fillDefaults: false,
          }),
        );

        // Only reassign when something actually changed; `normalizeContent()` is idempotent, but a
        // fresh object on every run would retrigger this effect forever
        if (!equal(normalizedValues, values)) {
          values = normalizedValues;
        }

        if (!equal(values, currentValues)) {
          const newEntries = Object.fromEntries(
            Object.entries(flatten(values)).map(([key, value]) => [
              `${keyPathPrefix}${key}`,
              value,
            ]),
          );

          Object.assign(entryDraft.current[valueStoreKey][locale], newEntries);
        }
      }
    },
  );

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
    class="component {inline ? 'inline' : 'block'} placeholder"
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
            {componentName}
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
    class="component {inline ? 'inline' : 'block'} wrapper"
    class:expanded
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
              {componentName}
              {valueStoreKey}
            />
          </VisibilityObserver>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .component {
    &.block {
      display: block;

      &:not(:first-child) {
        margin-top: var(--sui-paragraph-margin);
      }

      &:not(:last-child) {
        margin-bottom: var(--sui-paragraph-margin);
      }
    }

    &.inline {
      display: inline-block;
    }
  }

  .wrapper {
    border-inline-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    width: 100%;
    color: var(--sui-secondary-foreground-color); /* Reset color within a link */
    background-color: var(--sui-primary-background-color);
    white-space: normal;
    -webkit-user-select: none;
    user-select: none;

    &.expanded {
      border-bottom-width: 2px;
    }

    &:focus {
      outline-color: var(--sui-primary-accent-color-translucent);
    }

    /* Make the input fields compact within the built-in image component */
    &:is([data-component-name='image'], [data-component-name='linked-image']) {
      :global {
        @media (768px <= width) {
          /* Hide the bottom border */
          [data-field-type]::after {
            display: none;
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
  }

  .placeholder {
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

    &.block {
      width: fit-content;
    }

    &.inline:not(:first-child) {
      margin-inline-start: var(--sui-paragraph-margin);
    }
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
