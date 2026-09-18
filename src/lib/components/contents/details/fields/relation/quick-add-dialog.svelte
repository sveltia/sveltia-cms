<!--
  @component
  Implement the dialog to create a new entry in the collection a Relation field refers to, without
  leaving the entry being edited. The new entry is not saved on its own: it’s added to the parent
  draft as a pending entry, selected in the field, and committed together with the parent entry.
  @see https://github.com/sveltia/sveltia-cms/issues/493
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Button, Dialog, Spacer, Toast } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import LocaleSwitcher from '$lib/components/contents/details/locale-switcher.svelte';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { revokeDraftFileURLs } from '$lib/services/contents/draft';
  import { buildDraft } from '$lib/services/contents/draft/create';
  import { getValueMapVersion } from '$lib/services/contents/draft/create/proxy.svelte';
  import {
    EntryDraftState,
    getEntryDraftContext,
    setEntryDraftContext,
    setEntryDraftRoot,
  } from '$lib/services/contents/draft/state.svelte';
  import { updateComputedValues } from '$lib/services/contents/draft/update/compute';
  import { validateEntry } from '$lib/services/contents/draft/validate';
  import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
  import { expandInvalidFields } from '$lib/services/contents/editor/fields';
  import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';
  import {
    createPendingEntry,
    getNestedPendingEntries,
  } from '$lib/services/contents/fields/relation/quick-add';
  import { createRawState } from '$lib/services/utils/state.svelte';

  /**
   * @import { EntryDraft, EntryEditorPane, InternalEntryCollection, PendingEntry }
   * from '$lib/types/private';
   * @import { RelationField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   * @property {InternalEntryCollection} collection Collection to create an entry in.
   * @property {RelationField} fieldConfig Configuration of the Relation field the entry is created
   * from.
   * @property {(pendingEntry: PendingEntry) => void} onAdd Called with the new entry once it’s
   * been added to the parent draft.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    collection,
    fieldConfig,
    onAdd,
    /* eslint-enable prefer-const */
  } = $props();

  // The parent draft is the one provided by the editor this dialog is opened from. The new entry’s
  // draft is provided to the field editors below in its place, so they edit the new entry
  const parentDraft = getEntryDraftContext();
  const entryDraft = setEntryDraftContext(new EntryDraftState());

  /**
   * Locale being edited. The dialog has a single pane, so the locale switcher is the only way to
   * get to the other locales.
   * @type {{ current: ?EntryEditorPane }}
   */
  const pane = createRawState(/** @type {?EntryEditorPane} */ (null));

  const componentId = $props.id();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  let adding = $state(false);
  /** Whether the entry has been added, so the draft is kept when the dialog closes. */
  let added = false;
  let showValidationToast = $state(false);
  let errorCount = $state(0);
  let showErrorToast = $state(false);

  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
  const name = $derived(
    appLocale.current ? getCollectionLabel(collection, { useSingular: true }) : '',
  );
  /* v8 ignore stop */
  const { i18nEnabled, allLocales, defaultLocale } = $derived(collection._i18n);
  const hasMultipleLocales = $derived(i18nEnabled && allLocales.length > 1);

  /**
   * Start a new draft for the dialog.
   */
  const startDraft = () => {
    // Start at the root of the collection folder. The default is the folder being browsed, which
    // belongs to the parent entry’s collection
    const draft = buildDraft({ collection, initialPath: '' });

    // The entries pending on the parent draft are offered to the Relation fields of the new entry
    // as well, and a nested quick-add takes them into account when it names and counts entries
    /* v8 ignore next -- the dialog is only opened from a field editor while the draft is there */
    draft.pendingEntries = [...(parentDraft.current?.pendingEntries ?? [])];
    entryDraft.current = draft;
    pane.current = { mode: 'edit', locale: defaultLocale };
    added = false;
  };

  /**
   * Discard the draft once the dialog is closed. Its files are only kept when the entry has been
   * added, as they go into the commit.
   */
  const discardDraft = () => {
    if (!added) {
      revokeDraftFileURLs(entryDraft.current);
    }

    entryDraft.current = undefined;
    pane.current = null;
  };

  /**
   * Validate the draft and add it to the parent draft as a pending entry.
   */
  const add = async () => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the button is only there while the draft is being edited */
    if (!draft || !parentDraft.current) {
      return;
    }

    adding = true;

    try {
      // Wait for a rich text editor to write what was just typed, and for custom validators to
      // report, the same way a save does
      await awaitPendingFieldUpdates();
      await awaitCustomFieldValidations();

      // The entry is committed along with the parent, so it has to be complete
      if (!validateEntry({ draft, enforceRequired: true })) {
        expandInvalidFields({ draft });
        errorCount = Object.values(draft.validities)
          .flatMap((validity) => Object.values(validity).map(({ valid }) => !valid))
          .filter(Boolean).length;
        showValidationToast = true;

        return;
      }

      const pendingEntry = await createPendingEntry({
        draft,
        parentDraft: parentDraft.current,
        fieldConfig,
      });

      // The entries created from the new entry’s own Relation fields come along with it
      parentDraft.current.pendingEntries.push(
        ...getNestedPendingEntries({ draft, parentDraft: parentDraft.current }),
        pendingEntry,
      );
      onAdd(pendingEntry);
      added = true;
      open = false;
    } catch (ex) {
      showErrorToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      adding = false;
    }
  };

  $effect(() => {
    if (open) {
      untrack(() => startDraft());
    }
  });

  $effect(() => {
    if (wrapper) {
      // Rich text editor components are mounted outside the component tree, so they look the
      // draft up through the DOM rather than the context
      setEntryDraftRoot(wrapper, entryDraft);
    }
  });

  $effect(() => {
    const draft = entryDraft.current;

    if (!draft) {
      return;
    }

    // Resolve the Compute fields the same way the main editor does: depend on every field value
    // through the value map versions rather than by walking the values
    Object.values(draft.currentValues).forEach(getValueMapVersion);
    Object.values(draft.extraValues).forEach((valueMap) => void $state.snapshot(valueMap));
    void $state.snapshot(draft.currentLocales);

    untrack(() => {
      updateComputedValues(draft);
    });
  });
</script>

<Dialog
  bind:open
  title={_('create_entry_title', { values: { name } })}
  size="large"
  showOk={false}
  showCancel={false}
  onClose={() => {
    discardDraft();
  }}
>
  {#snippet headerExtra()}
    {#if hasMultipleLocales && entryDraft.current}
      <LocaleSwitcher id="{componentId}-header" thisPane={pane} />
    {/if}
  {/snippet}
  <div role="none" class="wrapper" bind:this={wrapper}>
    <p class="hint">{_('relation_field.save_together_hint', { values: { name } })}</p>
    {#if entryDraft.current && pane.current}
      <div role="none" id="{componentId}-body" class="fields">
        <EntryEditor locale={pane.current.locale} />
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Spacer flex={true} />
    <Button
      variant="primary"
      label={_('add')}
      disabled={adding}
      onclick={() => {
        add();
      }}
    />
    <Button
      variant="secondary"
      label={_('cancel')}
      disabled={adding}
      onclick={() => {
        open = false;
      }}
    />
  {/snippet}
</Dialog>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {_('entry_validation_errors', { values: { count: errorCount } })}
  </Alert>
</Toast>

<Toast bind:show={showErrorToast}>
  <Alert status="error">
    {_('relation_field.add_failed', { values: { name } })}
  </Alert>
</Toast>

<style>
  .wrapper {
    --field-editor-padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hint {
    margin: 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  .fields {
    display: flex;
    flex-direction: column;
  }
</style>
