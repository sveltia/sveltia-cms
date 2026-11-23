/**
 * Version of the password derivation implemented here. The service announces the one it expects in
 * `/version`, and signing in is refused if they differ.
 */
export const KDF_VERSION = 'v1';

/**
 * PBKDF2 iterations, OWASP’s recommendation for PBKDF2-HMAC-SHA-256.
 */
export const KDF_ITERATIONS = 600_000;

/**
 * Derive the prehash sent to Sveltia CMS Additions in place of the password, so the password never
 * leaves the browser. The slow part runs here and the service only hashes the result once more.
 * This must match the service’s reference implementation byte for byte; both are tested against
 * the same vectors.
 * @param {object} args Arguments.
 * @param {string} args.siteId Site ID from the service’s `/version`.
 * @param {string} args.username Username. It’s lower-cased.
 * @param {string} args.password Password, exactly as typed. It’s normalized to NFC.
 * @param {number} [args.iterations] PBKDF2 iterations. Only tests change it.
 * @returns {Promise<string>} 256 bits as base64url without padding: always 43 characters.
 * @see https://github.com/sveltia/sveltia-cms-additions/blob/main/docs/kdf-test-vectors.json
 */
export const derivePrehash = async ({
  siteId,
  username,
  password,
  iterations = KDF_ITERATIONS,
}) => {
  const encoder = new TextEncoder();

  const salt = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`sveltia-cms-additions:${siteId}:${username.toLowerCase()}`),
  );

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );

  return new Uint8Array(bits).toBase64({ alphabet: 'base64url', omitPadding: true });
};
