<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Icon, Spacer, VisibilityObserver } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { onMount, untrack } from 'svelte';

  import Image from '$lib/components/assets/shared/image.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import {
    getEntryDraftByElement,
    setEntryDraftContext,
  } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getComponentDisplayText,
    getComponentDisplayValues,
  } from '$lib/services/contents/fields/rich-text/components/summary';
  import { getComponentThumbnail } from '$lib/services/contents/fields/rich-text/components/thumbnail';
  import { validateComponentValues } from '$lib/services/contents/fields/rich-text/components/validate';
  import {
    deleteKeysByPrefix,
    flattenWithPrefix,
    getValuesByPrefix,
    reconcileComponentValues,
  } from '$lib/services/contents/fields/rich-text/components/values';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
   * @import {
   * DraftValueStoreKey,
   * EntryDraft,
   * InternalLocaleCode,
   * MediaFieldSource,
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
    /* v8 ignore start -- only the entry editor toolbar and overlay, which are never rendered within
    a component, replace the draft or check whether it’s been modified */
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
    /* v8 ignore stop */
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
   * @property {string} [thumbnail] Name of an Image or File field whose image is displayed as a
   * thumbnail in the placeholder (`dialog` mode only), e.g. `icon`.
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
    thumbnail,
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

  /* v8 ignore start -- the key paths are resolved together once the component is in place */
  const keyPathPrefix = $derived(!keyPath ? '' : `${keyPath}:${fieldId}:`);
  const typedKeyPathPrefix = $derived(!typedKeyPath ? '' : `${typedKeyPath}:${fieldId}:`);
  /* v8 ignore stop */
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

    return getValuesByPrefix(
      getValueMapSnapshot(entryDraft.current, locale, valueStoreKey),
      keyPathPrefix,
    );
  });

  /**
   * Open the dialog and take a snapshot of current values (dialog mode only).
   */
  const openDialog = () => {
    /* v8 ignore next -- the values are set up before the dialog can be opened */
    valuesSnapshot = currentValues ? { ...currentValues } : undefined;
    dialogOpen = true;
  };

  /**
   * Restore values from snapshot, used on cancel (dialog mode only).
   */
  const restoreValues = () => {
    const draft = entryDraft?.current;

    /* v8 ignore next -- the dialog is only open while the draft is there, with a snapshot */
    if (draft && locale && keyPath && valuesSnapshot) {
      // Clear current values
      deleteKeysByPrefix(draft[valueStoreKey][locale], keyPathPrefix);
      // Restore snapshot
      Object.assign(draft[valueStoreKey][locale], flattenWithPrefix(valuesSnapshot, keyPathPrefix));
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

    /* v8 ignore next 3 -- the dialog can only be confirmed while the draft is being edited */
    if (!draft) {
      return;
    }

    if (validateComponentValues({ draft, locale, keyPathPrefix })) {
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
   * The asset or URL of a thumbnail that couldn’t be shown, which is then replaced with the text.
   * Raw, as a deep state would wrap the asset in a proxy that never equals the asset itself.
   * @type {MediaFieldSource['asset'] | string | undefined}
   */
  let brokenThumbnail = $state.raw();

  /**
   * The image to display as a thumbnail in the placeholder (dialog mode only), taken from the field
   * named with the `thumbnail` option. The draft is required to look up the field’s collection.
   * Only the dialog mode placeholder reads this, so it’s never worked out in block mode.
   * @type {MediaFieldSource | undefined}
   */
  const thumbnailSource = $derived.by(() => {
    const draft = entryDraft?.current;

    if (!draft) {
      return undefined;
    }

    const source = getComponentThumbnail({
      thumbnailFieldName: thumbnail,
      values: getComponentDisplayValues({ currentValues, values, fields }),
      componentName,
      collectionName: draft.collectionName,
      fileName: draft.fileName,
      isIndexFile: draft.isIndexFile,
      entry: draft.originalEntry,
      files: draft.files,
    });

    return source && (source.asset ?? source.url) !== brokenThumbnail ? source : undefined;
  });

  /**
   * The text to display in the placeholder (dialog mode only). Priority:
   * 1. Formatted summary template (if provided and produces non-empty result)
   * 2. First string field’s value
   * 3. Component label, which is omitted when a thumbnail is shown.
   */
  const displayText = $derived(
    // Fall back to the `values` prop when `currentValues` has no field data yet, e.g. on initial
    // render or before the store has been notified with the values
    getComponentDisplayText({
      template: summary,
      currentValues,
      values,
      fields,
      locale,
      label,
      hasThumbnail: !!thumbnailSource,
    }),
  );

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
        deleteKeysByPrefix(draft[valueStoreKey][locale], keyPathPrefix);
        deleteKeysByPrefix(draft.validities[locale], keyPathPrefix);
      }
    };
  });

  watch(
    () => [values, locale, keyPath],
    () => {
      if (entryDraft?.current && locale && keyPath) {
        const reconciledValues = reconcileComponentValues({
          values,
          fields,
          componentName,
          locale,
          defaultLocale: entryDraft.current.defaultLocale,
        });

        // Only reassign when something actually changed, or this would run forever
        if (reconciledValues !== values) {
          values = reconciledValues;
        }

        if (!equal(values, currentValues)) {
          Object.assign(
            entryDraft.current[valueStoreKey][locale],
            flattenWithPrefix(/** @type {Record<string, any>} */ (values), keyPathPrefix),
          );
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
    class:thumbnail-only={!!thumbnailSource && !displayText}
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
    {#if thumbnailSource}
      <Image
        asset={thumbnailSource.asset}
        src={thumbnailSource.url}
        variant="icon"
        cover
        onError={() => {
          // Show the text instead of a generic file icon
          const { asset, url } = /** @type {MediaFieldSource} */ (thumbnailSource);

          brokenThumbnail = asset ?? url;
        }}
      />
    {/if}
    {#if displayText}
      <span role="none">{displayText}</span>
    {/if}
  </span>

  <Dialog
    title={label}
    bind:open={dialogOpen}
    size="large"
    showOk={false}
    showCancel={false}
    onCancel={() => {
      // The Escape key dismisses the dialog just like the Cancel button
      handleCancel();
    }}
  >
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
      const { target } = event;

      // A nested rich text editor handles its own keys, so leave the event alone when it comes
      // from one: stopping it here would keep it from ever reaching the nested editor, which is
      // below in the capture phase, and cancelling it would block typing there. The outer editor
      // ignores the event once it bubbles up, as Lexical marks it as handled by the nested one
      if (/** @type {HTMLElement} */ (target).closest('[contenteditable]') !== wrapper) {
        return;
      }

      // Allow to select all in any `TextInput` within the component below using Ctrl+A. Svelte
      // delegates `keydown` to the root, which the event never reaches once it’s stopped, so the
      // block’s own handling has to happen here as well
      event.stopPropagation();

      if (
        !(/** @type {HTMLElement} */ (target).matches('button, input, textarea')) &&
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
    --icon-size: 20px; /* Thumbnail size */
    align-items: center;
    gap: 0.4em;
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

    &.inline {
      display: inline-flex;
    }

    &.block {
      display: flex;
      width: fit-content;
    }

    /* Center the thumbnail on the line rather than sitting it on the baseline */
    &:has(:global(.preview)) {
      vertical-align: middle;
    }

    &.thumbnail-only {
      padding: 2px;
    }
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
