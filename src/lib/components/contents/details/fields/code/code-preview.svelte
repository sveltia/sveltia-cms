<!--
  @component
  Implement the preview for a Code field.
  @see https://decapcms.org/docs/widgets/#Code
  @see https://sveltiacms.app/en/docs/fields/code
-->
<script>
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { CodeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CodeField} fieldConfig Field configuration.
   * @property {string | Record<string, string> | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    default_language: defaultLanguage = '',
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = $derived(fieldConfig);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale]) ?? {});
  const codeKeyPath = $derived(`${keyPath}.${outputKeys.code}`);
  const langKeyPath = $derived(`${keyPath}.${outputKeys.lang}`);
  const code = $derived(outputCodeOnly ? currentValue : valueMap[codeKeyPath]);
  const lang = $derived(outputCodeOnly ? defaultLanguage : valueMap[langKeyPath]);
</script>

{#if code}
  <pre class={lang ? `language-${lang}` : undefined}>{code}</pre>
{/if}
