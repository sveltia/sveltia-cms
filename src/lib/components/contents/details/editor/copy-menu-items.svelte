<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';
  import {
    pendingTranslatorRequest,
    showTranslatorApiKeyDialog,
    translator,
  } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/prefs';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath = '';
  export let translate = false;
  /**
   * Reference to the anchor component that will be focused once the API Key dialog is closed.
   * @type {import('@sveltia/ui').MenuButton}
   */
  export let anchor;

  $: ({ collection, collectionFile, currentLocales, currentValues } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ i18nEnabled, locales } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: otherLocales = i18nEnabled ? locales.filter((l) => l !== locale) : [];

  $: ({
    serviceId,
    sourceLanguages = /** @type {string[]} */ ([]),
    targetLanguages = /** @type {string[]} */ ([]),
  } = $translator ?? /** @type {TranslationService} */ ({}));

  $: apiKey = $prefs.apiKeys?.[serviceId] ?? '';

  /**
   * Copy or translate field value(s) from another locale.
   * @param {LocaleCode} otherLocale - Source locale, e.g. `en`.
   */
  const _copyFromLocale = async (otherLocale) => {
    if (translate && !apiKey) {
      $showTranslatorApiKeyDialog = true;
      $pendingTranslatorRequest = [otherLocale, locale, keyPath, translate];

      const unsubscribe = showTranslatorApiKeyDialog.subscribe((show) => {
        if (!show) {
          unsubscribe();
          window.setTimeout(() => {
            anchor.focus();
          }, 250);
        }
      });
    } else {
      copyFromLocale(otherLocale, locale, keyPath, translate);
    }
  };
</script>

{#each otherLocales as otherLocale}
  <MenuItem
    label={$_(translate ? 'translate_from_x' : 'copy_from_x', {
      values: { locale: getLocaleLabel(otherLocale) },
    })}
    disabled={!currentLocales[locale] ||
      !currentLocales[otherLocale] ||
      (keyPath && !currentValues[otherLocale][keyPath]) ||
      (!translate &&
        keyPath &&
        currentValues[otherLocale][keyPath] === currentValues[locale][keyPath]) ||
      (translate &&
        (!sourceLanguages.includes(locale.toUpperCase()) ||
          !targetLanguages.includes(otherLocale.toUpperCase())))}
    on:click={() => {
      _copyFromLocale(otherLocale);
    }}
  />
{/each}
