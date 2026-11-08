import { describe, expect, it } from 'vitest';

import { DOC_EXTENSION_REGEX } from '$lib/services/assets/kinds';
import mime from '$lib/services/utils/mime';

describe('mime', () => {
  it('knows the standard types', () => {
    expect(mime.getType('photo.jpg')).toBe('image/jpeg');
    expect(mime.getType('notes.md')).toBe('text/markdown');
    expect(mime.getExtension('image/png')).toBe('png');
  });

  it('knows the vendor types of media, text and documents', () => {
    expect(mime.getType('favicon.ico')).toBe('image/vnd.microsoft.icon');
    expect(mime.getType('movie.mkv')).toBe('video/x-matroska');
    expect(mime.getType('song.flac')).toBe('audio/x-flac');
    expect(mime.getType('main.c')).toBe('text/x-c');
    expect(mime.getType('report.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('knows the type of every document the asset library lists as such', () => {
    // The extensions are copied from `DOC_EXTENSION_REGEX` into the `bundleMimeTypes` Vite plugin
    const extensions = DOC_EXTENSION_REGEX.source
      .match(/\(\?:(.+?)\)/)?.[1]
      .split('|')
      .flatMap((ext) => (ext.endsWith('?') ? [ext.slice(0, -2), ext.slice(0, -1)] : [ext]));

    expect(extensions).toContain('docx');
    extensions?.forEach((ext) => {
      expect(mime.getType(`file.${ext}`), ext).not.toBeNull();
    });
  });

  it('leaves out the other vendor types', () => {
    expect(mime.getType('app.apk')).toBeNull();
    expect(mime.getType('archive.7z')).toBeNull();
  });
});
