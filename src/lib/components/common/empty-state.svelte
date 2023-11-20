<div role="none" class="empty">
  <slot />
</div>

<style lang="scss">
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    width: 100%;
    height: 100%;
    text-align: center;
  }
</style>
