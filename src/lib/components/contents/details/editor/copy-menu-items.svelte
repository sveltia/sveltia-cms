<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { copyFromLocale } from '$lib/services/contents/draft/update/copy';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @import { InternalLocaleCode, LanguagePair } from '$lib/types/private';
   * @import { FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {InternalLocaleCode[]} otherLocales Other locales.
   * @property {FieldKeyPath} [keyPath] Field key path.
   * @property {boolean} [translate] Whether to translate the field.
   * @property {boolean} [submenu] Whether to gather the source locales in a submenu when there’s
   * more than one of them. Useful where the options share a menu with unrelated commands, which a
   * long list of locales would otherwise bury.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    otherLocales,
    keyPath = '',
    translate = false,
    submenu = false,
    /* eslint-enable prefer-const */
  } = $props();

  const useSubmenu = $derived(submenu && otherLocales.length > 1);

  /**
   * Check if a menu item should be disabled.
   * @param {LanguagePair} languages Language pair.
   * @returns {Promise<boolean>} Whether the menu item should be disabled.
   */
  const isMenuDisabled = async ({ sourceLanguage, targetLanguage }) =>
    !entryDraft.current?.currentLocales[targetLanguage] ||
    !entryDraft.current.currentLocales[sourceLanguage] ||
    (!!keyPath && !getValueMapSnapshot(entryDraft.current, sourceLanguage)[keyPath]) ||
    (!translate &&
      !!keyPath &&
      getValueMapSnapshot(entryDraft.current, sourceLanguage)[keyPath] ===
        getValueMapSnapshot(entryDraft.current, targetLanguage)[keyPath]) ||
    (translate && !(await translator.current?.availability({ sourceLanguage, targetLanguage })));
</script>

{#snippet localeItems()}
  {#each otherLocales as otherLocale (otherLocale)}
    {@const localeLabel = getLocaleLabel(otherLocale)}
    {@const languagePair = { sourceLanguage: otherLocale, targetLanguage: locale }}
    {#await isMenuDisabled(languagePair) then disabled}
      <MenuItem
        label={useSubmenu
          ? localeLabel
          : _(translate ? 'translate_from_x' : 'copy_from_x', { values: { locale: localeLabel } })}
        {disabled}
        onclick={() => {
          if (entryDraft.current) {
            copyFromLocale({
              draft: entryDraft.current,
              options: { ...languagePair, keyPath, translate },
            });
          }
        }}
      />
    {/await}
  {/each}
{/snippet}

{#if useSubmenu}
  <MenuItem label={_(translate ? 'translate_from' : 'copy_from')}>
    {#snippet items()}
      {@render localeItems()}
    {/snippet}
  </MenuItem>
{:else}
  {@render localeItems()}
{/if}
