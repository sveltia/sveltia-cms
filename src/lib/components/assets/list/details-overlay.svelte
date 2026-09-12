<!--
  @component
  Full-screen overlay showing an asset’s details, shared by repository assets and assets on
  external locations: a toolbar with the back button, title, previous/next buttons, action buttons
  and edit options menu, the preview and the info panel. On small screens, the action buttons move
  into the edit options menu, so they are rendered with `useButton` set to `false` there.

  The overlay is usually opened from a list of assets, so the user can move between the listed
  assets with the previous/next buttons, the left/right arrow keys, or a horizontal swipe on a touch
  screen.
-->
<script>
  import { _, isRTL } from '@sveltia/i18n';
  import { Button, Icon, Toolbar, TruncatedText } from '@sveltia/ui';
  import { tick } from 'svelte';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [title] Asset name.
   * @property {string} [contentKey] Value that identifies the shown asset; the content is
   * re-rendered when it changes.
   * @property {() => void} onBack Called when the back button is clicked or Escape is pressed.
   * @property {() => void} [onPrevious] Called when the user moves to the previous asset with the
   * button, the arrow key or a swipe. Omit it when there is no previous asset.
   * @property {() => void} [onNext] Called when the user moves to the next asset with the button,
   * the arrow key or a swipe. Omit it when there is no next asset.
   * @property {Snippet<[boolean]>} actions Action buttons, given whether to render them as buttons
   * (`true`) or as menu items (`false`).
   * @property {Snippet<[Snippet]>} editOptions Edit options menu button, given the snippet of extra
   * menu items to be placed at the top of the menu.
   * @property {Snippet} preview Preview of the asset, or a not-found message.
   * @property {Snippet} [info] Info panel.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title = undefined,
    contentKey = undefined,
    onBack,
    onPrevious = undefined,
    onNext = undefined,
    actions,
    editOptions,
    preview,
    info = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Minimum horizontal travel of a touch, in pixels, to count as a swipe rather than a tap.
   */
  const SWIPE_MIN_DISTANCE = 50;

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();

  /**
   * Where the current touch started, or `undefined` while nothing is touching the screen.
   * @type {{ x: number, y: number } | undefined}
   */
  let touchStart;

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    if (wrapper) {
      wrapper.tabIndex = 0;
      wrapper.focus();
    }
  };

  $effect(() => {
    if (wrapper) {
      if (showAssetOverlay.current) {
        moveFocus();
      }
    }
  });

  /**
   * Elements that use the arrow keys themselves, e.g. to move the caret or to seek in a video, and
   * composite widgets that move the focus between their children with the keys.
   */
  const ARROW_KEY_USER_SELECTOR = [
    'input',
    'textarea',
    'select',
    'audio',
    'video',
    '[role="grid"]',
    '[role="listbox"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="radiogroup"]',
    '[role="slider"]',
    '[role="tablist"]',
  ].join(', ');

  /**
   * Move to the previous asset with the left arrow key and to the next asset with the right arrow
   * key, or the other way around in a right-to-left locale. Key presses outside the overlay, e.g.
   * in a dialog, and those that mean something else where the focus is are left alone.
   * @param {KeyboardEvent} event `keydown` event.
   */
  const onKeyDown = (event) => {
    const { key, ctrlKey, metaKey, altKey, shiftKey, target } = event;

    if (!['ArrowLeft', 'ArrowRight'].includes(key) || ctrlKey || metaKey || altKey || shiftKey) {
      return;
    }

    // The focus lands on the body when the focused button gets disabled at the end of the list
    if (
      !(target instanceof HTMLElement) ||
      !(target === document.body || wrapper?.contains(target)) ||
      target.isContentEditable ||
      target.closest(ARROW_KEY_USER_SELECTOR)
    ) {
      return;
    }

    const handler = key === (isRTL() ? 'ArrowRight' : 'ArrowLeft') ? onPrevious : onNext;

    if (handler) {
      event.preventDefault();
      handler();
    }
  };

  /**
   * Elements that are dragged sideways themselves, e.g. the timeline and volume controls of a media
   * player, so a touch on them is never a swipe.
   */
  const SWIPE_USER_SELECTOR = 'audio, video, input, [role="slider"]';

  /**
   * Remember where a touch started to detect a swipe later.
   * @param {TouchEvent} event `touchstart` event.
   */
  const onTouchStart = ({ touches, target }) => {
    const { clientX: x, clientY: y } = touches[0];

    touchStart =
      target instanceof Element && target.closest(SWIPE_USER_SELECTOR) ? undefined : { x, y };
  };

  /**
   * Move to the previous asset with a swipe towards the end of the line, and to the next asset with
   * a swipe towards the start, as if the assets were laid out in a row. A mostly vertical move is a
   * scroll, not a swipe.
   * @param {TouchEvent} event `touchend` event.
   */
  const onTouchEnd = ({ changedTouches }) => {
    if (!touchStart) {
      return;
    }

    const { clientX, clientY } = changedTouches[0];
    const dx = clientX - touchStart.x;
    const dy = clientY - touchStart.y;

    touchStart = undefined;

    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    const handler = (isRTL() ? dx < 0 : dx > 0) ? onPrevious : onNext;

    handler?.();
  };
</script>

<svelte:window onkeydown={onKeyDown} />

