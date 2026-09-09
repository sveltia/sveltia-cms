<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';
  import { stripSlashes } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';

  import { getNewFolderName, slugify, validateNewFolderName } from '$lib/services/common/slug';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import {
    getEntryDirPath,
    getSharedEntryFileName,
  } from '$lib/services/contents/collection/nested';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { createPath } from '$lib/services/utils/file';
  import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

  /**
   * @import { EntryDraft, InternalLocaleCode, UnpublishedEntry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   */

  /**
   * @typedef {false | 'empty' | 'invalid' | 'duplicate'} SlugValidationResult
   */

  /** @type {Props} */
  let { open = $bindable(false) } = $props();

  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const currentSlugs = $derived($entryDraft?.currentSlugs ?? {});
  const originalEntry = $derived(
    /** @type {UnpublishedEntry | undefined} */ ($entryDraft?.originalEntry),
  );

  /**
   * Folder the entry occupies, in a collection where every entry is an index file within one. The
   * folder name is what identifies the entry, so renaming it is what the slug editor does there,
   * and the entry keeps its place in the tree. The folder is shared by every locale, so there’s a
   * single field rather than one per locale.
   */
  const ownFolderPath = $derived.by(() => {
    const collection = $entryDraft?.collection;

    if (!collection || $entryDraft?.isNew || !getSharedEntryFileName(collection)) {
      return undefined;
    }

    return stripSlashes($entryDraft?.currentPath ?? '');
  });

  const renamesFolder = $derived(ownFolderPath !== undefined);
  const parentPath = $derived(ownFolderPath ? getEntryDirPath(ownFolderPath) : '');
  const folderName = $derived(ownFolderPath?.slice(ownFolderPath.lastIndexOf('/') + 1) ?? '');

  /** @type {string[]} */
  let otherSlugs = $state([]);
  let updatedFolderName = $state('');
  /** @type {SlugValidationResult} */
  let folderValidation = $state(false);
  /** @type {Record<InternalLocaleCode, string>} */
  const updatedSlugs = $state({});
  /** @type {Record<InternalLocaleCode, SlugValidationResult>} */
  const validations = $state({});

  const componentId = $props.id();

  /**
   * Initialize the properties.
   */
  const init = () => {
    const currentSlugSet = new Set(Object.values(currentSlugs));

    // Every file path this entry occupies. With Editorial Workflow, a draft that has already
    // renamed the entry leaves the published version behind under the old slug, so that version
    // has to be recognized as the same entry — otherwise reverting the slug looks like a conflict.
    const ownPaths = new Set([
      ...Object.values(originalEntry?.locales ?? {}).map(({ path }) => path),
      ...(originalEntry?.workflow?.previousPaths ?? []),
    ]);

    // Check the unpublished entries too, or the slug of a draft could be taken twice. They’re
    // concatenated rather than swapped over their published versions, because a draft that renamed
    // an entry leaves the published file behind, so both slugs are still in use
    otherSlugs = [
      ...getEntriesByCollection(collectionName),
      ...getUnpublishedEntriesByCollection(collectionName),
    ]
      .filter((entry) => !Object.values(entry.locales).some(({ path }) => ownPaths.has(path)))
      .flatMap((entry) => Object.values(entry.locales).map(({ slug }) => slug))
      .filter((slug) => !currentSlugSet.has(slug));
    Object.assign(updatedSlugs, currentSlugs);
    Object.assign(
      validations,
      Object.fromEntries(Object.keys(currentSlugs).map((locale) => [locale, false])),
    );

    if (renamesFolder) {
      updatedFolderName = folderName;
      folderValidation = false;

      // Only the folders sharing a parent with this one can be in the way. The unpublished entries
      // count too, the same way they do for the slug above
      otherSlugs = [
        ...getEntriesByCollection(collectionName),
        ...getUnpublishedEntriesByCollection(collectionName),
      ]
        .filter((entry) => entry.id !== originalEntry?.id)
        .map(({ subPath }) => getEntryDirPath(subPath))
        .filter((dirPath) => getEntryDirPath(dirPath) === parentPath)
        .map((dirPath) => dirPath.slice(dirPath.lastIndexOf('/') + 1));
    }
  };

  /**
   * Validate the given slug or folder name.
   * @param {string} name Name to validate.
   * @returns {SlugValidationResult} The validation result.
   */
  const validateName = (name) => {
    if (!name.trim()) {
      return 'empty';
    }

    if (/[/\s]/.test(name)) {
      return 'invalid';
    }

    if (otherSlugs.includes(name)) {
      return 'duplicate';
    }

    return false;
  };

  /**
   * Validate the slug for a given locale.
   * @param {InternalLocaleCode} locale The locale code to validate.
   * @returns {SlugValidationResult} The validation result.
   */
  const validateSlug = (locale) => validateName(updatedSlugs[locale]);

  $effect(() => {
    if (open) {
      init();
    }
  });
