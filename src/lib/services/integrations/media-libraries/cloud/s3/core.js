import { getHash } from '@sveltia/utils/crypto';

import { getAssetKind } from '$lib/services/assets/kinds';
import {
  encodeKey as encodeKeyPath,
  getFileKey,
  getFolderKey,
  getRelativeKey,
} from '$lib/services/integrations/media-libraries/cloud/shared/keys';
import {
  assertResponseOK,
  createObjectStorageOperations,
  deleteObjects,
} from '$lib/services/integrations/media-libraries/cloud/shared/object-storage';
import { hmacSha256, toHex } from '$lib/services/utils/crypto';
import { parseXml, toArray } from '$lib/services/utils/xml';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * S3Config,
 * } from '$lib/types/private';
 * @import {
 * ObjectStorageProvider,
 * } from '$lib/services/integrations/media-libraries/cloud/shared/object-storage';
 * @import {
 * ObjectStorageOperations,
 * } from '$lib/services/integrations/media-libraries/cloud/shared/service';
 */

/**
 * @typedef {object} S3Object
 * @property {string} Key Object key (file path).
 * @property {string} LastModified Last modified timestamp.
 * @property {string} ETag ETag.
 * @property {number} Size File size in bytes.
 * @property {string} [ContentType] Content type.
 */

/**
 * @typedef {object} S3ListResponse
 * @property {S3Object[]} Contents List of objects.
 * @property {boolean} IsTruncated Whether more results are available.
 * @property {string} [NextContinuationToken] Token for next page.
 */

/**
 * Percent-encode a string as RFC 3986 requires. Unlike `encodeURIComponent()`, the characters
 * `!'()*` are encoded as well, because Signature Version 4 requires every character other than the
 * unreserved ones to be encoded in the canonical URI and query string.
 * @param {string} str String to encode.
 * @returns {string} Encoded string.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */
const encodeRfc3986 = (str) =>
  encodeURIComponent(str).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Generate AWS Signature Version 4.
 * @param {object} params Parameters.
 * @param {string} params.method HTTP method.
 * @param {string} params.url Request URL.
 * @param {Record<string, string>} params.headers Request headers.
 * @param {string} params.payloadHash SHA-256 hash of the request payload.
 * @param {string} params.accessKeyId AWS access key ID.
 * @param {string} params.secretAccessKey AWS secret access key.
 * @param {string} params.region AWS region.
 * @param {string} params.service AWS service name (e.g., 's3').
 * @param {Date} params.date Request date.
 * @returns {Promise<string>} Authorization header value.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html
 */
