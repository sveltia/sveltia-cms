/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'google';
const serviceLabel = 'Google Cloud Translation';
const apiLabel = 'Cloud Translation API';
const developerURL = 'https://console.cloud.google.com/apis/library/translate.googleapis.com';
const apiKeyURL = 'https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials';
const apiKeyPattern = /AIza[0-9A-Za-z-_]{35}/;

/**
 * Supported source/target languages for Google Cloud Translation API.
 * @see https://cloud.google.com/translate/docs/languages
 */
const SUPPORTED_LANGUAGES = [
  'ab,ace,ach,af,ak,alz,am,ar,as,awa,ay,az',
  'ba,ban,bbc,be,bem,bew,bg,bho,bik,bm,bn,br,bs,bts,btx,bua',
  'ca,ceb,cgg,chm,ckb,cnh,co,crh,crs,cs,cv,cy',
  'da,de,din,doi,dov,dv,dz',
  'ee,el,en,eo,es,et,eu',
  'fa,ff,fi,fil,fj,fr,fr-CA,fr-FR,fy',
  'ga,gaa,gd,gl,gn,gom,gu',
  'ha,haw,he,hi,hil,hmn,hr,hrx,ht,hu,hy',
  'id,ig,ilo,is,it,iw',
  'ja,jv,jw',
  'ka,kk,km,kn,ko,kri,ktu,ku,ky',
  'la,lb,lg,li,lij,lmo,ln,lo,lt,ltg,luo,lus,lv',
  'mai,mak,mg,mi,min,mk,ml,mn,mni-Mtei,mr,ms,ms-Arab,mt,my',
  'ne,new,nl,no,nr,nso,nus,ny',
  'oc,om,or',
  'pa,pa-Arab,pag,pam,pap,pl,ps,pt,pt-BR,pt-PT',
  'qu',
  'rn,ro,rom,ru,rw',
  'sa,scn,sd,sg,shn,si,sk,sl,sm,sn,so,sq,sr,ss,st,su,sv,sw,szl',
  'ta,te,tet,tg,th,ti,tk,tl,tn,tr,ts,tt',
  'ug,uk,ur,uz',
  'vi',
  'xh',
  'yi,yo,yua,yue',
  'zh,zh-CN,zh-TW,zu',
]
  .join(',')
  .split(',');

/**
 * Normalize a locale code to a supported language code.
 * @param {string} locale Locale code, e.g., 'en', 'fr-FR', 'zh-CN'.
 * @returns {string | undefined} Normalized language code, e.g., 'en', 'fr-FR', 'zh-CN'.
 */
export const normalizeLanguage = (locale) => {
  const normalizedLocale = locale.replace(
    /^([a-z]{2,3})[-_]([a-z]{2,4})$/i,
    (_match, lang, region) => `${lang.toLowerCase()}-${region.toUpperCase()}`,
  );

  if (SUPPORTED_LANGUAGES.includes(normalizedLocale)) {
    return normalizedLocale;
  }

  // Traditional Chinese variants: We should not fall back to `zh` because it’s Simplified Chinese
  if (['zh-HK', 'zh-MO'].includes(normalizedLocale)) {
    return 'zh-TW';
  }

  const [lang] = normalizedLocale.split('-');

  if (SUPPORTED_LANGUAGES.includes(lang)) {
    return lang;
  }

  return undefined;
};

/**
 * Check if the given source and target languages are supported.
 * @param {LanguagePair} languages Language pair.
 * @returns {Promise<boolean>} True if both source and target languages are supported.
 */
export const availability = async ({ sourceLanguage, targetLanguage }) =>
  !!normalizeLanguage(sourceLanguage) && !!normalizeLanguage(targetLanguage);

/**
 * Translate the given text with Google Cloud Translation API using the basic model and HTML format.
 * @param {string[]} texts Array of original texts.
 * @param {TranslationOptions} options Options.
 * @returns {Promise<string[]>} Translated strings in the original order.
 * @throws {Error} When the source or target locale is not supported or API call fails.
 * @see https://cloud.google.com/translate/docs/basic/translating-text
 * @see https://cloud.google.com/translate/docs/reference/rest/v2/translate
 * @see https://cloud.google.com/docs/authentication/api-keys-use
 */
const translate = async (texts, { sourceLanguage, targetLanguage, apiKey }) => {
  sourceLanguage = normalizeLanguage(sourceLanguage) ?? '';
  targetLanguage = normalizeLanguage(targetLanguage) ?? '';

  if (!sourceLanguage) {
    throw new Error('Source locale is not supported.');
  }

  if (!targetLanguage) {
    throw new Error('Target locale is not supported.');
  }

  // Cloud Translation API v2 endpoint
  const url = 'https://translation.googleapis.com/language/translate/v2';

  const requestBody = {
    q: texts,
    source: sourceLanguage,
    target: targetLanguage,
    format: 'html',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        `Google Translate API error: ${response.status} ${response.statusText}` +
          `${errorData.error?.message ? ` - ${errorData.error.message}` : ''}`,
      );
    }

    const { data } = /** @type {{ data: { translations: { translatedText: string }[] } }} */ (
      await response.json()
    );

    // cspell:disable-next-line
    // Decode apostrophes in translated text (e.g., "Aujourd&#39;hui" → "Aujourd'hui")
    return data.translations.map((t) => t.translatedText.replace(/&#39;/g, "'"));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to translate text with Google Translate API.');
  }
};

/**
 * @type {TranslationService}
 */
export default {
  serviceId,
  serviceLabel,
  apiLabel,
  developerURL,
  apiKeyURL,
  apiKeyPattern,
  markdownSupported: false,
  availability,
  translate,
};
