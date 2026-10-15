import { getLocalizedDateTimeValue } from '$lib/services/contents/fields/date-time/value';
import { getLocalizedRelationValue } from '$lib/services/contents/fields/relation/helpers/locale';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Localize a field value copied from another locale: a Relation field value prefixed with the
 * source locale gets the target locale instead, and a DateTime field value written in the source
 * locale with `localize_format: true` is written in the target locale. Any other value is returned
 * as is.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {any} args.value Value copied from the source locale.
 * @param {InternalLocaleCode} args.sourceLocale Source locale.
 * @param {InternalLocaleCode} args.targetLocale Target locale.
 * @returns {any} Localized value.
 */
export const getLocalizedFieldValue = (args) =>
  getLocalizedDateTimeValue({ ...args, value: getLocalizedRelationValue(args) });
