/**
 * @import { MediaLibraryService } from '$lib/types/private';
 */

/**
 * @typedef {{ type: 'wait' } | { type: 'upload' } | { type: 'reject' } | {
 * type: 'switch', serviceId: string }} PendingUploadAction
 */

/**
 * Decide what to do with the files waiting to be uploaded to a cloud storage service, typically
 * dropped on a File field when only such a service is available, and passed to the Select Assets
 * dialog. They go up once the panel of the selected service can take them, which may only be after
 * the user has provided the credentials. The dialog stays mounted while closed, so the location
 * offered first was picked before the files were dropped, and may be a stock photo service: once
 * the dialog opens, another service that can take them is selected, or, if there is none, e.g. with
 * only Cloudinary, the files are rejected so the user can be told rather than leave them out
 * silently.
 * @param {object} args Arguments.
 * @param {boolean} args.open Whether the dialog is open.
 * @param {number} args.pendingFileCount Number of files waiting to be uploaded.
 * @param {string} args.libraryName Name of the selected location.
 * @param {[string, MediaLibraryService][]} args.cloudServiceEntries Cloud storage services offered.
 * @param {boolean} args.canUpload Whether the panel of the selected service can upload files now.
 * @returns {PendingUploadAction} Action to take: `upload` the files to the selected service,
 * `switch` to another service, `reject` the files, or `wait` for the dialog to open or for the
 * credentials, or with nothing to upload.
 */
export const getPendingUploadAction = ({
  open,
  pendingFileCount,
  libraryName,
  cloudServiceEntries,
  canUpload,
}) => {
  if (!pendingFileCount) {
    return { type: 'wait' };
  }

  const service = cloudServiceEntries.find(([serviceId]) => serviceId === libraryName)?.[1];

  if (service && canUpload) {
    return { type: 'upload' };
  }

  // The selected service can take the files once the user has provided the credentials
  if (!open || !!service?.upload) {
    return { type: 'wait' };
  }

  // Cloudinary, for one, only takes files through its own widget
  const [serviceId] = cloudServiceEntries.find(([, { upload }]) => !!upload) ?? [];

  return serviceId ? { type: 'switch', serviceId } : { type: 'reject' };
};
