// cspell:ignore AKIAE ETESTKEY

import { createHash, createHmac } from 'crypto';

import { decodeKey, escapeXML, fulfill, MockObjectStore } from './object-store.js';

/**
 * @import { Page, Request, Route } from '@playwright/test';
 * @import { StoredObject } from './object-store.js';
 */

/**
 * Pattern of the `Authorization` header of a request signed with AWS Signature Version 4.
 */
const AUTHORIZATION_REGEX = new RegExp(
  '^AWS4-HMAC-SHA256 Credential=(?<credential>[^,]+), ' +
    'SignedHeaders=(?<signedHeaders>[^,]+), Signature=(?<signature>\\w+)$',
);

/**
 * An Amazon S3 bucket, or one of an S3-compatible service, behind a mocked REST API. Every
 * request has to be signed with AWS Signature Version 4 using {@link secretAccessKey}, which the
 * mock checks by signing the request itself, like S3 does.
 */
export class MockS3 extends MockObjectStore {
  /**
   * A made-up access key ID.
   */
  accessKeyId = 'AKIAE2ETESTKEY000000';

  /**
   * A made-up secret access key, in the format the CMS accepts: 40 characters.
   */
  secretAccessKey = 'e2eSecretAccessKey0000000000000000000000';

  /**
   * Create a bucket.
   * @param {object} args Arguments.
   * @param {string} args.bucket Bucket name.
   * @param {string} [args.region] Region, for the signature.
   * @param {string} args.baseURL URL the bucket is served at, without a trailing slash, e.g.
   * `https://e2e-bucket.s3.us-east-1.amazonaws.com` for a virtual-hosted-style bucket, or
   * `https://example.r2.cloudflarestorage.com/e2e-bucket` for a path-style one.
   * @param {string} [args.publicURL] URL the objects are also served at, like a CDN in front of the
   * bucket, without a trailing slash.
   */
  constructor({ bucket, region = 'us-east-1', baseURL, publicURL }) {
    super();
    this.bucket = bucket;
    this.region = region;
    this.baseURL = baseURL;
    this.publicURL = publicURL;
  }

  /**
   * Route the requests to the bucket.
   * @param {Page} page Page.
   */
  async install(page) {
    // A glob can’t tell the bucket’s URL from another one on the same host, so match the prefix
    await page.context().route(
      (url) => url.href.startsWith(this.baseURL),
      (route) => this.handleRoute(route),
    );

    if (this.publicURL) {
      const { publicURL } = this;

      await page.context().route(
        (url) => url.href.startsWith(publicURL),
        (route) => this.servePublicObject(route, route.request().url().slice(publicURL.length)),
      );
    }
  }

  /**
   * Check the AWS Signature Version 4 of a request, by signing it with the secret access key.
   * @param {Request} request Request.
   * @param {Buffer} body Request body.
   * @returns {boolean} Whether the signature is valid.
   */
  verifySignature(request, body) {
    const headers = request.headers();
    const authorization = headers.authorization ?? '';

    const { credential, signedHeaders, signature } =
      authorization.match(AUTHORIZATION_REGEX)?.groups ?? {};

    if (!credential) {
      return false;
    }

    const [accessKeyId, dateStamp, region, service] = credential.split('/');
    const amzDate = headers['x-amz-date'];
    const payloadHash = createHash('sha256').update(body).digest('hex');

    if (
      accessKeyId !== this.accessKeyId ||
      region !== this.region ||
      headers['x-amz-content-sha256'] !== payloadHash
    ) {
      return false;
    }

    const url = new URL(request.url());

    /**
     * Encode a query string component like the CMS does.
     * @param {string} str String.
     * @returns {string} Encoded string.
     */
    const encode = (str) =>
      encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );

    const canonicalRequest = [
      request.method(),
      url.pathname,
      [...url.searchParams]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${encode(key)}=${encode(value)}`)
        .join('&'),
      `${signedHeaders
        .split(';')
        .map((name) => `${name}:${(name === 'host' ? url.host : (headers[name] ?? '')).trim()}`)
        .join('\n')}\n`,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${dateStamp}/${region}/${service}/aws4_request`,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = [dateStamp, region, service, 'aws4_request'].reduce(
      (key, part) => createHmac('sha256', key).update(part).digest(),
      /** @type {Buffer | string} */ (`AWS4${this.secretAccessKey}`),
    );

    return createHmac('sha256', signingKey).update(stringToSign).digest('hex') === signature;
  }

  /**
   * Serve an object to anyone, as a public bucket or a CDN does.
   * @param {Route} route Route.
   * @param {string} path Object key, still URL-encoded, with or without a leading slash.
   */
  async servePublicObject(route, path) {
    const object = this.objects.get(decodeKey(path.replace(/^\//, '')));

    await (object
      ? fulfill(route, { contentType: object.contentType, body: object.body })
      : fulfill(route, { status: 404, body: '' }));
  }

  /**
   * Answer a request to the bucket.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const body = request.postDataBuffer() ?? Buffer.alloc(0);
    const key = decodeKey(url.href.slice(this.baseURL.length).split('?')[0].replace(/^\//, ''));

    // The bucket is public: an object is shown in the CMS by loading its URL, without a signature
    if (method === 'GET' && !request.headers().authorization) {
      await this.servePublicObject(route, key);

      return;
    }

    if (!this.verifySignature(request, body)) {
      this.refused.push(`${method} ${key}: invalid signature`);

      await fulfill(route, {
        status: 403,
        contentType: 'application/xml',
        body: '<Error><Code>SignatureDoesNotMatch</Code></Error>',
      });

      return;
    }

    if (method === 'GET' && url.searchParams.get('list-type') === '2') {
      const contents = this.list(url.searchParams.get('prefix') ?? '')
        .map(
          ([objectKey, { body: content, lastModified }]) =>
            `<Contents><Key>${escapeXML(objectKey)}</Key>` +
            `<LastModified>${lastModified.toISOString()}</LastModified>` +
            `<Size>${content.length}</Size></Contents>`,
        )
        .join('');

      await fulfill(route, {
        contentType: 'application/xml',
        body:
          '<?xml version="1.0" encoding="UTF-8"?>' +
          `<ListBucketResult><Name>${this.bucket}</Name><IsTruncated>false</IsTruncated>` +
          `${contents}</ListBucketResult>`,
      });

      return;
    }

    if (method === 'PUT') {
      const copySource = request.headers()['x-amz-copy-source'];

      if (copySource) {
        const source = this.objects.get(decodeKey(copySource.replace(`/${this.bucket}/`, '')));

        if (!source) {
          await fulfill(route, { status: 404, body: '<Error><Code>NoSuchKey</Code></Error>' });

          return;
        }

        this.objects.set(key, { ...source, lastModified: new Date() });
      } else {
        this.objects.set(key, {
          body,
          contentType: request.headers()['content-type'] ?? 'application/octet-stream',
          lastModified: new Date(),
        });
      }

      await fulfill(route, { status: 200, body: '' });

      return;
    }

    if (method === 'DELETE') {
      this.objects.delete(key);
      await fulfill(route, { status: 204 });

      return;
    }

    this.refused.push(`${method} ${key}`);
    await fulfill(route, { status: 404, body: '' });
  }
}