{#snippet overflowItems()}
  {#if env.isSmallScreen}
    {@render actions(false)}
  {/if}
{/snippet}

<div role="group" class="wrapper" aria-label={_('asset_editor')} bind:this={wrapper}>
  {#key contentKey}
    <Toolbar variant="primary" aria-label={_('primary')}>
      <BackButton aria-label={_('cancel_editing')} useShortcut={true} onclick={onBack} />
      <h2 role="none">
        <TruncatedText>
          <bdi>{title}</bdi>
        </TruncatedText>
      </h2>
      {#if !env.isSmallScreen}
        {@render actions(true)}
      {/if}
      {@render editOptions(overflowItems)}
    </Toolbar>
  {/key}
  <div role="none" class="row" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
    <div role="none" class="main">
      <!-- The preview is remounted for each asset, so the previous/next transition slides it -->
      {#key contentKey}
        <div role="none" class="preview">
          {@render preview()}
        </div>
      {/key}
      <!--
        The navigation buttons stay mounted across assets, so a button keeps the focus while the
        user clicks it repeatedly
      -->
      <Button
        variant="tertiary"
        iconic
        class="nav-button previous"
        aria-label={_('previous_asset')}
        disabled={!onPrevious}
        onclick={() => onPrevious?.()}
      >
        {#snippet startIcon()}
          <Icon name={isRTL() ? 'arrow_forward' : 'arrow_back'} />
        {/snippet}
      </Button>
      <Button
        variant="tertiary"
        iconic
        class="nav-button next"
        aria-label={_('next_asset')}
        disabled={!onNext}
        onclick={() => onNext?.()}
      >
        {#snippet startIcon()}
          <Icon name={isRTL() ? 'arrow_back' : 'arrow_forward'} />
        {/snippet}
      </Button>
    </div>
    {#key contentKey}
      {@render info?.()}
    {/key}
  </div>
</div>

<style>
  @keyframes slide-out-to-left {
    to {
      transform: translateX(-100%);
    }
  }

  @keyframes slide-out-to-right {
    to {
      transform: translateX(100%);
    }
  }

  @keyframes slide-in-from-left {
    from {
      transform: translateX(-100%);
    }
  }

  @keyframes slide-in-from-right {
    from {
      transform: translateX(100%);
    }
  }

  /*
   * Slide the preview sideways when moving between the listed assets, as if they were laid out in
   * a row: the next asset comes in from the end of the line, the previous one from the start. The
   * toolbar, navigation buttons and info panel aren’t part of the transition, so they stay put and
   * the info panel simply dissolves.
   */

  :global {
    html:active-view-transition-type(next),
    html:active-view-transition-type(previous) {
      /* Keep the sliding snapshots within the preview area, off the info panel and the buttons */
      &::view-transition-image-pair(asset-details) {
        overflow: clip;
      }

      &::view-transition-old(asset-details),
      &::view-transition-new(asset-details) {
        animation-duration: 200ms;
        animation-timing-function: ease-out;
        animation-fill-mode: both;

        @media (prefers-reduced-motion) {
          animation: none;
        }
      }
    }

    html:active-view-transition-type(next) {
      &::view-transition-old(asset-details) {
        animation-name: slide-out-to-left;
      }

      &::view-transition-new(asset-details) {
        animation-name: slide-in-from-right;
      }

      &:dir(rtl) {
        &::view-transition-old(asset-details) {
          animation-name: slide-out-to-right;
        }

        &::view-transition-new(asset-details) {
          animation-name: slide-in-from-left;
        }
      }
    }

    html:active-view-transition-type(previous) {
      &::view-transition-old(asset-details) {
        animation-name: slide-out-to-right;
      }

      &::view-transition-new(asset-details) {
        animation-name: slide-in-from-left;
      }

      &:dir(rtl) {
        &::view-transition-old(asset-details) {
          animation-name: slide-out-to-left;
        }

        &::view-transition-new(asset-details) {
          animation-name: slide-in-from-right;
        }
      }
    }
  }

  /*
   * The preview and the navigation buttons are named only for the previous/next transition: the
   * buttons to be layered above the sliding preview, and the preview to slide on its own. During
   * the page transitions, e.g. when the overlay is opened or closed on a small screen, they must
   * stay unnamed to move along with the rest of the page.
   */

  :global(html:is(:active-view-transition-type(next), :active-view-transition-type(previous))) {
    .preview {
      view-transition-name: asset-details;
    }

    .row :global(.nav-button.previous) {
      view-transition-name: asset-nav-previous;
    }

    .row :global(.nav-button.next) {
      view-transition-name: asset-nav-next;
    }
  }

  .wrapper {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--sui-secondary-background-color);

    .row {
      flex: auto;
      display: flex;
      overflow: hidden;

      @media (width < 768px) {
        flex-direction: column;

        .main {
          flex: none;
          aspect-ratio: 1 / 1;
        }

        :global {
          .detail {
            flex: auto;
            width: auto;
          }
        }
      }

      .main {
        position: relative;
        flex: auto;
        display: flex;
        overflow: hidden;
      }

      .preview {
        flex: auto;
        overflow: hidden;

        :global {
          iframe {
            display: block;
            width: 100%;
            height: 100%;
          }
        }
      }

      :global {
        .nav-button {
          position: absolute;
          top: 50%;
          translate: 0 -50%;
          margin: 0;
          border-radius: 50%;
          opacity: 0.5;

          &:hover,
          &:focus-visible {
            opacity: 1;
          }

          &.previous {
            inset-inline-start: 16px;
          }

          &.next {
            inset-inline-end: 16px;
          }
        }

        .detail {
          background-color: var(--sui-primary-background-color);
        }
      }
    }
  }
</style>
