<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import { getYouTubeEmbedURL } from '$lib/services/utils/media/video/youtube';

  /**
   * @typedef {object} Props
   * @property {string} url Video URL.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    url,
    /* eslint-enable prefer-const */
  } = $props();

  let embeddable = $state(true);

  const embedURL = $derived(getYouTubeEmbedURL(url));

  onMount(() => {
    // Hide the iframe if CSP is violated
    window.addEventListener('securitypolicyviolation', ({ blockedURI, violatedDirective }) => {
      if (blockedURI === new URL(embedURL).origin && violatedDirective === 'frame-src') {
        embeddable = false;
      }
    });
  });
</script>

<div role="none">
  {#if embeddable}
    <VisibilityObserver>
      <iframe
        src={encodeURI(embedURL)}
        title={$_('youtube_video_player')}
        frameborder="0"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </VisibilityObserver>
  {:else}
    <a href={encodeURI(url)}>{url}</a>
  {/if}
</div>

<style lang="scss">
  iframe {
    display: block;
    margin: 0 auto;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }
</style>
