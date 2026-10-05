import { randomUUID } from 'crypto';

import { fulfill } from './object-store.js';

/**
 * @import { Page, Route } from '@playwright/test';
 */

/**
 * @typedef {object} CloudinaryResource
 * @property {string} assetId Asset ID.
 * @property {string} name File name, which is also its public ID.
 * @property {Buffer} body Content.
 * @property {Date} created Creation date.
 */

/**
 * URL of the Cloudinary console’s media library, which the CMS embeds as a widget.
 */
const CONSOLE_URL = 'https://console.cloudinary.com/console/media_library';

/**
 * A Cloudinary cloud behind a mocked delivery CDN and console. The CMS picks an asset through the
 * console’s media library widget, which it embeds in an iframe and talks to with `postMessage`, so
 * no API request is made.
 */
export class MockCloudinary {
  /**
   * Cloud name.
   */
  cloudName = 'e2e-cloud';

  /**
   * A made-up API key, which the config gives.
   */
  apiKey = '123456789012345';

  /**
   * Stored image resources, the latest upload last.
   * @type {CloudinaryResource[]}
   */
  resources = [];

  /**
   * The query parameters of each widget the CMS has loaded, which identify the cloud.
   * @type {URLSearchParams[]}
   */
  widgetParams = [];

  /**
   * The configs the CMS has sent to the media library widget in `ML_WIDGET_SHOW` messages.
   * @type {Record<string, any>[]}
   */
  widgetConfigs = [];

  /**
   * Add an image, as someone uploaded it before.
   * @param {string} name File name.
   * @param {Buffer} body Content.
   * @returns {CloudinaryResource} Resource.
   */
  add(name, body) {
    const resource = { assetId: randomUUID().replaceAll('-', ''), name, body, created: new Date() };

    this.resources.push(resource);

    return resource;
  }

  /**
   * Get the delivery URL of a resource.
   * @param {CloudinaryResource} resource Resource.
   * @returns {string} URL.
   */
  getURL({ name }) {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/v1/${name}`;
  }

  /**
   * Route the requests to Cloudinary.
   * @param {Page} page Page.
   */
  async install(page) {
    const context = page.context();

    await context.route(`https://res.cloudinary.com/${this.cloudName}/**`, (route) =>
      this.handleCDN(route),
    );
    await context.route(`${CONSOLE_URL}/cms_login?*`, (route) => this.serveLoginPage(route));
    await context.route(`${CONSOLE_URL}/cms?*`, (route) => this.serveWidget(route));
    // Exposed to every frame of the page, including the widget’s, although it’s on another origin
    await page.exposeFunction('recordCloudinaryWidgetConfig', (/** @type {any} */ config) => {
      this.widgetConfigs.push(config);
    });
  }

  /**
   * Serve an image from the delivery CDN, with or without a transformation in its URL.
   * @param {Route} route Route.
   */
  async handleCDN(route) {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const resource = this.resources.find((r) => r.name === name);

    await (resource
      ? fulfill(route, { contentType: 'image/png', body: resource.body })
      : fulfill(route, { status: 404, body: '' }));
  }

  /**
   * Serve the console’s sign-in page, which the CMS opens in a new tab to activate the widget. Once
   * signed in, it tells the CMS so.
   * @param {Route} route Route.
   */
  async serveLoginPage(route) {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><script>
        window.opener.postMessage(
          JSON.stringify({ type: 'login', consoleDomain: 'console.cloudinary.com' }),
          '*',
        );
      </script>`,
    });
  }

  /**
   * Serve the media library widget, which the CMS embeds in an iframe. It tells the CMS it has
   * loaded, records the config the CMS sends, and lists the images with a button to insert each.
   * The real widget’s timing of the `consoleLoaded` message isn’t known, so this one repeats it.
   * @param {Route} route Route.
   */
  async serveWidget(route) {
    this.widgetParams.push(new URL(route.request().url()).searchParams);

    const assets = this.resources.map((r) => ({ name: r.name, secure_url: this.getURL(r) }));

    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body><script>
        const assets = ${JSON.stringify(assets)};

        // Tell the CMS the widget is ready until it answers, as the CMS only listens once the
        // Cloudinary panel is shown, which can be long after the iframe has loaded
        const timer = setInterval(() => {
          window.parent.postMessage(JSON.stringify({ type: 'consoleLoaded' }), '*');
        }, 100);

        window.addEventListener('message', ({ data }) => {
          const { type, data: payload } = JSON.parse(data);

          if (type === 'ML_WIDGET_SHOW') {
            clearInterval(timer);
            window.recordCloudinaryWidgetConfig(payload.config);
          }
        });

        assets.forEach((asset) => {
          const button = document.createElement('button');

          button.textContent = 'Insert ' + asset.name;
          button.addEventListener('click', () => {
            window.parent.postMessage(
              JSON.stringify({ type: 'ML_WIDGET_INSERT_DATA', data: { assets: [asset] } }),
              '*',
            );
          });
          document.body.append(button);
        });

      </script></body>`,
    });
  }
}
