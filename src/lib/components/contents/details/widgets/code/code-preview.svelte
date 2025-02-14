<!--
  @component
  Implement the preview for the Code widget.
  @see https://decapcms.org/docs/widgets/#code
-->
<script>
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @typedef {object} Props
   * @property {CodeField} fieldConfig - Field configuration.
   * @property {string | {}} [currentValue] - Field value.
   */

  /** @type {WidgetEditorProps & Props} */
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
