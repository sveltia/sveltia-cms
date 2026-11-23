<!--
  @component
  A person’s avatar: their picture, if there’s one, or else their initials. It’s decorative, as the
  name is always given next to it, or in a label around it.
-->
<script>
  import { getInitials } from '$lib/services/utils/name';

  /**
   * @typedef {object} Props
   * @property {string} [name] Name of the person, whose initials are shown.
   * @property {string} [username] Username of the person, whose initials are shown if the name has
   * no letters, e.g. one made of emoji.
   * @property {string} [text] Text to show instead of initials, e.g. `+2` for people left out of a
   * list, which is shown in a neutral color.
   * @property {string} [src] URL of their picture. The initials are shown if it can’t be loaded.
   * @property {number} [size] Width and height in pixels.
   * @property {string} [class] Class name to add, e.g. to place the avatar.
   */

  /** @type {Props} */
  let {
    name = '',
    username = '',
    text = undefined,
    src = undefined,
    size = 24,
    class: className = undefined,
  } = $props();

  /** URL of a picture that couldn’t be loaded. */
  let brokenSrc = $state();
</script>

{#if src && src !== brokenSrc}
  <img
    class={['avatar', className]}
    {src}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    onerror={() => {
      brokenSrc = src;
    }}
  />
{:else}
  <span
    class={['avatar', 'initials', text !== undefined && 'neutral', className]}
    style:--size="{size}px"
    aria-hidden="true"
  >
    {text ?? getInitials(name, username)}
  </span>
{/if}

<style>
  .avatar {
    flex: none;
    border-radius: 50%;
  }

  .initials {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: var(--size);
    height: var(--size);
    background-color: var(--sui-info-background-color);
    color: var(--sui-info-foreground-color);
    font-size: calc(var(--size) * 0.42);
    font-weight: var(--sui-font-weight-bold);
    line-height: 1;

    &.neutral {
      background-color: var(--sui-secondary-background-color);
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
