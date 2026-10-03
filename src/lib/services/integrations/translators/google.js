import { postJSON } from '$lib/services/integrations/ai/api';

/**
 * @import { LanguagePair, TranslationOptions, TranslationService } from '$lib/types/private';
 */

const serviceId = 'google';
const serviceLabel = 'Google Cloud Translation';
const apiLabel = 'Cloud Translation API';
const developerURL = 'https://console.cloud.google.com/apis/library/translate.googleapis.com';
const apiKeyURL = 'https://console.cloud.google.com/apis/api/translate.googleapis.com/credentials';
// Anchored, so a key for another service entered while this one is selected isn’t accepted and sent
// to the wrong API
const apiKeyPattern = /^AIza[0-9A-Za-z-_]{35}$/;

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
 * Language codes that Google Cloud Translation API knows under a different code.
 * @type {Record<string, string>}
 */
const LANGUAGE_ALIASES = {
  // Norwegian written standard, which Google calls Norwegian
  nb: 'no',
};

/**
 * Normalize a locale code to a supported language code. A locale can have a script code, like
 * `zh-Hant` or `pa-Arab`, and a region code, like `fr-FR`, in either case and separated with a
 * hyphen or an underscore.
 * @param {string} locale Locale code, e.g., 'en', 'fr-FR', 'zh-CN', 'zh-Hant'.
 * @returns {string | undefined} Normalized language code, e.g., 'en', 'fr-FR', 'zh-CN', 'zh-TW'.
 */
export const normalizeLanguage = (locale) => {
  const [language, ...parts] = locale.split(/[-_]/);
  const lang = language.toLowerCase();
  const scriptTag = parts.find((tag) => /^[a-z]{4}$/i.test(tag));
  const regionTag = parts.find((tag) => /^(?:[a-z]{2}|\d{3})$/i.test(tag));

  const script = scriptTag
    ? `${scriptTag[0].toUpperCase()}${scriptTag.slice(1).toLowerCase()}`
    : undefined;

  const region = regionTag?.toUpperCase();

  // Chinese: We should not fall back to `zh` for Traditional Chinese, because it’s Simplified
  if (lang === 'zh') {
    if (script === 'Hant' || (!script && ['TW', 'HK', 'MO'].includes(region ?? ''))) {
      return 'zh-TW';
    }

    if (script === 'Hans' || (!script && ['CN', 'SG'].includes(region ?? ''))) {
      return 'zh-CN';
    }
  }

  const candidates = [
    script ? `${lang}-${script}` : undefined,
    region ? `${lang}-${region}` : undefined,
    LANGUAGE_ALIASES[lang] ?? lang,
  ];

  return candidates.find((code) => !!code && SUPPORTED_LANGUAGES.includes(code));
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

  const { data } = /** @type {{ data: { translations: { translatedText: string }[] } }} */ (
    await postJSON({
      endpoint: url,
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      apiLabel: 'Google Translate',
      body: requestBody,
    })
  );

  // cspell:disable-next-line
  // Decode apostrophes in translated text (e.g., "Aujourd&#39;hui" → "Aujourd'hui")
  return data.translations.map((t) => t.translatedText.replace(/&#39;/g, "'"));
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
