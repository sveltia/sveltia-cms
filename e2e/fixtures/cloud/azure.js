// cspell:ignore rwdlac

import { decodeKey, escapeXML, fulfill, MockObjectStore } from './object-store.js';

/**
 * @import { Page, Route } from '@playwright/test';
 * @import { StoredObject } from './object-store.js';
 */

/**
 * An Azure Blob Storage container behind a mocked REST API. Every request but reading a blob has
 * to carry the shared access signature (SAS) token in its query, which the mock checks by its `sig`
 * parameter.
 */
export class MockAzureBlobStorage extends MockObjectStore {
  /**
   * A made-up SAS token, in the format the CMS accepts.
   */
  sasToken = 'sv=2024-11-04&ss=b&srt=co&sp=rwdlac&se=2030-01-01T00:00:00Z&sig=e2e-signature';

  /**
   * Create a container.
   * @param {object} args Arguments.
   * @param {string} args.accountName Storage account name.
   * @param {string} args.container Container name.
   */
  constructor({ accountName, container }) {
    super();
    this.containerURL = `https://${accountName}.blob.core.windows.net/${container}`;
  }

  /**
   * Route the requests to the container.
   * @param {Page} page Page.
   */
  async install(page) {
    const { containerURL } = this;

    await page.context().route(
      (url) => url.href.startsWith(containerURL),
      (route) => this.handleRoute(route),
    );
  }

  /**
   * Check whether a URL carries the SAS token’s signature.
   * @param {URL} url URL.
   * @returns {boolean} Result.
   */
  isSigned(url) {
    return url.searchParams.get('sig') === new URLSearchParams(this.sasToken).get('sig');
  }

  /**
   * Answer a request to the container.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const key = decodeKey(url.pathname.slice(new URL(this.containerURL).pathname.length + 1));

    // The container allows public read access, so a blob can be loaded from its link, which the
    // CMS stores without the token
    if (method === 'GET' && !url.searchParams.has('sig') && this.objects.has(key)) {
      const { body, contentType } = /** @type {StoredObject} */ (this.objects.get(key));

      await fulfill(route, { contentType, body });

      return;
    }

    if (!this.isSigned(url)) {
      this.refused.push(`${method} ${key}: invalid signature`);
      await fulfill(route, {
        status: 403,
        contentType: 'application/xml',
        body: '<Error><Code>AuthenticationFailed</Code></Error>',
      });

      return;
    }

    if (method === 'GET' && url.searchParams.get('comp') === 'list') {
      const blobs = this.list(url.searchParams.get('prefix') ?? '')
        .map(
          ([blobKey, { body, lastModified }]) =>
            `<Blob><Name>${escapeXML(blobKey)}</Name><Properties>` +
            `<Last-Modified>${lastModified.toUTCString()}</Last-Modified>` +
            `<Content-Length>${body.length}</Content-Length></Properties></Blob>`,
        )
        .join('');

      await fulfill(route, {
        contentType: 'application/xml',
        body:
          '<?xml version="1.0" encoding="utf-8"?><EnumerationResults>' +
          `<Blobs>${blobs}</Blobs><NextMarker /></EnumerationResults>`,
      });

      return;
    }

    if (method === 'GET' && this.objects.has(key)) {
      const { body, contentType } = /** @type {StoredObject} */ (this.objects.get(key));

      await fulfill(route, { contentType, body });

      return;
    }

    if (method === 'PUT') {
      const copySource = request.headers()['x-ms-copy-source'];

      if (copySource) {
        const sourceURL = new URL(copySource);

        const source = this.objects.get(
          decodeKey(sourceURL.pathname.slice(new URL(this.containerURL).pathname.length + 1)),
        );

        if (!source || !this.isSigned(sourceURL)) {
          await fulfill(route, { status: 404, body: '<Error><Code>BlobNotFound</Code></Error>' });

          return;
        }

        this.objects.set(key, { ...source, lastModified: new Date() });
        // A copy within the account is done at once
        await fulfill(route, { status: 202, body: '', headers: { 'x-ms-copy-status': 'success' } });

        return;
      }

      this.objects.set(key, {
        body: request.postDataBuffer() ?? Buffer.alloc(0),
        contentType: request.headers()['content-type'] ?? 'application/octet-stream',
        lastModified: new Date(),
      });
      await fulfill(route, { status: 201, body: '' });

      return;
    }

    if (method === 'DELETE') {
      this.objects.delete(key);
      await fulfill(route, { status: 202, body: '' });

      return;
    }

    this.refused.push(`${method} ${key}`);
    await fulfill(route, { status: 404, body: '<Error><Code>BlobNotFound</Code></Error>' });
  }
}
