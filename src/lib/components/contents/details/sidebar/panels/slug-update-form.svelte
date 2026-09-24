<script>
  import { _ } from '@sveltia/i18n';

  import EditableText from '$lib/components/common/editable-text.svelte';
  import PanelSection from '$lib/components/contents/details/sidebar/panels/panel-section.svelte';
  import { validateNewFolderName } from '$lib/services/common/slug';
  import { getFolderName } from '$lib/services/contents/collection/nested/i18n';
  import { getSlugOptions } from '$lib/services/contents/collection/slug';
  import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    getSlugValidationMessage,
    getTakenSlugs,
    validateSlug,
  } from '$lib/services/contents/draft/validate/slugs';
  import {
    getOwnFolderPaths,
    getTakenFolderNames,
    renameEntryFolders,
    updateSlugs,
  } from '$lib/services/contents/editor/slug';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Row
   * @property {InternalLocaleCode} locale Locale.
   * @property {string} label Label of the value.
   * @property {boolean} showLabel Whether to show the label, which is the locale of the value. A
   * value shared by every locale is the only one, which needs no heading.
   * @property {string} value Current slug or folder name.
   */

  const entryDraft = getEntryDraftContext();

  // The form is only rendered while the draft is there
  const draft = $derived(/** @type {EntryDraft} */ (entryDraft.current));
  const { currentSlugs } = $derived(draft);
  /**
   * The collection’s `pattern` slug option. The slug can only be edited in an entry collection.
   */
  const { pattern } = $derived(getSlugOptions(draft.collection));
  /**
   * Folder the entry occupies in each locale, in a collection where every entry is an index file
   * within one. The folder name is what identifies the entry, so renaming it is what the slug
   * editor does there, and the entry keeps its place in the tree.
   */
  const ownFolderPaths = $derived(getOwnFolderPaths(draft));
  /**
   * Whether each locale has a folder of its own, which is the case when the slugs are localized, as
   * the folder is named after the slug. Otherwise, the folder is shared by every locale.
   * @see https://github.com/sveltia/sveltia-cms/issues/962
   */
  const localized = $derived(hasLocalizedSlugs(draft.collection));
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
   * Get the label of a value: its locale, or what it is if it’s shared by every locale.
   * @param {InternalLocaleCode} locale Locale, or `_` or `_default` for a slug shared by every
   * locale.
   * @returns {{ label: string, showLabel: boolean }} Label and whether to show it.
   */
  const getLabel = (locale) => {
    const shared = ownFolderPaths ? !localized : ['_', '_default'].includes(locale);

    return shared
      ? { label: _(ownFolderPaths ? 'folder' : 'slug'), showLabel: false }
      : { label: getLocaleLabel(locale) ?? locale, showLabel: true };
  };

  /**
   * Values to edit: the entry’s folder names or slugs. A locale the entry has no file for has no
   * slug to rename.
   * @type {Row[]}
   */
  const rows = $derived(
    ownFolderPaths
      ? Object.entries(ownFolderPaths).map(([locale, dirPath]) => ({
          locale,
          ...getLabel(locale),
          value: getFolderName(dirPath),
        }))
      : Object.entries(currentSlugs)
          .filter(([, slug]) => slug !== undefined)
          .map(([locale, slug]) => ({
            locale,
            ...getLabel(locale),
            value: /** @type {string} */ (slug),
          })),
  );

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

    const text = texts[locale];

    if (ownFolderPaths) {
      // A folder name goes by different rules than a slug: it’s slugified on the way out, so what
      // matters is that something usable survives and the folder doesn’t end up hidden behind a
      // leading dot
      const error = validateNewFolderName({ takenNames: takenFolderNames[locale], name: text });

      return error ? _(`new_parent_folder_error.${error}`) : undefined;
    }

    const error = validateSlug({ slug: text, pattern, takenSlugs: takenSlugs[locale], locale });

    return error ? getSlugValidationMessage({ error, pattern }) : undefined;
  };

  /**
   * Apply the edited value of the given locale to the draft. It’s saved along with the entry.
   * @param {Row} row Edited value.
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
