<!--
  @component
  Implement the editor for a Text field: the String field editor with a text area.
  @see https://decapcms.org/docs/widgets/#Text
  @see https://sveltiacms.app/en/docs/fields/text
-->
<script>
  import StringEditor from '$lib/components/contents/details/fields/string/string-editor.svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {TextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let { currentValue = $bindable(), ...rest } = $props();
</script>

<StringEditor {...rest} bind:currentValue multiline />
