import { isURL } from '@sveltia/utils/string';

/**
 * Check if the given string is a YouTube video URL.
 * @param {string} string URL-like string.
 * @returns {boolean} Result.
 */
export const isYouTubeVideoURL = (string) => {
  if (!isURL(string)) {
    return false;
  }

  const { origin, pathname, searchParams } = new URL(string);

  if (
    (origin === 'https://www.youtube.com' || origin === 'https://www.youtube-nocookie.com') &&
    ((pathname === '/watch' && searchParams.has('v')) ||
      (pathname === '/playlist' && searchParams.has('list')) ||
      pathname.startsWith('/embed/'))
  ) {
    return true;
  }

  if (origin === 'https://youtu.be' && !!pathname) {
    return true;
  }

  return false;
};

/**
 * Get an embeddable YouTube video URL from the given string.
 * @param {string} string URL-like string.
 * @returns {string} URL with privacy-enhanced mode enabled.
 */
export const getYouTubeEmbedURL = (string) => {
  const origin = 'https://www.youtube-nocookie.com';
  const { pathname, search, searchParams } = new URL(string);

  if (pathname === '/watch') {
    const params = new URLSearchParams(searchParams);
    let src = `${origin}/embed/${params.get('v')}`;

    if (params.get('list')) {
      params.delete('v');
      params.set('listType', 'playlist');
      src += `?${params.toString()}`;
    }

    return src;
  }

  if (pathname === '/playlist') {
    return `${origin}/embed/videoseries${search}`;
  }

  if (pathname.startsWith('/embed/')) {
    return `${origin}${pathname}${search}`;
  }

  // https://youtu.be
  return `${origin}/embed${pathname}${search}`;
};