</script>

<Dialog
  bind:open
  title={_('edit_slug')}
  okLabel={_('update')}
  okDisabled={renamesFolder
    ? updatedFolderName === folderName || folderValidation !== false
    : equal(currentSlugs, updatedSlugs) ||
      Object.values(validations).some((invalid) => invalid !== false)}
  onOk={() => {
    if (renamesFolder) {
      // Renaming the folder is what moves the entry, so the rest of the save takes care of the
      // entries and assets stored below it
      /** @type {EntryDraft} */ ($entryDraft).currentPath = createPath([
        parentPath,
        getNewFolderName(updatedFolderName),
      ]);

      return;
    }

    /** @type {EntryDraft} */ ($entryDraft).currentSlugs = Object.fromEntries(
      Object.entries(updatedSlugs).map(([locale, slug]) => [locale, slugify(slug, { locale })]),
    );
  }}
>
  {#if renamesFolder}
    <div role="none" class="locales">
      <section>
        <div role="none">
          <TextInput
            dir="auto"
            flex
            bind:value={updatedFolderName}
            oninput={() => {
              // A folder name goes by different rules than a slug: it’s slugified on the way out,
              // so what matters is that something usable survives and the folder doesn’t end up
              // hidden behind a leading dot
              folderValidation =
                validateNewFolderName({ takenNames: otherSlugs, name: updatedFolderName }) ?? false;
            }}
            invalid={folderValidation !== false}
            aria-errormessage="{componentId}-folder-error"
          />
          <p id="{componentId}-folder-error" class="error">
            {#if folderValidation}
              {_(`new_parent_folder_error.${folderValidation}`)}
            {/if}
          </p>
        </div>
      </section>
    </div>
  {:else}
    <div role="none" class="locales">
      {#each Object.keys(updatedSlugs) as locale (locale)}
        <section>
          {#if !['_', '_default'].includes(locale)}
            <div role="none">
              <h3>{getLocaleLabel(locale) ?? locale}</h3>
            </div>
          {/if}
          <div role="none">
            <TextInput
              dir="auto"
              flex
              bind:value={updatedSlugs[locale]}
              oninput={() => {
                validations[locale] = validateSlug(locale);
              }}
              invalid={validations[locale] !== false}
              aria-errormessage="{componentId}-{locale}-error"
            />
            <p id="{componentId}-{locale}-error" class="error">
              {#if validations[locale]}
                {_(`edit_slug_error.${validations[locale]}`)}
              {/if}
            </p>
          </div>
        </section>
      {/each}
    </div>
  {/if}
</Dialog>

<style>
  p:not(:empty) {
    margin-top: 0;
  }

  .locales {
    display: table;
    margin: 0;
    width: 100%;

    section {
      display: table-row;

      div {
        display: table-cell;
        vertical-align: middle;
        white-space: nowrap;

        &:last-child {
          width: 90%;
        }
      }

      h3 {
        margin-inline-end: 8px;
        font-size: inherit;
      }

      p.error {
        margin: 0;
        color: var(--sui-error-foreground-color);
        font-size: var(--sui-font-size-small);
      }
    }
  }
</style>
