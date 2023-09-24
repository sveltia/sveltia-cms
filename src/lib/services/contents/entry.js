import { flatten } from 'flat';
import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';
import { getEntriesByCollection, getFieldByKeyPath } from '$lib/services/contents';

/**
 * Get an entry’s field value by locale and key.
 * @param {Entry} entry Entry.
 * @param {LocaleCode} locale Locale code.
 * @param {string} key Field name, which can be dot notation like `name.en` for a nested field, or
 * one of other entry metadata property keys: `slug`, `commit_author` and `commit_date` .
 * @returns {*} Value.
 */
export const getPropertyValue = (entry, locale, key) => {
  const { slug, locales, commitAuthor: { name, email } = {}, commitDate } = entry;

  if (key === 'slug') {
    return slug;
  }

  if (key === 'commit_author') {
    return name || email;
  }

  if (key === 'commit_date') {
    return commitDate;
  }

  /** @type {EntryContent} */
  const content = locales[locale]?.content;

  if (content === undefined) {
    return undefined;
  }

  const value = key.includes('.') ? flatten(content)[key] : content[key];

  const fieldConfig = /** @type {RelationField} */ (
    getFieldByKeyPath(entry.collectionName, undefined, key, {})
  );

  // Resolve the displayed value for a relation field
  if (fieldConfig?.widget === 'relation') {
    const relFieldConfig = /** @type {RelationField} */ (fieldConfig);
    const refEntries = getEntriesByCollection(relFieldConfig.collection);
    const refOptions = getOptions(locale, relFieldConfig, refEntries);

    return refOptions.find((option) => option.value === value)?.label || value;
  }

  return value;
};
