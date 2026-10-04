<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Menu, MenuButton, Spacer } from '@sveltia/ui';
  import { getContext, setContext } from 'svelte';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ResetMenuItems from '$lib/components/contents/details/editor/reset-menu-items.svelte';
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { CustomEditor, editors } from '$lib/components/contents/details/fields';
  import { customFieldTypeRegistry } from '$lib/services/api/registries';
  import { isDraftReadonly } from '$lib/services/config/readonly';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { canResetField, resetField } from '$lib/services/contents/draft/update/reset';
  import { isFieldChanged, revertChanges } from '$lib/services/contents/draft/update/revert';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getFieldLocaleAccess } from '$lib/services/contents/editor/locale';
  import {
    getCurrentValue,
    getFieldKind,
    isFieldMultiple,
    isFieldRequired,
  } from '$lib/services/contents/entry/fields';
  import { isAutoNowField } from '$lib/services/contents/fields/date-time/auto-now';
  import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
  import { createRawState } from '$lib/services/utils/state.svelte';
  import { sanitizeInlineMarkdown } from '$lib/services/utils/string';
  import { isPendingDeletion } from '$lib/services/workflow';

  /**
   * @import { Component } from 'svelte';
   * @import {
   * DraftValueStoreKey,
   * EntryDraft,
   * FieldContext,
   * FieldEditorContext,
   * InternalLocaleCode,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import {
   * BooleanField,
   * CustomField,
   * Field,
   * FieldKeyPath,
   * NumberField,
   * StringField,
   * VisibleField,
   * } from '$lib/types/public';
   */

  /** @type {FieldEditorContext} */
  const parent = getContext('field-editor') ?? {};

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {TypedFieldKeyPath} typedKeyPath Typed field key path.
   * @property {Field} fieldConfig Field configuration.
   * @property {FieldContext} [context] Where the field is rendered.
   * @property {string} [componentName] Name of the parent rich text editor component, if any.
   * @property {DraftValueStoreKey} [valueStoreKey] Key to store the values in {@link EntryDraft}.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    context: fieldContext = parent.fieldContext ?? undefined,
    componentName,
    valueStoreKey = parent.valueStoreKey ?? 'currentValues',
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /**
   * Parse the given string as Markdown and sanitize the result to only allow certain tags. A
   * literal `\n` is turned into a line break.
   * @param {string} str Original string.
   * @returns {string} Sanitized string.
   */
  const _sanitize = (str) =>
    sanitizeInlineMarkdown(str.replaceAll('\\n', '<br>'), {
      allowedTags: ['strong', 'em', 'del', 'code', 'a', 'br'],
    });

  /**
   * Write a value coming from the widget editor back to the entry draft.
   *
   * The write is deferred to a microtask so that it happens outside Svelte’s update cycle. Widget
   * editors sync their local state to this binding from an `$effect`, and Svelte can only memoize
   * its dirty-marking traversal for writes made outside a running reaction. Without the deferral,
   * marking re-walks the derived graph once per path that reaches it, which is exponential in the
   * depth of the editor tree — tens of seconds per keystroke on a deeply nested entry.
   * @param {any} value New value.
   */
  const writeValue = (value) => {
    // Only primitive value fields support two-way binding. Updating an array and object in the
    // draft store has to be handled in each field editor.
    /* v8 ignore next 3 */
    if (typeof value === 'object' && value !== null) {
      return;
    }

    const draft = entryDraft.current;
    const store = valueStoreKey;
    const _locale = locale;
    const _keyPath = keyPath;

    queueMicrotask(() => {
      /* v8 ignore next 3 -- the editor may have been closed in the meantime */
      if (draft) {
        draft[store][_locale][_keyPath] = value;
      }
    });
  };

  /** @type {{ current: Component | undefined }} */
  const extraHint = createRawState();

  setContext(
    'field-editor',
    // svelte-ignore state_referenced_locally
    /** @type {FieldEditorContext} */ ({
      fieldContext,
      parentComponentNames: [...(parent.parentComponentNames ?? []), componentName].filter(Boolean),
      extraHint,
      valueStoreKey,
    }),
  );

  const inEditorComponent = $derived(fieldContext === 'rich-text-editor-component');
  const { name: fieldName, widget: fieldType = 'string' } = $derived(fieldConfig);
  const {
    label = '',
    hint = '',
    readonly: readonlyOption,
  } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const required = $derived(isFieldRequired({ fieldConfig, locale }));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const allowPrefix = $derived(['string'].includes(fieldType));
  const prefix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).prefix : undefined,
  );
  const suffix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).suffix : undefined,
  );
  const allowExtraLabels = $derived(['boolean', 'number', 'string'].includes(fieldType));
  const beforeInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).before_input
      : undefined,
  );
  const afterInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).after_input
      : undefined,
  );
  const hasExtraLabels = $derived(!!(prefix || suffix || beforeInputLabel || afterInputLabel));
  const isList = $derived(fieldType === 'list' || multiple);
  const originalValues = $derived(entryDraft.current?.originalValues);
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    getDraftI18nConfig(entryDraft.current),
  );
  const otherLocales = $derived(i18nEnabled ? allLocales.filter((l) => l !== locale) : []);
  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale, valueStoreKey));
  // Whether the field is shown, and whether it follows the default locale, in this locale
  const {
    canTranslate,
    isDuplicated,
    areKeysDuplicated,
    isShown: canEdit,
  } = $derived(
    getFieldLocaleAccess({
      draft: entryDraft.current,
      fieldConfig,
      keyPath,
      locale,
      valueMap,
      inEditorComponent,
    }),
  );
  const canCopy = $derived(!inEditorComponent && canTranslate && otherLocales.length);
  const canRevert = $derived(!inEditorComponent && !isDuplicated);
  const customFieldType = $derived(customFieldTypeRegistry.get(fieldType));
  const currentValue = $derived(
    getCurrentValue({ valueMap, keyPath, isList, isCustomFieldType: !!customFieldType }),
  );
  const isRevertDisabled = $derived(
    !isFieldChanged({
      currentValueMap: valueMap,
      originalValueMap: originalValues?.[locale] ?? {},
      keyPath,
    }),
  );
  const validity = $derived(entryDraft.current?.validities[locale][keyPath]);
  const fieldLabel = $derived(label || fieldName);
  // An entry awaiting deletion is shown for reference only. Unlike `readonly`, which is also set
  // for a duplicated locale, this hides the options that would change the content
  const pendingDeletion = $derived(isPendingDeletion(entryDraft.current?.originalEntry));
  // An entry in a read-only collection, or a read-only collection file, is shown for reference only
  // as well
  const draftReadonly = $derived(isDraftReadonly(entryDraft.current));
  const locked = $derived(pendingDeletion || draftReadonly);
  // A DateTime field with the `auto_now` option is set on save, so it can’t be edited, and it’s
  // hidden while the entry is being created because it has no meaningful value until then. The
  // option is ignored in a rich text editor component, whose values aren’t set on save
  const autoNow = $derived(!inEditorComponent && isAutoNowField(fieldConfig));
  const hidden = $derived(fieldType === 'compute' || (autoNow && !!entryDraft.current?.isNew));
  const readonly = $derived(
    // The `readonly` option defaults to `true` for the UUID field type, which can be unlocked
    (readonlyOption ?? fieldType === 'uuid') ||
      autoNow ||
      locked ||
      isDuplicated ||
      fieldType === 'compute',
  );
  // A field can be restored to its default value or cleared, unless it can’t be edited or its keys
  // follow the default locale, as with a KeyValue field using the `duplicate_keys` i18n strategy
  const canReset = $derived(!inEditorComponent && !readonly && !areKeysDuplicated);
  /**
   * Whether restoring the default value or clearing the field would change anything. It takes
   * going through the whole field, so it’s only checked as the menu opens rather than on every
   * change.
   */
  let resetAvailability = $state({ restore: false, clear: false });
  const invalid = $derived(validity?.valid === false);

  /**
   * Check whether restoring the default value or clearing the field would change anything.
   */
  const updateResetAvailability = () => {
    const args = { valueMap, fieldConfig, keyPath, locale, defaultLocale };

    resetAvailability = {
      restore: canResetField({ ...args, restore: true }),
      clear: canResetField(args),
    };
  };
  const editorProps = $derived({
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    readonly,
    required,
    invalid,
  });
