<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';

  import { slugify } from '$lib/services/common/slug';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
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

  /** @type {string[]} */
  let otherSlugs = $state([]);
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
  };

  /**
   * Validate the slug for a given locale.
   * @param {InternalLocaleCode} locale The locale code to validate.
   * @returns {SlugValidationResult} The validation result.
   */
  const validateSlug = (locale) => {
    if (!updatedSlugs[locale].trim()) {
      return 'empty';
    }

    if (/[/\s]/.test(updatedSlugs[locale])) {
      return 'invalid';
    }

    if (otherSlugs.includes(updatedSlugs[locale])) {
      return 'duplicate';
    }

    return false;
  };

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
  okDisabled={equal(currentSlugs, updatedSlugs) ||
    Object.values(validations).some((invalid) => invalid !== false)}
  onOk={() => {
    /** @type {EntryDraft} */ ($entryDraft).currentSlugs = Object.fromEntries(
      Object.entries(updatedSlugs).map(([locale, slug]) => [locale, slugify(slug, { locale })]),
    );
  }}
>
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
