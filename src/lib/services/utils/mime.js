import { Mime } from 'mime/lite';
import standardTypes from 'mime/types/standard.js';
import otherTypes from 'virtual:mime-other-types';

/**
 * Media type lookup, with the standard types and the vendor and experimental types the CMS can
 * tell apart: images, videos, audio and text files, and the documents it lists as such, e.g.
 * `.ico`, `.mkv`, `.flac` or `.docx`. The full table of the `mime` package holds hundreds of others
 * the CMS has no use for, so the `bundleMimeTypes` Vite plugin picks these out at build time.
 */
export default new Mime(standardTypes, otherTypes)._freeze();
