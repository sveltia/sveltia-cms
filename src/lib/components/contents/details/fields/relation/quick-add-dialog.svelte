<!--
  @component
  Implement the dialog to create a new entry in the collection a Relation field refers to, or edit
  one selected in the field, without leaving the entry being edited. The entry is not saved on its
  own: it’s added to the parent draft as a pending entry, selected in the field, and committed
  together with the parent entry. A pending entry can be opened again and changed until then.
  @see https://github.com/sveltia/sveltia-cms/issues/493
  @see https://github.com/sveltia/sveltia-cms/issues/1129
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Button, Dialog, Spacer, Toast } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import SlugEditor from '$lib/components/contents/details/editor/slug-editor.svelte';
  import ValidationErrorsToast from '$lib/components/contents/details/editor/validation-errors-toast.svelte';
  import LocaleSwitcher from '$lib/components/contents/details/locale-switcher.svelte';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { revokeDraftFileURLs } from '$lib/services/contents/draft';
  import { restoreBackup } from '$lib/services/contents/draft/backup';
  import { buildDraft } from '$lib/services/contents/draft/create';
  import { initEntryDraftEditor } from '$lib/services/contents/draft/editor.svelte';
  import {
    EntryDraftState,
    getEntryDraftContext,
    setEntryDraftContext,
  } from '$lib/services/contents/draft/state.svelte';
  import {
    countInvalidFields,
    validateAndRevealErrors,
  } from '$lib/services/contents/draft/validate/reveal';
  import { needsSlugInput } from '$lib/services/contents/editor/slug';
  import {
    addPendingEntries,
    createPendingEntry,
    getEditTarget,
    getNestedPendingEntries,
    getNestedQuickAddHost,
    isEditUnchanged,
    isPendingEntryMoved,
    revertSaveTimeValues,
  } from '$lib/services/contents/fields/relation/quick-add';
  import { createRawState, getSnapshot } from '$lib/services/utils/state.svelte';

  /**
   * @import { Entry, EntryDraft, EntryEditorPane, InternalEntryCollection, PendingEntry }
   * from '$lib/types/private';
   * @import { RelationField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   * @property {InternalEntryCollection} collection Collection to create or edit an entry in.
   * @property {RelationField} fieldConfig Configuration of the Relation field the entry is created
   * or edited from.
   * @property {Entry} [entry] Entry to edit, as the field offers it: an existing entry, or one
   * pending on the parent draft. A new entry is created without it.
   * @property {(pendingEntry: PendingEntry, previousEntry?: Entry) => void} onAdd Called with the
   * entry once it’s been added to the parent draft, along with the entry as it was before when it
   * has been edited.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    collection,
    fieldConfig,
    entry = undefined,
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
  let showMoveToast = $state(false);
  /** Whether the entry being edited has been changed by someone else since it was edited. */
  let changedSince = $state(false);
  /** Entry being edited, as it was when the dialog was opened. */
  let previousEntry = $state.raw(/** @type {Entry | undefined} */ (undefined));
  /** Incremented each time a draft is started, so a draft started earlier can tell it’s stale. */
  let draftCount = 0;

  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
  const name = $derived(
    appLocale.current ? getCollectionLabel(collection, { useSingular: true }) : '',
  );
  /* v8 ignore stop */
  const { i18nEnabled, allLocales, defaultLocale } = $derived(collection._i18n);
  const hasMultipleLocales = $derived(i18nEnabled && allLocales.length > 1);
  const editing = $derived(!!previousEntry);

  /**
   * Start a draft for the dialog: a new entry, or the entry to edit. An entry pending on the parent
   * draft is opened with the values it was added with, on top of the latest version of the entry
   * if it’s an existing one, so the changes made by someone else since can be reviewed.
   */
  const startDraft = async () => {
    draftCount += 1;

    const count = draftCount;
    const editingEntry = entry;

    previousEntry = editingEntry;
    changedSince = false;

    /* v8 ignore next -- the dialog is only opened from a field editor while the draft is there */
    const parentPendingEntries = parentDraft.current?.pendingEntries ?? [];
    const target = getEditTarget({ pendingEntries: parentPendingEntries, entry: editingEntry });
    const { pendingEntry, baseEntry } = target;

    // A new entry starts at the root of the collection folder. The default is the folder being
    // browsed, which belongs to the parent entry’s collection. The entry kept on the parent draft
    // is a `$state` proxy, which the draft can’t clone
    const draft = baseEntry
      ? buildDraft({ collection, originalEntry: getSnapshot(baseEntry) })
      : buildDraft({ collection, initialPath: '' });

    if (pendingEntry?.source) {
      // A new entry keeps its ID, so it takes the place of its earlier version when added again
      draft.id = pendingEntry.entry.id;
      // The values are copied, as the restore updates them in place
      await restoreBackup({ backup: getSnapshot(pendingEntry.source), draft });
    }

    // The dialog may have been closed, or opened again for another entry, in the meantime
    if (count !== draftCount || !open) {
      revokeDraftFileURLs(draft);

      return;
    }

    // The entries pending on the parent draft are offered to the Relation fields of the entry as
    // well, and a nested quick-add takes them into account when it names and counts entries
    draft.pendingEntries = [...parentPendingEntries];
    // The entry is saved along with the entry being edited, which decides what can be added from
    // the Relation fields of the entry in turn
    /* v8 ignore next -- the dialog is only opened from a field editor while the draft is there */
    draft.quickAddHost = parentDraft.current
      ? getNestedQuickAddHost(parentDraft.current)
      : undefined;
    entryDraft.current = draft;
    pane.current = { mode: 'edit', locale: defaultLocale };
    changedSince = target.changedSince;
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

    // A draft still being started is not to be shown
    draftCount += 1;
    entryDraft.current = undefined;
    pane.current = null;
    previousEntry = undefined;
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

    // Nothing to save for an entry opened only to have a look
    if (isEditUnchanged({ draft, parentDraft: parentDraft.current })) {
      open = false;

      return;
    }

    adding = true;

    try {
      // The entry is committed along with the parent, so it has to be complete. Wait for what was
      // just typed and for custom validators to report, the same way a save does
      if (!(await validateAndRevealErrors({ draft, enforceRequired: true }))) {
        errorCount = countInvalidFields(draft.validities);
        showValidationToast = true;

        return;
      }

      const pendingEntry = await createPendingEntry({
        draft,
        parentDraft: parentDraft.current,
        fieldConfig,
      });

      // The dialog can be closed with the Escape key in the meantime, and even opened again. The
      // draft is then discarded, along with the URLs of its files, so the entry is not to be added
      if (!open || entryDraft.current !== draft) {
        return;
      }

      if (isPendingEntryMoved(pendingEntry)) {
        revertSaveTimeValues({ draft, pendingEntry });
        showMoveToast = true;

        return;
      }

      // The entries created or edited from the entry’s own Relation fields come along with it
      addPendingEntries(parentDraft.current, [
        ...getNestedPendingEntries({ draft, parentDraft: parentDraft.current }),
        pendingEntry,
      ]);
      onAdd(pendingEntry, previousEntry);
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
      untrack(() => {
        startDraft().catch((ex) => {
          showErrorToast = true;
          // eslint-disable-next-line no-console
          console.error(ex);
        });
      });
    }
  });

  // Register the editor root and resolve the Compute fields the same way the main editor does
  initEntryDraftEditor(
    () => entryDraft,
    () => wrapper,
  );
