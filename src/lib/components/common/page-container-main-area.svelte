<slot name="primary_toolbar" />
<div role="none" class="main-inner">
  <div role="none" class="main-inner-main">
    <slot name="secondary_toolbar" />
    <slot name="main_content" />
  </div>
  <slot name="secondary_sidebar" />
</div>

<style lang="scss">
  .main-inner {
    flex: auto;
    display: flex;
    overflow: hidden;

    .main-inner-main {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :global(.secondary-sidebar) {
      flex: none;
      overflow: auto;
      box-sizing: content-box;
      width: 320px;
      border-left: 1px solid var(--sui-primary-border-color);
    }
  }
</style>
