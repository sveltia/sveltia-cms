<!--
  @component
  Render a cell of the bulk editor: the control of a field for an entry, the same one the entry
  editor shows, without the label or the hint, the way an editor component in the `inline` mode
  renders it. The value is read from and written to the pending bulk edits rather than a draft.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import { editors } from '$lib/components/contents/details/fields';
  import { isFieldRequired } from '$lib/services/contents/entry/fields';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { Field } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Locale of the edited values, which is the default locale.
   * @property {Field} fieldConfig Field configuration.
   * @property {string} entryLabel Plain-text summary of the entry, naming the control together with
   * the field label.
   * @property {any} value Current value: the pending edit if any, or else the stored value.
   * @property {boolean} [edited] Whether the value has a pending edit.
   * @property {string[]} [errors] Validation messages of the pending edit.
   * @property {boolean} [readonly] Whether to make the control read-only, e.g. while the edits are
   * being saved.
   * @property {(value: any) => void} onChange Called with a new value.
   */

  /** @type {Props} */
  const {
    locale,
    fieldConfig,
    entryLabel,
    value,
    edited = false,
    errors = [],
    readonly = false,
    onChange,
  } = $props();

  const fieldId = $props.id();
  const { name: keyPath, label, widget: fieldType = 'string' } = $derived(fieldConfig);
  const fieldLabel = $derived(label || keyPath);
  const Editor = $derived(editors[fieldType]);
  const invalid = $derived(!!errors.length);
  // A Select or Relation field always shows a dropdown list, as radio buttons wouldn’t fit in a
  // cell
  const editorFieldConfig = $derived(
    /** @type {Field} */ (
      ['select', 'relation'].includes(fieldType)
        ? { ...fieldConfig, dropdown_threshold: 0 }
        : fieldConfig
    ),
  );
</script>

<div role="none" class="cell" class:edited class:invalid data-field-type={fieldType}>
  <span id="{fieldId}-label" hidden>
    {_('bulk_edit_cell', { values: { field: fieldLabel, entry: entryLabel } })}
  </span>
  <Editor
    {locale}
    {keyPath}
    typedKeyPath={keyPath}
    {fieldId}
    {fieldLabel}
    fieldConfig={editorFieldConfig}
    bind:currentValue={() => value, (newValue) => onChange(newValue)}
    required={isFieldRequired({ fieldConfig, locale })}
    {readonly}
    {invalid}
  />
  {#if invalid}
    <div role="alert" id="{fieldId}-error" class="error">
      {#each errors as message, index (index)}
        <div role="none">{message}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cell {
    --sui-textbox-singleline-min-width: 10em;
    --sui-combobox-min-width: 10em;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-radius: var(--sui-control-medium-border-radius);
    padding: 2px;

    &.edited {
      background-color: var(--sui-secondary-background-color);
    }

    :global {
      .sui:is(.text-input, .number-input, .combobox) {
        margin: 0;
      }
    }
  }

  .error {
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
