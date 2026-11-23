import { _, locale as appLocale } from '@sveltia/i18n';

import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @type {Map<string, Intl.NumberFormat>}
 */
const fileSizeFormatterCache = new Map();

/**
 * Format the given file size in bytes, KB, MB, GB or TB.
 * @param {number} size File size.
 * @returns {string} Formatted size.
 */
export const formatSize = (size) => {
  const locale = appLocale.current;

  const formatter = getOrCreate(
    fileSizeFormatterCache,
    locale,
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
  );

  const kb = 1000;
  const mb = kb * 1000;
  const gb = mb * 1000;
  const tb = gb * 1000;

  if (size < kb) {
    return _('file_size_units.b', { values: { size: formatter.format(size) } });
  }

  if (size < mb) {
    return _('file_size_units.kb', { values: { size: formatter.format(size / kb) } });
  }

  if (size < gb) {
    return _('file_size_units.mb', { values: { size: formatter.format(size / mb) } });
  }

  if (size < tb) {
    return _('file_size_units.gb', { values: { size: formatter.format(size / gb) } });
  }

  return _('file_size_units.tb', { values: { size: formatter.format(size / tb) } });
};
