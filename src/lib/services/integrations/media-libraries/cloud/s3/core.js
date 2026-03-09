/* eslint-disable no-await-in-loop */

import { sleep } from '@sveltia/utils/misc';

import { getAssetKind } from '$lib/services/assets/kinds';

/**
 * @import { ExternalAsset, MediaLibraryFetchOptions } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
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
 * Create HMAC signature.
 * @param {string | Uint8Array} key Key.
 * @param {string} data Data to sign.
 * @returns {Promise<Uint8Array>} Signature.
 */
const hmac = async (key, data) => {
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    /** @type {BufferSource} */ (typeof key === 'string' ? encoder.encode(key) : key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));

  return new Uint8Array(signature);
};

/**
 * Create SHA-256 hash.
 * @param {string | ArrayBuffer} data Data to hash.
 * @returns {Promise<string>} Hash.
 */
const sha256 = async (data) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

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
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
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
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');
  // Calculate signature
  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = await hmac(kSigning, stringToSign);

  const signatureHex = Array.from(signature)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

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
 * @param {S3MediaLibrary} params.config S3 configuration.
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
  const date = new Date();
  const urlObj = new URL(url);
  const payloadHash = await sha256(body);

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
 * Parse XML response to JSON.
 * @param {string} xml XML string.
 * @returns {any} Parsed object.
 */
export const parseXml = (xml) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  /**
   * Convert XML node to object.
   * @param {Element} node XML node.
   * @returns {any} Object.
   */
  const nodeToObject = (node) => {
    if (node.children.length === 0) {
      return node.textContent;
    }

    /** @type {Record<string, any>} */
    const obj = {};

    Array.from(node.children).forEach((child) => {
      const key = child.tagName;
      const value = nodeToObject(child);

      if (obj[key]) {
        if (Array.isArray(obj[key])) {
          obj[key].push(value);
        } else {
          obj[key] = [obj[key], value];
        }
      } else {
        obj[key] = value;
      }
    });

    return obj;
  };

  return nodeToObject(doc.documentElement);
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
    return `${publicUrl}/${key}`;
  }

  if (endpoint) {
    return `${endpoint}/${bucket}/${key}`;
  }

  if (forcePathStyle) {
    return `https://s3.${region}.amazonaws.com/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

/**
 * Parse S3 list response into ExternalAsset format.
 * @param {S3Object[]} objects S3 objects.
 * @param {S3MediaLibrary} config S3 configuration.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseS3Results = (objects, config) => {
  const {
    bucket,
    region,
    endpoint,
    force_path_style: forcePathStyle,
    prefix = '',
    public_url: publicUrl,
  } = config;

  return objects.map((obj) => {
    const key = obj.Key;
    const fileName = key.split('/').pop() || key;
    const displayKey = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
    const baseUrl = buildObjectUrl({ bucket, key, endpoint, region, forcePathStyle, publicUrl });

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
 * List objects from S3-compatible storage.
 * @param {S3MediaLibrary} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @param {object} [params] Additional parameters.
 * @param {number} [params.maxPages] Maximum number of pages to fetch. Default: 10.
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const listS3Objects = async (config, options, { maxPages = 10 } = {}) => {
  const { bucket, region, endpoint, force_path_style: forcePathStyle, prefix = '' } = config;
  const { kind, apiKey: secretAccessKey } = options;

  if (!secretAccessKey) {
    return Promise.reject(new Error('S3 secret access key is required'));
  }

  /** @type {S3Object[]} */
  const allObjects = [];
  /** @type {string | undefined} */
  let continuationToken;

  // Fetch up to maxPages pages
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      'list-type': '2',
      'max-keys': '1000',
      ...(prefix && { prefix }),
      ...(continuationToken && { 'continuation-token': continuationToken }),
    });

    const url = endpoint
      ? `${endpoint}/${bucket}?${params}`
      : forcePathStyle
        ? `https://s3.${region}.amazonaws.com/${bucket}?${params}`
        : `https://${bucket}.s3.${region}.amazonaws.com/?${params}`;

    const response = await signedRequest({ method: 'GET', url, config, secretAccessKey });

    if (!response.ok) {
      const errorText = await response.text();

      return Promise.reject(new Error(`Failed to list objects: ${errorText}`));
    }

    const xml = await response.text();
    /** @type {any} */
    const data = parseXml(xml);

    const contents = data.Contents
      ? Array.isArray(data.Contents)
        ? data.Contents
        : [data.Contents]
      : [];

    // Filter out directories (keys ending with /)
    const files = contents.filter((/** @type {S3Object} */ obj) => !obj.Key.endsWith('/'));

    allObjects.push(...files);

    continuationToken = data.NextContinuationToken;

    if (data.IsTruncated !== 'true' || !continuationToken) {
      break;
    }

    // Wait for a bit before requesting the next page
    await sleep(50);
  }

  // Filter by kind if specified
  const filteredObjects = kind
    ? allObjects.filter((obj) => getAssetKind(obj.Key) === kind)
    : allObjects;

  return parseS3Results(filteredObjects, config);
};

/**
 * Search objects in S3-compatible storage.
 * @param {string} query Search query.
 * @param {S3MediaLibrary} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @returns {Promise<ExternalAsset[]>} Assets.
 */
export const searchS3Objects = async (query, config, options) => {
  // S3 doesn’t have native search, so we list all objects and filter client-side
  const allAssets = await listS3Objects(config, options, { maxPages: 5 });
  const lowerQuery = query.toLowerCase();

  return allAssets.filter(
    (asset) =>
      asset.fileName.toLowerCase().includes(lowerQuery) ||
      asset.description.toLowerCase().includes(lowerQuery),
  );
};

/**
 * Upload files to S3-compatible storage.
 * @param {File[]} files Files to upload.
 * @param {S3MediaLibrary} config S3 configuration.
 * @param {MediaLibraryFetchOptions} options Fetch options (apiKey contains secret access key).
 * @returns {Promise<ExternalAsset[]>} Uploaded assets.
 */
export const uploadToS3 = async (files, config, options) => {
  if (files.length === 0) {
    return [];
  }

  const { bucket, region, endpoint, force_path_style: forcePathStyle, prefix = '' } = config;
  const { apiKey: secretAccessKey } = options;

  if (!secretAccessKey) {
    return Promise.reject(new Error('S3 secret access key is required'));
  }

  /** @type {S3Object[]} */
  const uploadedObjects = [];

  // Upload files one by one
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    // Extract only the filename to prevent path traversal via crafted File objects
    const sanitizedName = file.name.split(/[/\\]/).filter(Boolean).at(-1) ?? file.name;
    const key = prefix ? `${prefix}${sanitizedName}` : sanitizedName;

    const url = endpoint
      ? `${endpoint}/${bucket}/${key}`
      : forcePathStyle
        ? `https://s3.${region}.amazonaws.com/${bucket}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    const fileContent = await file.arrayBuffer();

    const response = await signedRequest({
      method: 'PUT',
      url,
      config,
      secretAccessKey,
      body: fileContent,
      extraHeaders: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-amz-acl': 'public-read',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Failed to upload file ${file.name}: ${errorText}`);
    }

    uploadedObjects.push({
      Key: key,
      LastModified: new Date().toISOString(),
      ETag: '',
      Size: file.size,
      ContentType: file.type,
    });

    // Wait a bit between uploads
    if (files.length > 1) {
      await sleep(50);
    }
  }

  return parseS3Results(uploadedObjects, config);
};
