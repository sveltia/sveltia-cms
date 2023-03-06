<!--
  @component
  Implement the editor for the Text widget.
  @see https://www.netlifycms.org/docs/widgets/#text
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({ i18n } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
</script>

<TextArea autoResize={true} {disabled} bind:value={currentValue} />
