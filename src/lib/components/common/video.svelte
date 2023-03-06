<script>
  export let src = '';
  export let cover = false;
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<video class:cover playsinline {src} {...$$restProps} />

<style lang="scss">
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;

    &.cover {
      object-fit: cover;
    }
  }
</style>
