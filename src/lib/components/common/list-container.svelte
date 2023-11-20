<!--
  @component A container for the entry list or asset list.
-->
<script>
  import { Group } from '@sveltia/ui';
</script>

<div role="none" class="list-container">
  <Group {...$$restProps}>
    <slot />
  </Group>
</div>

<style lang="scss">
  .list-container {
    flex: auto;
    position: relative;
    height: 100%;
    overflow: hidden;

    & > :global(.group) {
      padding: 16px;
      height: 100%;
      overflow-y: auto;
      overscroll-behavior-y: contain;

      & :global(.drop-target) {
        height: auto;
      }
    }
  }
</style>
