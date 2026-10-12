<script>
  import { _ } from '@sveltia/i18n';

  import EditableText from '$lib/components/common/editable-text.svelte';
  import PanelSection from '$lib/components/contents/details/sidebar/panels/panel-section.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getTakenSlugs } from '$lib/services/contents/draft/validate/slugs';
  import {
    getOwnFolderPaths,
    getTakenFolderNames,
    renameEntryFolders,
    updateSlugs,
  } from '$lib/services/contents/editor/slug';
  import { getSlugEditError, getSlugEditRows } from '$lib/services/contents/editor/slug-form';

  /**
   * @import { SlugEditRow } from '$lib/services/contents/editor/slug-form';
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  const entryDraft = getEntryDraftContext();

  // The form is only rendered while the draft is there
  const draft = $derived(/** @type {EntryDraft} */ (entryDraft.current));
  /**
   * Folder the entry occupies in each locale, in a collection where every entry is an index file
   * within one. The folder name is what identifies the entry, so renaming it is what the slug
   * editor does there, and the entry keeps its place in the tree.
   */
  const ownFolderPaths = $derived(getOwnFolderPaths(draft));
  /**
   * Slugs taken by the other entries, in each locale.
   */
  const takenSlugs = $derived(getTakenSlugs(draft));
  /**
   * Names of the folders sharing a parent with the entry’s own folder in each locale, which are the
   * only ones that can be in the way.
   */
  const takenFolderNames = $derived(
    ownFolderPaths ? getTakenFolderNames({ draft, ownFolderPaths }) : {},
  );

  /**
   * Values to edit: the entry’s folder names or slugs.
   */
  const rows = $derived(getSlugEditRows({ draft, ownFolderPaths }));

  /** @type {Record<InternalLocaleCode, boolean>} */
  const editing = $state({});
  /** @type {Record<InternalLocaleCode, string>} */
  const texts = $state({});

  /**
   * Get the error message for the value being edited in the given locale, checked as it’s typed.
   * @param {InternalLocaleCode} locale Locale.
   * @returns {string | undefined} Error message, or `undefined` if the value can be used.
   */
  const getEditError = (locale) => {
    if (!editing[locale]) {
      return undefined;
    }

    return getSlugEditError({
      draft,
      ownFolderPaths,
      takenFolderNames,
      takenSlugs,
      locale,
      text: texts[locale],
    });
  };

  /**
   * Apply the edited value of the given locale to the draft. It’s saved along with the entry.
   * @param {SlugEditRow} row Edited value.
   * @param {string} text Edited text.
   * @returns {boolean} Whether the editing ends, which it doesn’t while the value is invalid.
   */
  const apply = ({ locale, value }, text) => {
    if (getEditError(locale)) {
      return false;
    }

    if (text !== value) {
      if (ownFolderPaths) {
        // Renaming the folder is what moves the entry, so the rest of the save takes care of the
        // entries and assets stored below it
        renameEntryFolders({ draft, ownFolderPaths, folderNames: { [locale]: text } });
      } else {
        updateSlugs({ draft, slugs: { [locale]: text } });
      }
    }

    return true;
  };
</script>

{#each rows as row (row.locale)}
  {@const { locale, label, showLabel, value } = row}
  {@const error = getEditError(locale)}
  <PanelSection {label} {showLabel}>
    {#snippet children(labelId)}
      <EditableText
        id="{labelId}-value"
        {value}
        bind:editing={editing[locale]}
        bind:text={texts[locale]}
        editLabel={ownFolderPaths ? _('rename_folder') : _('edit_slug')}
        invalid={!!error}
        applyDisabled={!!error}
        ariaLabelledby={labelId}
        ariaErrormessage="{labelId}-error"
        onApply={(text) => apply(row, text)}
      />
      <p id="{labelId}-error" class="error">
        {#if error}
          {error}
        {/if}
      </p>
    {/snippet}
  </PanelSection>
{/each}

<style>
  p.error:empty {
    display: none;
  }

  p.error {
    margin: 0;
    padding: 0 4px;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
