<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
  @todo Implement the editor!
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/editor';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {MarkdownField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string}
   */
  export let currentValue = undefined;

  $: ({ i18n } = fieldConfig);
  $: ({ defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: disabled = i18n === 'duplicate' && locale !== defaultLocale;
</script>

<TextArea autoResize={true} {disabled} bind:value={currentValue} />
