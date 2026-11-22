import { locale as appLocale } from '@sveltia/i18n';

import { getListFormatter } from '$lib/services/contents/i18n';

/**
 * Join names into a list in the app locale, e.g. “Ada, Bob, and Carol”.
 * @param {{ name: string }[]} people People.
 * @returns {string} List.
 */
export const formatNames = (people) =>
  getListFormatter(appLocale.current, { style: 'long' }).format(people.map(({ name }) => name));
