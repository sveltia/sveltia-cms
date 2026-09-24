/**
 * Stand-in for `pdf.js` in the npm build, which doesn’t generate PDF thumbnails, so PDF.js is
 * neither loaded from a CDN nor bundled: it comes with hundreds of files for character maps, fonts
 * and image decoders. `hasPDFThumbnail()` keeps this from being called.
 * @returns {Promise<Blob>} Never resolves.
 * @throws {Error} Always.
 */
export const renderPDF = async () => {
  throw new Error('PDF thumbnails aren’t supported in the npm build');
};
