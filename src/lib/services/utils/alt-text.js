/**
 * Generate a default alt text from a filename or URL.
 * @param {string | undefined} input A filename or URL.
 * @returns {string} A human-readable alt text.
 */
export const generateAltText = (input) => {
  if (!input) return '';

  // Extract filename from URL or path
  const filename = input.split('/').pop()?.split('\\').pop() ?? input;
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Replace hyphens, underscores, and dots with spaces
  const withSpaces = nameWithoutExt.replace(/[-_.]/g, ' ');
  // Split by whitespace, capitalize first letter of first word, and join
  const words = withSpaces.split(/\s+/);

  if (words.length === 0) return '';

  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
};
