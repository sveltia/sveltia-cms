import { createPNG } from '../files.js';

/**
 * A site with several media folders: the global one, used by a collection of notes with image and
 * file fields; a collection of projects with its own media folder; and a collection of posts that
 * keep their images next to the entry file (`media_folder: ''`) and require a cover image.
 */
export const MEDIA_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
        { name: 'attachment', label: 'Attachment', widget: 'file', required: false },
        { name: 'gallery', label: 'Gallery', widget: 'image', multiple: true, required: false },
      ],
    },
    {
      name: 'projects',
      label: 'Projects',
      label_singular: 'Project',
      folder: 'content/projects',
      create: true,
      media_folder: '/static/projects',
      public_folder: '/projects',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'image', label: 'Image', widget: 'image', required: false },
      ],
    },
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      path: '{{slug}}/index',
      create: true,
      media_folder: '',
      public_folder: '',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image' },
      ],
    },
  ],
};

/**
 * Images in {@link MEDIA_FILES}, each with its own color so the CMS doesn’t merge them.
 */
export const MEDIA_IMAGES = {
  sunset: createPNG({ color: [255, 128, 0] }),
  forest: createPNG({ color: [0, 128, 0] }),
  ocean: createPNG({ color: [0, 64, 255] }),
  bridge: createPNG({ color: [128, 128, 128] }),
  hero: createPNG({ color: [255, 0, 128] }),
};

/**
 * Repository files matching {@link MEDIA_CONFIG}, for `cms.seed()`. `sunset.png` is used by the
 * “Evening” note, the other global images by nothing.
 */
export const MEDIA_FILES = {
  'static/uploads/sunset.png': MEDIA_IMAGES.sunset,
  'static/uploads/forest.png': MEDIA_IMAGES.forest,
  'static/uploads/ocean.png': MEDIA_IMAGES.ocean,
  'static/uploads/guide.txt': 'Read me first.\n',
  'static/projects/bridge.png': MEDIA_IMAGES.bridge,
  'content/notes/evening.md': '---\ntitle: Evening\ncover: /uploads/sunset.png\n---\n',
  'content/projects/bridge.md': '---\ntitle: Bridge\nimage: /projects/bridge.png\n---\n',
  'content/posts/hello/index.md': '---\ntitle: Hello\ncover: hero.png\n---\n',
  'content/posts/hello/hero.png': MEDIA_IMAGES.hero,
};
