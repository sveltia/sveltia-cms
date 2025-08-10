<!--
  @component
  Implement the editor for the List widget without subfield(s).
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { onMount, untrack } from 'svelte';

  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { EntryDraft, WidgetEditorProps } from '$lib/types/private';
   * @import { ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue,
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let mounted = $state(false);
  let inputValue = $state('');

  const { i18n } = $derived(fieldConfig);

  /**
   * Update {@link inputValue} when {@link currentValue} is updated.
   */
  const setInputValue = () => {
    inputValue = currentValue?.join('\n') ?? '';
  };

  /**
   * Update the value for the List widget w/o subfield(s). This has to be called from the `input`
   * event handler on `<TextArea>`, not a `inputValue` reaction, because it causes an infinite loop
   * due to {@link setInputValue}.
   */
  const updateSimpleList = () => {
    const normalizedValue = inputValue.split(/\n/g);

    Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      Object.keys($entryDraft?.currentValues[_locale] ?? {}).forEach((_keyPath) => {
        if (_keyPath.match(`^${escapeRegExp(keyPath)}\\.\\d+$`)) {
          delete $entryDraft?.currentValues[_locale][_keyPath];
        }
      });

      normalizedValue.forEach((val, index) => {
        /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][`${keyPath}.${index}`] = val;
      });
    });
  };

  onMount(() => {
    mounted = true;
  });

  $effect(() => {
    if (mounted) {
      void [currentValue];

      untrack(() => {
        setInputValue();
      });
    }
  });
</script>

<TextArea
  bind:value={inputValue}
  autoResize={true}
  flex
  {readonly}
  {required}
  {invalid}
  aria-errormessage="{fieldId}-error"
  oninput={() => {
    updateSimpleList();
  }}
/>