</script>

{#snippet beforeInput()}
  {#if beforeInputLabel}
    <div role="none" class="before-input">{@html _sanitize(beforeInputLabel)}</div>
  {/if}
  {#if prefix}
    <div role="none" class="prefix">{prefix}</div>
  {/if}
{/snippet}

{#snippet afterInput()}
  {#if suffix}
    <div role="none" class="suffix">{suffix}</div>
  {/if}
  {#if afterInputLabel}
    <div role="none" class="after-input">{@html _sanitize(afterInputLabel)}</div>
  {/if}
{/snippet}

{#if entryDraft.current && canEdit && fieldType !== 'hidden'}
  <FieldEditorGroup
    aria-label={_('x_field', { values: { field: fieldLabel } })}
    data-field-type={fieldType}
    data-key-path={keyPath}
    data-typed-key-path={typedKeyPath}
    {hidden}
  >
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{fieldLabel}</h4>
      {#if !readonly && required}
        <span class="required" aria-hidden="true">*</span>
      {/if}
      <Spacer flex />
      {#if canCopy && !draftReadonly && ['richtext', 'markdown', 'string', 'text', 'list', 'object'].includes(fieldType)}
        <TranslateButton size="small" {locale} {otherLocales} {keyPath} />
      {/if}
      <!-- Every option in the menu edits the content, which a read-only entry doesn’t allow -->
      {#if !draftReadonly && (canCopy || canRevert || canReset)}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          disabled={pendingDeletion}
          popupPosition="bottom-right"
          aria-label={_('show_field_options')}
          onclick={updateResetAvailability}
          onkeydown={updateResetAvailability}
        >
          {#snippet popup()}
            <Menu ariaLabel={_('field_options')}>
              {#if canCopy}
                <CopyMenuItems {locale} {otherLocales} {keyPath} submenu />
              {/if}
              <!-- A field that can be copied from another locale can be reverted as well, so the
              menu always offers it -->
              <ResetMenuItems
                scope="field"
                separator={!!canCopy}
                available={{
                  revert: !isRevertDisabled,
                  ...(canReset ? resetAvailability : {}),
                }}
                onSelect={(action) => {
                  const draft = /** @type {EntryDraft} */ (entryDraft.current);

                  if (action === 'revert') {
                    revertChanges({ draft, locale, keyPath });
                  } else {
                    resetField({
                      draft,
                      fieldConfig,
                      keyPath,
                      locale,
                      restore: action === 'restore',
                    });
                  }
                }}
              />
            </Menu>
          {/snippet}
        </MenuButton>
      {/if}
    </header>
    {#if validity?.valid === false}
      <ValidationError id="{fieldId}-error">
        {entryDraft.current?.validationMessages[locale][keyPath]?.join(' ')}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper" class:has-extra-labels={hasExtraLabels}>
      {#if customFieldType}
        {@render beforeInput()}
        <CustomEditor
          {...{ ...editorProps, fieldConfig: /** @type {CustomField} */ (fieldConfig) }}
          control={customFieldType.control}
          {currentValue}
        />
        {@render afterInput()}
      {:else if getFieldKind(fieldConfig) === 'unknown'}
        <Alert status="warning">
          {_('unsupported_field_type_x', { values: { name: fieldType } })}
        </Alert>
      {:else}
        {@const Editor = editors[fieldType]}
        {@render beforeInput()}
        <Editor
          {...editorProps}
          bind:currentValue={() => currentValue, (value) => writeValue(value)}
        />
        {@render afterInput()}
      {/if}
    </div>
    {#if !readonly && (hint || extraHint.current)}
      {@const ExtraHint = extraHint.current}
      <div role="none" class="footer">
        {#if hint}
          <p class="hint">{@html _sanitize(hint)}</p>
        {/if}
        <ExtraHint {fieldConfig} {locale} {currentValue} />
      </div>
    {/if}
  </FieldEditorGroup>
{/if}

<style>
  .field-wrapper {
    &.has-extra-labels {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
    }

    :global {
      :is(input[type='text'], textarea) {
        width: 100%;
      }

      input:is([type='color'], [type='number']) {
        border-width: 1px;
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        height: var(--sui-button-medium-height);
        color: inherit;
        background-color: var(--sui-textbox-background-color);
      }

      input:is([type='file'], [type='checkbox']) {
        color: inherit;
      }

      & > div {
        color: inherit;
      }

      input:is([type='date'], [type='datetime-local'], [type='time']) {
        margin: var(--sui-focus-ring-width);
        border-width: var(--sui-textbox-border-width, 1px);
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        padding: var(--sui-textbox-singleline-padding);
        width: auto;
        height: var(--sui-textbox-height);
        color: var(--sui-textbox-foreground-color);
        background-color: var(--sui-textbox-background-color);
        font-family: var(--sui-textbox-font-family);
        font-size: var(--sui-textbox-font-size);
        text-transform: uppercase;

        &:disabled {
          opacity: 0.4;
        }
      }

      input[aria-invalid='true']:is(
          [type='color'],
          [type='date'],
          [type='datetime-local'],
          [type='time']
        ) {
        border-color: var(--sui-error-border-color);
      }

      input:read-only {
        /* Make readonly inputs selectable */
        -webkit-user-select: text;
        user-select: text;
        pointer-events: auto;
      }
    }
  }

  .before-input,
  .after-input,
  .prefix,
  .suffix {
    color: var(--sui-secondary-foreground-color);
    white-space: nowrap;
  }

  .hint {
    flex: auto;
    margin-inline: var(--sui-focus-ring-width) !important;
    margin-block: var(--sui-focus-ring-width) 0 !important;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
    color: var(--sui-tertiary-foreground-color);
  }

  .footer {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 4px;
  }
</style>
