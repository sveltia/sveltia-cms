<!--
  @component
  Implement the editor for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({ i18n } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
</script>

<TextInput {disabled} bind:value={currentValue} />
