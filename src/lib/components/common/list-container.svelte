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
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding: 16px;
  }
</style>
