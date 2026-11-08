import { describe, expect, test, vi } from 'vitest';

import { getPendingUploadAction } from './pending-uploads';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 */

/**
 * Create a cloud storage service entry.
 * @param {string} serviceId Service ID.
 * @param {boolean} [canUpload] Whether the service supports uploads.
 * @returns {[string, MediaLibraryService]} Entry.
 */
const createEntry = (serviceId, canUpload = true) => [
  serviceId,
  /** @type {MediaLibraryService} */ ({
    serviceId,
    serviceLabel: serviceId,
    ...(canUpload ? { upload: vi.fn() } : {}),
  }),
];

const cloudinary = createEntry('cloudinary', false);
const s3 = createEntry('aws-s3');
const r2 = createEntry('cloudflare-r2');

describe('getPendingUploadAction()', () => {
  const base = {
    open: true,
    pendingFileCount: 1,
    libraryName: 'aws-s3',
    cloudServiceEntries: [cloudinary, s3, r2],
    canUpload: true,
  };

  test('waits with no pending files', () => {
    expect(getPendingUploadAction({ ...base, pendingFileCount: 0 })).toEqual({ type: 'wait' });
    expect(getPendingUploadAction({ ...base, pendingFileCount: 0, libraryName: 'picsum' })).toEqual(
      { type: 'wait' },
    );
  });

  test('uploads once the selected cloud service can take the files', () => {
    expect(getPendingUploadAction(base)).toEqual({ type: 'upload' });
    // The dialog doesn’t have to be open
    expect(getPendingUploadAction({ ...base, open: false })).toEqual({ type: 'upload' });
  });

  test('waits for the credentials of the selected cloud service', () => {
    expect(getPendingUploadAction({ ...base, canUpload: false })).toEqual({ type: 'wait' });
  });

  test('waits for the dialog to open before switching or rejecting', () => {
    expect(
      getPendingUploadAction({ ...base, open: false, libraryName: 'picsum', canUpload: false }),
    ).toEqual({ type: 'wait' });
    expect(
      getPendingUploadAction({
        ...base,
        open: false,
        libraryName: 'cloudinary',
        cloudServiceEntries: [cloudinary],
        canUpload: false,
      }),
    ).toEqual({ type: 'wait' });
  });

  test('switches to the first cloud service that can upload', () => {
    // From a stock photo service
    expect(getPendingUploadAction({ ...base, libraryName: 'picsum', canUpload: false })).toEqual({
      type: 'switch',
      serviceId: 'aws-s3',
    });
    // From Cloudinary, which only takes files through its own widget
    expect(
      getPendingUploadAction({ ...base, libraryName: 'cloudinary', canUpload: false }),
    ).toEqual({ type: 'switch', serviceId: 'aws-s3' });
    // A stock photo service panel can’t upload, even if it says so
    expect(
      getPendingUploadAction({
        ...base,
        libraryName: 'picsum',
        cloudServiceEntries: [r2],
        canUpload: true,
      }),
    ).toEqual({ type: 'switch', serviceId: 'cloudflare-r2' });
  });

  test('rejects the files when no cloud service can upload', () => {
    expect(
      getPendingUploadAction({
        ...base,
        libraryName: 'picsum',
        cloudServiceEntries: [],
        canUpload: false,
      }),
    ).toEqual({ type: 'reject' });
    expect(
      getPendingUploadAction({
        ...base,
        libraryName: 'cloudinary',
        cloudServiceEntries: [cloudinary],
        canUpload: false,
      }),
    ).toEqual({ type: 'reject' });
  });
});
