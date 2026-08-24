<!--
  @component
  Implement the editor for a List field without subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import { getContext, onMount, untrack } from 'svelte';

  import { updateNonPrimitiveValue } from '$lib/services/contents/draft/update';
  import { getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { SimpleListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SimpleListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
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
   * Update the value for the List field without subfield(s). This has to be called from the `input`
   * event handler on `<TextArea>`, not a `inputValue` reaction, because it causes an infinite loop
   * due to {@link setInputValue}.
   * @param {string[]} [value] List items to set. If not provided, split {@link inputValue}.
   */
  const updateList = (value = inputValue.split(/\n/g)) => {
    updateNonPrimitiveValue({ valueStoreKey, locale, keyPath, i18n, value });
  };

  /**
   * Trim spaces on each line and remove any empty lines from the list.
   *
   * The cleaned list is written to the draft only. Assigning it to {@link currentValue} would turn
   * that one-way prop into a local override that keeps its value even after the parent recomputes,
   * and the field would stop following the draft. The `$effect` below re-syncs {@link inputValue}
   * once the update comes back through the prop.
   */
  const cleanUpValue = () => {
    updateList(
      inputValue
        .split(/\n/g)
        .map((val) => val.trim())
        .filter((val) => !!val),
    );
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
  dir={getDirection(locale)}
  bind:value={inputValue}
  autoResize={true}
  flex
  {readonly}
  {required}
  {invalid}
  aria-errormessage="{fieldId}-error"
  oninput={() => {
    updateList();
  }}
  onblur={() => {
    cleanUpValue();
  }}
/>