</script>

<Dialog
  bind:open
  title={_(editing ? 'relation_field.edit_entry_title' : 'create_entry_title', {
    values: { name },
  })}
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
    <p class="hint">
      {_(editing ? 'relation_field.edit_together_hint' : 'relation_field.save_together_hint', {
        values: { name },
      })}
    </p>
    {#if changedSince}
      <Alert status="warning">
        {_('relation_field.changed_since_edit', { values: { name } })}
      </Alert>
    {/if}
    {#if entryDraft.current && pane.current}
      {@const { locale } = pane.current}
      <div role="none" id="{componentId}-body" class="fields">
        <!-- There’s no sidebar with the Slug panel in the dialog, so a slug that has to be typed
          in is edited here. Otherwise, the slug template fills it -->
        {#if needsSlugInput(entryDraft.current) && entryDraft.current.slugEditor[locale]}
          {#key locale}
            <SlugEditor {locale} />
          {/key}
        {/if}
        <EntryEditor {locale} />
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Spacer flex={true} />
    <Button
      variant="primary"
      label={_(editing ? 'update' : 'add')}
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

<ValidationErrorsToast bind:show={showValidationToast} count={errorCount} />

<Toast bind:show={showErrorToast}>
  <Alert status="error">
    {_(editing ? 'relation_field.edit_failed' : 'relation_field.add_failed', {
      values: { name },
    })}
  </Alert>
</Toast>

<Toast bind:show={showMoveToast}>
  <Alert status="error">
    {_('relation_field.move_unsupported', { values: { name } })}
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
