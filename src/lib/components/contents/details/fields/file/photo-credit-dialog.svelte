<!--
  @component
  Show the credit of a stock photo selected in a File or Image field, which can be inserted into the
  entry or copied.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Menu, MenuItem, Spacer, SplitButton, TextArea } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { isInEditorComponent } from '$lib/services/contents/editor/field-context';
  import {
    convertCreditToMarkdown,
    getCreditCaptionKeyPath,
    getCreditTargetField,
    insertCredit,
    insertCreditCaption,
  } from '$lib/services/contents/fields/file/credit';
  import { getFieldLabel } from '$lib/services/contents/i18n/options';

  /**
   * @import { DraftValueStoreKey, InternalLocaleCode } from '$lib/types/private';
   * @import { FieldKeyPath } from '$lib/types/public';
   * @import { CreditTargetField } from '$lib/services/contents/fields/file/credit';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   * @property {string} credit Photo credits in HTML, one per line.
   * @property {InternalLocaleCode} locale Locale being edited.
   * @property {FieldKeyPath} keyPath Key path of the File or Image field.
   * @property {DraftValueStoreKey} valueStoreKey Value store key of the field.
   * @property {string} [componentName] Name of the rich text editor component the field belongs
   * to, if any.
   */

  /** @type {Props} */
  let {
    open = $bindable(false),
    credit,
    locale,
    keyPath,
    valueStoreKey,
    componentName = undefined,
  } = $props();

  const entryDraft = getEntryDraftContext();

  /**
   * The Caption field of the rich text editor component the field belongs to, if any, where the
   * credit is inserted. Looked up only while the dialog is open, as every File and Image field has
   * the dialog.
   */
  const captionKeyPath = $derived(
    open ? getCreditCaptionKeyPath({ valueStoreKey, componentName, keyPath }) : undefined,
  );
  /**
   * Otherwise, the Markdown field the credit can be inserted into, looked up only while the dialog
   * is open. Within any other component, that would be the field holding the component, which is
   * being edited, so the credit can only be copied there.
   */
  const fieldTarget = $derived(
    open && !isInEditorComponent(valueStoreKey)
      ? getCreditTargetField({ draft: entryDraft.current, locale })
      : undefined,
  );
  const canInsert = $derived(!!captionKeyPath || !!fieldTarget);

  /**
   * Close the dialog.
   */
  const close = () => {
    open = false;
  };

  /**
   * Insert the credit into the component’s caption or the Markdown field, and close the dialog.
   */
  const insert = () => {
    const draft = entryDraft.current;
    // The fields are only looked up while the dialog is open
    const captionField = captionKeyPath;
    const markdownField = fieldTarget;

    close();

    /* v8 ignore next 3 -- the dialog is closed along with the editor */
    if (!draft) {
      return;
    }

    if (captionField) {
      insertCreditCaption({ draft, locale, keyPath: captionField, credit });
    } else {
      // The button is only shown with either target. The value isn’t named `target` like the
      // property: the Svelte compiler would turn the cast into an invalid shorthand property
      insertCredit({
        draft,
        locale,
        target: /** @type {CreditTargetField} */ (markdownField),
        credit,
      });
    }
  };

  /**
   * Copy the given text to the clipboard, and close the dialog.
   * @param {string} text Text.
   */
  const copy = (text) => {
    navigator.clipboard.writeText(text);
    close();
  };
</script>

<Dialog bind:open role="alertdialog" title={_('assets_dialog.photo_credit.title')}>
  <div role="none">{_('assets_dialog.photo_credit.description')}</div>
  <div role="none">
    <TextArea
      dir="auto"
      flex
      readonly
      value={credit}
      onclick={(event) => {
        /** @type {HTMLTextAreaElement} */ (event.target).focus();
        /** @type {HTMLTextAreaElement} */ (event.target).select();
      }}
    />
  </div>
  {#snippet footer()}
    <Spacer flex />
    {#if canInsert}
      <Button
        variant="primary"
        label={fieldTarget
          ? _('assets_dialog.photo_credit.insert_to_field', {
              values: { field: getFieldLabel({ config: fieldTarget.fieldConfig, locale }) },
            })
          : _('insert')}
        onclick={insert}
      />
    {/if}
    <SplitButton
      variant={canInsert ? 'secondary' : 'primary'}
      label={_('copy')}
      onclick={() => {
        copy(credit);
      }}
    >
      {#snippet popup()}
        <Menu>
          <MenuItem
            label={_('assets_dialog.photo_credit.copy_as_markdown')}
            onclick={() => {
              copy(convertCreditToMarkdown(credit));
            }}
          />
        </Menu>
      {/snippet}
    </SplitButton>
    <Button variant="secondary" label={_('cancel')} onclick={close} />
  {/snippet}
</Dialog>
