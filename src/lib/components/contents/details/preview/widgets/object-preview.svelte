<!--
  @component
  Implement the preview for the Object widget.
  @see https://www.netlifycms.org/docs/widgets/#object
-->
<script>
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  // svelte-ignore unused-export-let
  export let currentValue = undefined;

  $: ({ fields } = fieldConfig);
</script>

<section class="subsection">
  {#each fields as subField (subField.name)}
    <FieldPreview keyPath={[keyPath, subField.name].join('.')} {locale} fieldConfig={subField} />
  {/each}
</section>
