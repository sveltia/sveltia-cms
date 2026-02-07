<script>
  import { Button, Dialog } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { flatten, unflatten } from 'flat';
  import { onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';

  /**
   * @import { DraftValueStoreKey, InternalLocaleCode, RawEntryContent } from '$lib/types/private';
   * @import { Field, FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} componentName Rich text editor component name.
   * @property {string} label Field label.
   * @property {string} [summary] Summary template for the placeholder text, e.g. `{{title}}`.
   * @property {Field[]} fields Subfield definitions.
   * @property {Record<string, any> | undefined} values Value map.
   * @property {(event: CustomEvent) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    componentName,
    label,
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
  /** @type {boolean} */
  let dialogOpen = $state(false);
  /**
   * Snapshot of values when dialog opens, used to restore on cancel.
   * @type {Record<string, any> | undefined}
   */
  let valuesSnapshot = $state(undefined);
  /**
   * Whether this is a freshly inserted component (no existing values).
   * Used to auto-open the dialog on mount.
   */
  const isNewComponent = !values;

  const keyPathPrefix = $derived(!keyPath ? '' : `${keyPath}:${fieldId}:`);

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
   * Current values for the editor component. These Values are stored in the {@link entryDraft}
   * under the `extraValues` key, with the key path prefixed with the parent field's key path, e.g.
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
   * Open the dialog and take a snapshot of current values.
   */
  const openDialog = () => {
    valuesSnapshot = currentValues ? { ...currentValues } : undefined;
    dialogOpen = true;
  };

  /**
   * Restore values from snapshot (used on cancel).
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
   * Handle dialog close.
   * @param {CustomEvent} event Close event.
   */
  const handleDialogClose = (event) => {
    const { returnValue } = event.detail;

    if (returnValue === 'ok') {
      // Save: fire onChange with current values
      onChange(new CustomEvent('update', { detail: currentValues }));
    } else {
      // Cancel: restore values from snapshot
      restoreValues();
    }

    valuesSnapshot = undefined;
  };

  /**
   * Handle remove action.
   */
  const handleRemove = () => {
    dialogOpen = false;
    onChange(new CustomEvent('remove'));
  };

  onMount(() => {
    window.requestAnimationFrame(() => {
      locale = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-locale]'))?.dataset.locale
      );
      keyPath = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-key-path]'))?.dataset.keyPath
      );

      // Auto-open dialog for freshly inserted components
      if (isNewComponent) {
        openDialog();
      }
    });

    return () => {
      // Remove the values from the draft when the component is unmounted
      if ($entryDraft && valueStoreKey === 'extraValues') {
        Object.keys($entryDraft[valueStoreKey][locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete $entryDraft[valueStoreKey][locale][key];
          }
        });
      }
    };
  });

  // Initialize values in entryDraft
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

  /**
   * Format a simple summary template by replacing `{{fieldName}}` placeholders with values.
   * @param {string} template Summary template, e.g. `{{title}} - {{videoId}}`.
   * @param {Record<string, any>} valueMap Current values.
   * @returns {string | null} Formatted summary, or null if template is empty or result is empty.
   */
  const formatSimpleSummary = (template, valueMap) => {
    if (!template || !valueMap) {
      return null;
    }

    const result = template.replaceAll(/{{(.+?)}}/g, (_, placeholder) => {
      const fieldName = placeholder.trim().replace(/^fields\./, '');
      const value = valueMap[fieldName];

      return value != null ? String(value) : '';
    });

    return result.trim() || null;
  };

  /**
   * The text to display in the placeholder. Priority:
   * 1. Formatted summary template (if provided and produces non-empty result)
   * 2. First string field's value
   * 3. Component label
   */
  const displayText = $derived.by(() => {
    // Try summary template first
    if (summary && currentValues) {
      const formatted = formatSimpleSummary(summary, currentValues);

      if (formatted) {
        return formatted;
      }
    }

    // Fall back to first string field value
    if (displayField && currentValues) {
      const value = currentValues[displayField.name];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    // Fall back to label
    return label;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
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

<Dialog
  title={label}
  bind:open={dialogOpen}
  size="large"
  okLabel={$_('update')}
  onClose={(event) => {
    handleDialogClose(event);
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
          {valueStoreKey}
        />
      {/each}
    {/if}
  </div>
  {#snippet footerExtra()}
    <Button
      variant="secondary"
      label={$_('remove')}
      onclick={() => {
        handleRemove();
      }}
    />
  {/snippet}
</Dialog>

<style lang="scss">
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
