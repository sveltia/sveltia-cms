<!--
  @component
  Thin wrapper around `<AssetPreview>` that pins the asset kind to `video`. Every property is
  forwarded as is; see `asset-preview.svelte` for the supported properties and their defaults.
-->
<script>
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';

  /** @type {Record<string, any>} */
  const { ...rest } = $props();
</script>

<AssetPreview kind="video" {...rest} />
