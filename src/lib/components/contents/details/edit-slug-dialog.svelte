<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { stripSlashes } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';

  import { getNewFolderName, slugify, validateNewFolderName } from '$lib/services/common/slug';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import {
    getEntryDirPath,
    getSharedEntryFileName,
  } from '$lib/services/contents/collection/nested';
  import { getFolderName, getOwnFolderName } from '$lib/services/contents/collection/nested/i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
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
   * and the entry keeps its place in the tree.
   */
  const ownFolderPath = $derived.by(() => {
    const collection = $entryDraft?.collection;

    if (!collection || $entryDraft?.isNew || !getSharedEntryFileName(collection)) {
      return undefined;
    }

    return stripSlashes($entryDraft?.currentPath ?? '');
  });

  const renamesFolder = $derived(ownFolderPath !== undefined);
  const defaultLocale = $derived($entryDraft?.defaultLocale ?? '_default');
  /**
   * Whether the folder goes by a different name in each locale. That’s the case when the slugs are
   * localized, as the folder is named after the slug; otherwise the folder is shared by every
   * locale, so there’s a single field rather than one per locale.
   * @see https://github.com/sveltia/sveltia-cms/issues/962
   */
  const localizesFolder = $derived(
    renamesFolder && !!$entryDraft && hasLocalizedSlugs($entryDraft.collection),
  );

  /**
   * Folder the entry occupies in each locale. The default locale’s folder is the one the path
   * editor points at; the other locales are only there when the folder is localized, and their
   * folder is the one in the localized slug, which is the entry’s sub path in that locale.
   * @type {Record<InternalLocaleCode, string>}
   */
  const ownFolderPaths = $derived.by(() => {
    if (ownFolderPath === undefined) {
      return {};
    }

    if (!localizesFolder) {
      return { [defaultLocale]: ownFolderPath };
    }

    return {
      [defaultLocale]: ownFolderPath,
      ...Object.fromEntries(
        Object.entries($entryDraft?.currentSlugs ?? {})
          .filter(
            ([locale, slug]) =>
              locale !== defaultLocale &&
              !!$entryDraft?.currentLocales[locale] &&
              !!getOwnFolderName(slug ?? ''),
          )
          .map(([locale, slug]) => [locale, getEntryDirPath(/** @type {string} */ (slug))]),
      ),
    };
  });

  /** @type {string[]} */
  let otherSlugs = $state([]);
  /** @type {Record<InternalLocaleCode, string>} */
  let updatedFolderNames = $state({});
  /** @type {Record<InternalLocaleCode, SlugValidationResult>} */
  let folderValidations = $state({});
  /**
   * Names of the folders sharing a parent with the entry’s own folder in each locale, which are the
   * only ones that can be in the way.
   * @type {Record<InternalLocaleCode, string[]>}
   */
  let takenFolderNames = $state({});
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
    const otherEntries = [
      ...getEntriesByCollection(collectionName),
      ...getUnpublishedEntriesByCollection(collectionName),
    ];

    otherSlugs = otherEntries
      .filter((entry) => !Object.values(entry.locales).some(({ path }) => ownPaths.has(path)))
      .flatMap((entry) => Object.values(entry.locales).map(({ slug }) => slug))
      .filter((slug) => !currentSlugSet.has(slug));
    Object.assign(updatedSlugs, currentSlugs);
    Object.assign(
      validations,
      Object.fromEntries(Object.keys(currentSlugs).map((locale) => [locale, false])),
    );

    if (renamesFolder) {
      updatedFolderNames = Object.fromEntries(
        Object.entries(ownFolderPaths).map(([locale, dirPath]) => [locale, getFolderName(dirPath)]),
      );
      folderValidations = Object.fromEntries(
        Object.keys(ownFolderPaths).map((locale) => [locale, false]),
      );

      // Only the folders sharing a parent with this one can be in the way. The unpublished entries
      // count too, the same way they do for the slug above. In another locale, the siblings are
      // the folders next to the entry’s localized folder
      takenFolderNames = Object.fromEntries(
        Object.entries(ownFolderPaths).map(([locale, dirPath]) => {
          const parentPath = getEntryDirPath(dirPath);

          return [
            locale,
            otherEntries
              .filter((entry) => entry.id !== originalEntry?.id)
              .map((entry) =>
                locale === defaultLocale ? entry.subPath : entry.locales[locale]?.slug,
              )
              .filter((otherSubPath) => typeof otherSubPath === 'string')
              .map((otherSubPath) => getEntryDirPath(otherSubPath))
              .filter((otherDirPath) => getEntryDirPath(otherDirPath) === parentPath)
              .map((otherDirPath) => getFolderName(otherDirPath)),
          ];
        }),
      );
    }
  };

  /**
   * Whether any folder name has been changed to something usable.
   */
  const folderNamesChanged = $derived(
    Object.entries(updatedFolderNames).some(
      ([locale, name]) => name !== getFolderName(ownFolderPaths[locale] ?? ''),
    ) && Object.values(folderValidations).every((invalid) => invalid === false),
  );

  /**
   * Rename the entry’s folder in each locale. Renaming the folder is what moves the entry, so the
   * rest of the save takes care of the entries and assets stored below it.
   */
  const renameFolders = () => {
    const draft = /** @type {EntryDraft} */ ($entryDraft);
    let { currentPath, currentSlugs: slugs } = draft;

    Object.entries(updatedFolderNames).forEach(([locale, name]) => {
      const dirPath = createPath([getEntryDirPath(ownFolderPaths[locale]), getNewFolderName(name)]);

      if (locale === defaultLocale) {
        currentPath = dirPath;
      } else {
        // The localized slug of an existing entry is its sub path in the locale, so the folder is
        // renamed within it, leaving the file name in place
        slugs = {
          ...slugs,
          [locale]: createPath([
            dirPath,
            getPathInfo(/** @type {string} */ (slugs[locale])).basename,
          ]),
        };
      }
    });

    // Assign through the store so that the editor picks up the change
    $entryDraft = { ...draft, currentPath, currentSlugs: slugs };
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
    ? !folderNamesChanged
    : equal(currentSlugs, updatedSlugs) ||
      Object.values(validations).some((invalid) => invalid !== false)}
  onOk={() => {
    if (renamesFolder) {
      renameFolders();

      return;
    }

    /** @type {EntryDraft} */ ($entryDraft).currentSlugs = Object.fromEntries(
      Object.entries(updatedSlugs).map(([locale, slug]) => [locale, slugify(slug, { locale })]),
    );
  }}
>
  {#if renamesFolder}
    <div role="none" class="locales">
      {#each Object.keys(updatedFolderNames) as locale (locale)}
        <section>
          {#if localizesFolder}
            <div role="none">
              <h3>{getLocaleLabel(locale) ?? locale}</h3>
            </div>
          {/if}
          <div role="none">
            <TextInput
              dir="auto"
              flex
              bind:value={updatedFolderNames[locale]}
              oninput={() => {
                // A folder name goes by different rules than a slug: it’s slugified on the way out,
                // so what matters is that something usable survives and the folder doesn’t end up
                // hidden behind a leading dot
                folderValidations[locale] =
                  validateNewFolderName({
                    takenNames: takenFolderNames[locale] ?? [],
                    name: updatedFolderNames[locale],
                  }) ?? false;
              }}
              invalid={folderValidations[locale] !== false}
              aria-errormessage="{componentId}-{locale}-folder-error"
            />
            <p id="{componentId}-{locale}-folder-error" class="error">
              {#if folderValidations[locale]}
                {_(`new_parent_folder_error.${folderValidations[locale]}`)}
              {/if}
            </p>
          </div>
        </section>
      {/each}
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
