<!--
  @component
  Implement the editor for the Boolean widget.
  @see https://www.netlifycms.org/docs/widgets/#boolean
-->
<script>
  import { Switch } from '@sveltia/ui';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({ i18n } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
</script>

<Switch bind:checked={currentValue} {disabled} />
