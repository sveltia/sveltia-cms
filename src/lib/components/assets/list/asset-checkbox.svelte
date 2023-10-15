<script>
  import { Checkbox } from '@sveltia/ui';
  import { selectedAssets } from '$lib/services/assets';

  /**
   * @type {Asset}
   */
  export let asset;
</script>

<Checkbox
  checked={$selectedAssets.includes(asset)}
  on:change={({ detail: { checked } }) => {
    selectedAssets.update((assets) => {
      const index = assets.indexOf(asset);

      if (checked && index === -1) {
        assets.push(asset);
      }

      if (!checked && index > -1) {
        assets.splice(index, 1);
      }

      return assets;
    });
  }}
/>
