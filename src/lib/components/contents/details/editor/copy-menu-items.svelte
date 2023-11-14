<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { copyFromLocale, entryDraft } from '$lib/services/contents/editor';
  import { getLocaleLabel } from '$lib/services/i18n';
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
   * @type {string}
   */
  export let keyPath = '';
  export let translate = false;
  /**
   * Reference to the anchor component that will be focused once the API Key dialog is closed.
   * @type {import('@sveltia/ui').MenuButton}
   */
  export let anchor;

  $: ({ collection, currentLocales } = $entryDraft);
  $: ({ hasLocales = false, locales = ['default'] } =
    collection._i18n ?? /** @type {I18nConfig} */ ({}));
  $: otherLocales = hasLocales ? locales.filter((l) => l !== locale) : [];

  $: ({
    serviceId,
    sourceLanguages = /** @type {string[]} */ ([]),
    targetLanguages = /** @type {string[]} */ ([]),
  } = $translator ?? /** @type {TranslationService} */ ({}));

  $: apiKey = $prefs.apiKeys[serviceId] ?? '';

  /**
   * Copy or translate field value(s) from another locale.
   * @param {string} otherLocale Source locale, e.g. `en`.
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
      (translate &&
        (!sourceLanguages.includes(locale.toUpperCase()) ||
          !targetLanguages.includes(otherLocale.toUpperCase())))}
    on:click={() => {
      _copyFromLocale(otherLocale);
    }}
  />
{/each}
