// cspell:ignore epublickey

import { createHmac, randomUUID } from 'crypto';

import { fulfill } from './object-store.js';

/**
 * @import { Page, Request, Route } from '@playwright/test';
 */

/**
 * @typedef {object} UploadcareFile
 * @property {string} uuid File ID.
 * @property {string} name Original file name.
 * @property {string} mimeType MIME type.
 * @property {Buffer} body Content.
 * @property {Date} uploaded Upload date.
 */

/**
 * An Uploadcare project behind a mocked REST API, upload API and CDN. The REST API takes the public
 * and secret keys in the `Authorization` header, and an upload is signed with the secret key.
 */
export class MockUploadcare {
  /**
   * A made-up public key.
   */
  publicKey = 'e2epublickey00000000';

  /**
   * A made-up secret key, in the format the CMS accepts: 20 hexadecimal digits.
   */
  secretKey = '0123456789abcdef0123';

  /**
   * Stored files, the latest upload last.
   * @type {UploadcareFile[]}
   */
  files = [];

  /**
   * Requests the mock refused, listed by the test user to fail the test.
   * @type {string[]}
   */
  refused = [];

  /**
   * Add a file, as someone uploaded it before.
   * @param {string} name File name.
   * @param {Buffer} body Content.
   * @returns {UploadcareFile} File.
   */
  add(name, body) {
    const file = { uuid: randomUUID(), name, mimeType: 'image/png', body, uploaded: new Date() };

    this.files.push(file);

    return file;
  }

  /**
   * Route the requests to Uploadcare.
   * @param {Page} page Page.
   */
  async install(page) {
    const context = page.context();

    await context.route('https://api.uploadcare.com/files/**', (route) => this.handleREST(route));
    await context.route('https://upload.uploadcare.com/base/', (route) => this.handleUpload(route));
    await context.route('https://ucarecdn.com/**', (route) => this.handleCDN(route));
  }

  /**
   * Check whether a REST API request carries the project’s keys.
   * @param {Request} request Request.
   * @returns {boolean} Result.
   */
  isAuthorized(request) {
    return (
      request.headers().authorization === `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`
    );
  }

  /**
   * Answer a request to the REST API: list the files, or remove some from the storage.
   * @param {Route} route Route.
   */
  async handleREST(route) {
    const request = route.request();
    const method = request.method();
    const { pathname } = new URL(request.url());

    if (!this.isAuthorized(request)) {
      this.refused.push(`${method} ${pathname}: invalid keys`);
      await fulfill(route, {
        status: 401,
        json: { detail: 'Incorrect authentication credentials.' },
      });

      return;
    }

    if (method === 'GET' && pathname === '/files/') {
      await fulfill(route, {
        json: {
          next: null,
          results: [...this.files].reverse().map(({ uuid, name, mimeType, body, uploaded }) => ({
            uuid,
            original_filename: name,
            original_file_url: `https://ucarecdn.com/${uuid}/${name}`,
            mime_type: mimeType,
            is_image: mimeType.startsWith('image/'),
            size: body.length,
            datetime_uploaded: uploaded.toISOString(),
          })),
        },
      });

      return;
    }

    if (method === 'DELETE' && pathname === '/files/storage/') {
      /** @type {string[]} */
      const uuids = request.postDataJSON();

      this.files = this.files.filter(({ uuid }) => !uuids.includes(uuid));
      await fulfill(route, { json: { status: 'ok', problems: {}, result: [] } });

      return;
    }

    this.refused.push(`${method} ${pathname}`);
    await fulfill(route, { status: 404, json: { detail: 'Not found.' } });
  }

  /**
   * Answer an upload, a form with the files and a signature of its expiry time made with the
   * secret key.
   * @param {Route} route Route.
   */
  async handleUpload(route) {
    const request = route.request();

    const form = await new Response(request.postDataBuffer(), {
      headers: { 'content-type': request.headers()['content-type'] },
    }).formData();

    const signature = createHmac('sha256', this.secretKey)
      .update(String(form.get('expire')))
      .digest('hex');

    if (form.get('UPLOADCARE_PUB_KEY') !== this.publicKey || form.get('signature') !== signature) {
      this.refused.push('POST /base/: invalid signature');
      await fulfill(route, { status: 403, body: 'Invalid signature' });

      return;
    }

    /** @type {Record<string, string>} */
    const result = {};

    await Promise.all(
      [...form.entries()].map(async ([key, value]) => {
        if (typeof value !== 'string') {
          const file = this.add(key, Buffer.from(await value.arrayBuffer()));

          file.mimeType = value.type;
          result[key] = file.uuid;
        }
      }),
    );

    await fulfill(route, { json: result });
  }

  /**
   * Serve a file from the CDN, with or without operations and a file name after its ID.
   * @param {Route} route Route.
   */
  async handleCDN(route) {
    const [uuid] = new URL(route.request().url()).pathname.split('/').filter(Boolean);
    const file = this.files.find((f) => f.uuid === uuid);

    await (file
      ? fulfill(route, { contentType: file.mimeType, body: file.body })
      : fulfill(route, { status: 404, body: '' }));
  }
}