export const generateAwsSignature = async ({
  method,
  url,
  headers,
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region,
  service,
  date,
}) => {
  const urlObj = new URL(url);
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  // Create canonical request
  const canonicalUri = urlObj.pathname;

  const canonicalQueryString = [...urlObj.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalHeaders = Object.entries(headers)
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
    .sort()
    .join('\n');

  const signedHeaders = Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort()
    .join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await getHash(canonicalRequest, { algorithm: 'SHA-256' });
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');
  // Calculate signature
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureHex = toHex(await hmacSha256(kSigning, stringToSign));

  return [
    `${algorithm} Credential=${accessKeyId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders}, Signature=${signatureHex}`,
  ].join(' ');
};

/**
 * Make a signed S3 API request.
 * @param {object} params Parameters.
 * @param {string} params.method HTTP method.
 * @param {string} params.url Request URL.
 * @param {S3Config} params.config S3 configuration.
 * @param {string} params.secretAccessKey AWS secret access key.
 * @param {string | ArrayBuffer} [params.body] Request body.
 * @param {Record<string, string>} [params.extraHeaders] Additional headers.
 * @returns {Promise<Response>} Response.
 */
export const signedRequest = async ({
  method,
  url,
  config,
  secretAccessKey,
  body = '',
  extraHeaders = {},
}) => {
  const { access_key_id: accessKeyId, region = 'us-east-1' } = config;

  if (!accessKeyId) {
    throw new Error('S3 access key ID is required');
  }

  const date = new Date();
  const urlObj = new URL(url);
  const payloadHash = await getHash(body, { algorithm: 'SHA-256' });

  const headers = {
    Host: urlObj.host,
    'x-amz-date': date.toISOString().replace(/[:-]|\.\d{3}/g, ''),
    'x-amz-content-sha256': payloadHash,
    ...extraHeaders,
  };

  const authorization = await generateAwsSignature({
    method,
    url,
    headers,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    region,
    service: 's3',
    date,
  });

  return fetch(url, {
    method,
    headers: { ...headers, Authorization: authorization },
    ...(body && { body }),
  });
};

/**
 * Build base URL for S3 object.
 * @param {object} params Parameters.
 * @param {string} params.bucket Bucket name.
 * @param {string} params.key Object key.
 * @param {string} [params.endpoint] Custom endpoint.
 * @param {string} [params.region] AWS region.
 * @param {boolean} [params.forcePathStyle] Use path-style URLs.
 * @param {string} [params.publicUrl] Base URL for public access (overrides endpoint for asset
 * URLs). Used for Cloudflare R2 r2.dev or custom domain URLs.
 * @returns {string} Base URL.
 */
export const buildObjectUrl = ({ bucket, key, endpoint, region, forcePathStyle, publicUrl }) => {
  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, '')}/${key}`;
  }

  if (endpoint) {
    return `${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
  }

  if (forcePathStyle) {
    return `https://s3.${region}.amazonaws.com/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

/**
 * Whether the given URL points to an object in the configured bucket, through either the public
 * URL or the API endpoint.
 * @param {S3Config} config S3 configuration.
 * @param {string} url URL.
 * @returns {boolean} Result.
 */
export const isS3ObjectUrl = (config, url) => {
  const {
    bucket,
    region,
    endpoint,
    force_path_style: forcePathStyle,
    public_url: publicUrl,
  } = config;

  return [
    buildObjectUrl({ bucket, key: '', endpoint, region, forcePathStyle, publicUrl }),
    buildObjectUrl({ bucket, key: '', endpoint, region, forcePathStyle }),
  ].some((base) => url.startsWith(base));
};

/**
 * Percent-encode an object key for use in a request URL or the `x-amz-copy-source` header, keeping
 * the path separators intact. Unlike `encodeURIComponent()`, the characters `!'()*` are encoded as
 * well, because Signature Version 4 requires every character other than the unreserved ones to be
 * encoded in the canonical URI.
 * @param {string} key Object key.
 * @returns {string} Encoded key.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */
export const encodeKey = (key) => encodeKeyPath(key, encodeRfc3986);

/**
 * Build the API endpoint URL of an object, which is where the object is read, written and deleted.
 * Unlike {@link buildObjectUrl}, this never uses `public_url`, because a CDN or custom domain in
 * front of the bucket doesn’t accept signed API requests. The key is percent-encoded, so a key
 * containing `#` or `?` is not cut short by the URL parser, and the signed path matches the
 * request.
 * @param {S3Config} config S3 configuration.
 * @param {string} key Object key.
 * @returns {string} Object URL.
 */
export const buildObjectApiUrl = (config, key) => {
  const { bucket, region, endpoint, force_path_style: forcePathStyle } = config;

  return buildObjectUrl({ bucket, key: encodeKey(key), endpoint, region, forcePathStyle });
};

/**
 * Get the ACL header for a new object, if the service needs one to make it publicly readable.
 * @param {S3Config} config S3 configuration.
 * @returns {Record<string, string>} Header, or an empty object.
 */
const getAclHeader = ({ acl }) => (acl ? { 'x-amz-acl': acl } : {});

/**
 * Get the secret access key from the given fetch options.
 * @param {MediaLibraryFetchOptions} options Fetch options.
 * @returns {string} Secret access key.
 * @throws {Error} When no key was provided.
 */
const requireSecretAccessKey = ({ apiKey: secretAccessKey }) => {
  if (!secretAccessKey) {
    throw new Error('S3 secret access key is required');
  }

  return secretAccessKey;
};

/**
 * Parse S3 list response into ExternalAsset format.
 * @param {S3Object[]} objects S3 objects.
 * @param {S3Config} config S3 configuration.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseS3Results = (objects, config) => {
  const {
    bucket,
    region,
    endpoint,
    force_path_style: forcePathStyle,
    public_url: publicUrl,
  } = config;

  return objects.map((obj) => {
    const key = obj.Key;
    const fileName = key.split('/').pop() || key;
    const displayKey = getRelativeKey(config, key);

    const baseUrl = buildObjectUrl({
      bucket,
      key: encodeKey(key),
      endpoint,
      region,
      forcePathStyle,
      publicUrl,
    });

    return {
      id: key,
      description: displayKey,
      previewURL: baseUrl,
      downloadURL: baseUrl,
      fileName,
      lastModified: new Date(obj.LastModified),
      size: Number(obj.Size),
      kind: getAssetKind(key),
    };
  });
};

/**
 * Fetch a page of the objects under the given prefix from S3-compatible storage.
 * @param {object} params Parameters.
 * @param {S3Config} params.config S3 configuration.
 * @param {string} params.credential Secret access key.
 * @param {string} params.prefix Key prefix.
 * @param {string} [params.cursor] Continuation token of the page.
 * @returns {Promise<{ items: S3Object[], cursor?: string }>} Objects and the continuation token of
 * the next page, if any.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
 */
const listS3Page = async ({ config, credential: secretAccessKey, prefix, cursor }) => {
  const { bucket, region, endpoint, force_path_style: forcePathStyle } = config;

  const params = new URLSearchParams({
    'list-type': '2',
    'max-keys': '1000',
    ...(prefix && { prefix }),
    ...(cursor && { 'continuation-token': cursor }),
  });

  const url = endpoint
    ? `${endpoint.replace(/\/+$/, '')}/${bucket}?${params}`
    : forcePathStyle
      ? `https://s3.${region}.amazonaws.com/${bucket}?${params}`
      : `https://${bucket}.s3.${region}.amazonaws.com/?${params}`;

  const response = await signedRequest({ method: 'GET', url, config, secretAccessKey });

  await assertResponseOK(response, 'Failed to list objects');

  /** @type {any} */
  const data = parseXml(await response.text());

  return {
    items: toArray(data.Contents),
    cursor: (data.IsTruncated === 'true' && data.NextContinuationToken) || undefined,
  };
};

/**
 * Upload a single file to S3-compatible storage under the given key, overwriting any existing
 * object with the same key.
 * @param {object} params Parameters.
 * @param {string} params.key Object key.
 * @param {File} params.file File to upload.
 * @param {S3Config} params.config S3 configuration.
 * @param {string} params.credential Secret access key.
 * @returns {Promise<S3Object>} Uploaded object.
 */
const putS3Object = async ({ key, file, config, credential: secretAccessKey }) => {
  const fileContent = await file.arrayBuffer();

  const response = await signedRequest({
    method: 'PUT',
    url: buildObjectApiUrl(config, key),
    config,
    secretAccessKey,
    body: fileContent,
    extraHeaders: {
      'Content-Type': file.type || 'application/octet-stream',
      ...getAclHeader(config),
    },
  });

  await assertResponseOK(response, `Failed to upload file ${file.name}`);

  return {
    Key: key,
    LastModified: new Date().toISOString(),
    ETag: '',
    Size: file.size,
    ContentType: file.type,
  };
};

/**
 * Delete a single object from S3-compatible storage. Objects are deleted one by one, as the
 * multi-object delete API requires a `Content-MD5` header, which some S3-compatible services don’t
 * support. The bucket’s CORS policy must allow the `DELETE` method, in addition to the `GET` and
 * `PUT` methods needed for listing and uploading; otherwise the browser blocks the request at the
 * preflight stage.
 * @param {object} params Parameters.
 * @param {string} params.key Object key.
 * @param {S3Config} params.config S3 configuration.
 * @param {string} params.credential Secret access key.
 * @returns {Promise<void>}
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html
 */
const deleteS3Object = async ({ key, config, credential: secretAccessKey }) => {
  const response = await signedRequest({
    method: 'DELETE',
    url: buildObjectApiUrl(config, key),
    config,
    secretAccessKey,
  });

  await assertResponseOK(response, `Failed to delete object ${key}`);
};

/**
 * S3 API calls for the operations shared with the other object storage services.
 * @type {ObjectStorageProvider<S3Object, S3Config>}
 */
const provider = {
  requireCredential: requireSecretAccessKey,
  listPage: listS3Page,
  /**
   * Get the key of an object.
   * @param {S3Object} object Object.
   * @returns {string} Key.
   */
  getKey: ({ Key }) => Key,
  /**
   * Convert objects into the `ExternalAsset` format. S3 URLs carry no credential.
   * @param {S3Object[]} objects Objects.
   * @param {S3Config} config S3 configuration.
   * @returns {ExternalAsset[]} Assets.
   */
  parseResults: (objects, config) => parseS3Results(objects, config),
  putObject: putS3Object,
  deleteObject: deleteS3Object,
};

/**
 * Move an object on S3-compatible storage to another path. S3 has no move operation, so the object
 * is copied to the new key and then the original is deleted. The bucket’s CORS policy must allow
 * the `PUT` and `DELETE` methods as well as the `x-amz-copy-source` and `x-amz-metadata-directive`
 * headers (an `AllowedHeaders` of `*` is the simplest); otherwise the browser blocks the request at
 * the preflight stage.
 * @param {ExternalAsset} asset Asset to move. Its `id` is the object key.
 * @param {string} newPath New path relative to the configured prefix.
 * @param {S3Config} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @returns {Promise<ExternalAsset>} Moved asset.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html
 */
export const moveS3Object = async (asset, newPath, config, options) => {
  const { bucket } = config;
  const secretAccessKey = requireSecretAccessKey(options);
  const { id: key, size = 0 } = asset;
  const newKey = getFileKey(config, newPath);

  const response = await signedRequest({
    method: 'PUT',
    url: buildObjectApiUrl(config, newKey),
    config,
    secretAccessKey,
    extraHeaders: {
      'x-amz-copy-source': `/${bucket}/${encodeKey(key)}`,
      'x-amz-metadata-directive': 'COPY',
      ...getAclHeader(config),
    },
  });

  await assertResponseOK(response, `Failed to copy object ${key}`);

  await deleteS3Object({ key, config, credential: secretAccessKey });

  return parseS3Results(
    [{ Key: newKey, LastModified: new Date().toISOString(), ETag: '', Size: size }],
    config,
  )[0];
};

/**
 * Create an empty folder on S3-compatible storage by putting a zero-byte placeholder object at the
 * folder key, the way the AWS console does.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {S3Config} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @returns {Promise<void>}
 */
export const createS3Folder = async (dirPath, config, options) => {
  const secretAccessKey = requireSecretAccessKey(options);
  const key = getFolderKey(config, dirPath);

  const response = await signedRequest({
    method: 'PUT',
    url: buildObjectApiUrl(config, key),
    config,
    secretAccessKey,
    extraHeaders: { 'Content-Type': 'application/x-directory', ...getAclHeader(config) },
  });

  await assertResponseOK(response, `Failed to create folder ${key}`);

  return undefined;
};

/**
 * Remove the placeholder object of a folder on S3-compatible storage. S3 reports success for a key
 * that doesn’t exist, so a folder that has no placeholder is fine.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @param {S3Config} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @returns {Promise<void>}
 */
export const deleteS3Folder = async (dirPath, config, options) =>
  deleteObjects(
    provider,
    [/** @type {ExternalAsset} */ ({ id: getFolderKey(config, dirPath) })],
    config,
    options,
  );

/**
 * Operations of an S3-compatible object storage service.
 * @type {ObjectStorageOperations<S3Config>}
 */
export const s3Operations = createObjectStorageOperations(provider, {
  move: moveS3Object,
  createFolder: createS3Folder,
  deleteFolder: deleteS3Folder,
});
