import { createHash } from 'crypto';

import { derivePrehash } from '../../src/lib/services/additions/kdf.js';

/**
 * @import { Page, Route, WebSocketRoute } from '@playwright/test';
 * @import { MockGitHub } from './github.js';
 */

/**
 * URL of the mocked Sveltia CMS Additions service.
 */
export const ADDITIONS_URL = 'https://additions.example.com';

/**
 * Version of the mocked service, which is also its latest release, so no update is reported.
 */
const SERVICE_VERSION = '0.1.0';

/**
 * A user of the mocked service.
 * @typedef {object} MockAdditionsUser
 * @property {string} id ID.
 * @property {string} username Username.
 * @property {string} name Display name.
 * @property {string | null} [email] Email, if one has been set.
 * @property {'admin' | 'editor' | 'viewer'} role Role.
 * @property {string} prehash Prehash of the password.
 * @property {boolean} mustChangePassword Whether the password is a temporary one.
 */

/**
 * Mocked Sveltia CMS Additions service, which signs users in with a username and password and
 * hands out the mocked GitHub’s token, the way the real service hands out an installation token.
 * Like the real one, it only accepts the prehash the CMS derives from the password, so a test also
 * checks the derivation the CMS and the service share.
 */
export class MockAdditions {
  /**
   * Site ID the service publishes in `/version`, which salts the password derivation.
   */
  siteId = 'e2e-site';

  /**
   * Users, by username.
   * @type {Map<string, MockAdditionsUser>}
   */
  users = new Map();

  /**
   * Usernames of the signed-in sessions, by session token.
   * @type {Map<string, string>}
   */
  sessions = new Map();

  /**
   * Requests the service received, as `METHOD /path`.
   * @type {string[]}
   */
  requests = [];

  /**
   * Entry locks, by key, as the lock socket shares them.
   * @type {Map<string, { key: string, user_id: string, name: string, since: string,
   * connection: string }>}
   */
  locks = new Map();

  /**
   * Who has each entry open in the editor, by key, as the lock socket shares it.
   * @type {Map<string, { connection: string, user_id: string, name: string }[]>}
   */
  viewers = new Map();

  /**
   * Open lock sockets, with the connection and user each belongs to.
   * @type {Map<WebSocketRoute, { connection: string, userId: string, name: string }>}
   */
  lockSockets = new Map();

  /**
   * Lock socket tickets handed out, with the user each opens a connection for.
   * @type {Map<string, MockAdditionsUser>}
   */
  lockTickets = new Map();

  /**
   * Comments on entries, oldest first.
   * @type {{ id: string, key: string, body: string, author: { id: string, name: string,
   * username: string, image: null }, created_at: string, updated_at: string }[]}
   */
  comments = [];

  /**
   * Credentials an admin shares with everyone, as the service stores them.
   * @type {{ api_keys: Record<string, string>, deploy_hook: { url: string, auth_header: string } |
   * null }}
   */
  credentials = { api_keys: {}, deploy_hook: null };

  /**
   * User who signs in with GitHub, standing in for GitHub’s own sign-in, or `null` while signing
   * in with GitHub is turned off.
   * @type {string | null}
   */
  githubSignIn = null;

  /**
   * Requests to link a GitHub account, with the user who made them.
   * @type {Map<string, string>}
   */
  githubLinks = new Map();

  /**
   * Users who signed in with GitHub, and get their own GitHub token.
   * @type {Set<string>}
   */
  githubUsers = new Set();

  /**
   * One-time codes of sign-ins with GitHub, with the user and the PKCE challenge.
   * @type {Map<string, { username: string, challenge: string, redirectUri: string }>}
   */
  authCodes = new Map();

  /**
   * Admin secret set in the service’s settings, which the setup wizard asks for.
   */
  adminSecret = 'e2e-admin-secret-0123456789abcdefghij';

  /**
   * Allowed domains, which an admin created with the secret adds the site to.
   * @type {string[]}
   */
  allowedDomains = [];

  /**
   * The GitHub App, once the setup wizard has connected the service to GitHub.
   * @type {{ slug: string, owner: string, html_url: string } | null}
   */
  githubApp = null;

  /**
   * The GitHub App’s private key, as uploaded on the GitHub settings tab. It’s lost when the data
   * key is replaced.
   * @type {string | null}
   */
  githubPrivateKey = null;

  /**
   * Who appears as the author of the commits: the person, through the Git Data API, or the app,
   * with the person as co-author.
   * @type {'user' | 'bot'}
   */
  commitAuthor = 'user';

  /**
   * URL the service sends the browser back to once GitHub has created and installed the app, as
   * the setup wizard asked.
   * @type {string | undefined}
   */
  setupReturnURL = undefined;

  /**
   * Type of the repository owner the setup wizard looked up on GitHub and sent, if any.
   * @type {string | undefined}
   */
  setupOwnerType = undefined;

  /**
   * Other sites the service serves, or `null` when it serves only this one and doesn’t know the
   * operator API, like a tenant’s path or another platform.
   * @type {{ id: string, name: string, created_at: string, url: string }[] | null}
   */
  tenants = null;

  /**
   * Create a mock.
   * @param {MockGitHub} github Mocked GitHub, whose token the service hands out.
   */
  constructor(github) {
    this.github = github;
  }

  /**
   * Add a user.
   * @param {object} args Arguments.
   * @param {string} args.username Username.
   * @param {string} args.password Password.
   * @param {'admin' | 'editor' | 'viewer'} [args.role] Role.
   * @param {boolean} [args.mustChangePassword] Whether the password is a temporary one.
   * @returns {Promise<MockAdditionsUser>} User.
   */
  async addUser({ username, password, role = 'editor', mustChangePassword = false }) {
    /** @type {MockAdditionsUser} */
    const user = {
      id: `user-${this.users.size + 1}`,
      username,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      role,
      prehash: await derivePrehash({ siteId: this.siteId, username, password }),
      mustChangePassword,
    };

    this.users.set(username, user);

    return user;
  }

  /**
   * Get the user in the API’s format.
   * @param {MockAdditionsUser} user User.
   * @returns {Record<string, any>} User.
   */
  toPublicUser({ id, username, name, email = null, role, mustChangePassword }) {
    return {
      id,
      username,
      name,
      email,
      role,
      disabled: false,
      must_change_password: mustChangePassword,
    };
  }

  /**
   * Get the GitHub token handed to a user, as the session endpoint and the token endpoint return
   * it.
   * @param {MockAdditionsUser} user User.
   * @returns {Record<string, any>} Token details.
   */
  getGitToken(user) {
    if (this.githubUsers.has(user.username)) {
      return {
        kind: 'user',
        token: this.github.token,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        repository: 'sveltia/e2e-site',
        permissions: {},
      };
    }

    return {
      kind: 'installation',
      token: this.github.token,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      repository: 'sveltia/e2e-site',
      permissions: { contents: user.role === 'viewer' ? 'read' : 'write' },
      commit_author: {
        mode: this.commitAuthor,
        name: user.name,
        email: user.email ?? `${user.username}@users.noreply.additions.example`,
      },
    };
  }

  /**
   * Answer the service’s requests from every page in the browser context.
   * @param {Page} page Page.
   */
  async install(page) {
    await page.context().route(`${ADDITIONS_URL}/**`, (route) => this.handle(route));
    // The Administration page looks up the latest release on the CDN
    await page
      .context()
      .route('https://unpkg.com/@sveltia/cms-additions/package.json', (route) =>
        route.fulfill({ json: { version: SERVICE_VERSION } }),
      );
    await page
      .context()
      .routeWebSocket(`${ADDITIONS_URL.replace(/^http/, 'ws')}/v1/socket?*`, (ws) =>
        this.handleLockSocket(ws),
      );
  }

  /**
   * Send a message to every lock socket.
   * @param {Record<string, any>} message Message.
   */
  broadcastLocks(message) {
    this.lockSockets.forEach((_, ws) => ws.send(JSON.stringify(message)));
  }

  /**
   * Tell every open tab how many comments an entry has now, as the service does after a change.
   * @param {string} key Entry key.
   */
  announceComments(key) {
    this.broadcastLocks({
      type: 'comments',
      key,
      count: this.comments.filter((comment) => comment.key === key).length,
    });
  }

  /**
   * Add a comment as someone in another browser would, and tell every open tab.
   * @param {string} key Entry key, e.g. `posts/first-post`.
   * @param {string} name Name of the person who writes it.
   * @param {string} body Markdown.
   */
  addComment(key, name, body) {
    const now = new Date().toISOString();

    this.comments.push({
      id: `comment-${this.comments.length + 1}`,
      key,
      body,
      author: { id: `other-${name}`, name, username: name.toLowerCase(), image: null },
      created_at: now,
      updated_at: now,
    });
    this.announceComments(key);
  }

  /**
   * Change who has an entry open, and tell every open tab.
   * @param {string} key Entry key.
   * @param {(viewers: { connection: string, user_id: string, name: string }[]) =>
   * { connection: string, user_id: string, name: string }[]} update Function returning the new
   * list from the current one.
   */
  updateViewers(key, update) {
    const viewers = update(this.viewers.get(key) ?? []);

    if (viewers.length) {
      this.viewers.set(key, viewers);
    } else {
      this.viewers.delete(key);
    }

    this.broadcastLocks({ type: 'presence', key, viewers });
  }

  /**
   * Open or close an entry as someone in another browser would, and tell every open tab.
   * @param {string} key Lock key, e.g. `posts/first-post@main`.
   * @param {string} name Name of the person.
   * @param {boolean} [open] Whether they open the entry rather than close it.
   */
  setViewer(key, name, open = true) {
    const connection = `other-${name}`;

    this.updateViewers(key, (viewers) => [
      ...viewers.filter((viewer) => viewer.connection !== connection),
      ...(open ? [{ connection, user_id: `other-${name}`, name }] : []),
    ]);
  }

  /**
   * Set a lock as someone in another browser would, and tell every open tab.
   * @param {string} key Lock key, e.g. `posts/first-post@main`.
   * @param {string | null} name Name of the person who holds it, or `null` to release it.
   */
  setLock(key, name) {
    const lock = name
      ? {
          key,
          user_id: `other-${name}`,
          name,
          since: new Date().toISOString(),
          connection: `other-${name}`,
        }
      : null;

    if (lock) {
      this.locks.set(key, lock);
    } else {
      this.locks.delete(key);
    }

    this.broadcastLocks({ type: 'changed', key, lock });
  }

  /**
   * Answer a lock socket like the service’s Durable Object: a snapshot first, then `acquire`,
   * `takeover` and `release` messages, and `open` and `close` ones saying who has an entry open,
   * with every change sent to every socket.
   * @param {WebSocketRoute} ws Socket.
   */
  handleLockSocket(ws) {
    const ticket = new URL(ws.url()).searchParams.get('ticket') ?? '';
    const user = this.lockTickets.get(ticket);

    this.lockTickets.delete(ticket);

    if (!user) {
      ws.close({ code: 1008, reason: 'Invalid ticket' });

      return;
    }

    const client = {
      connection: `tab-${this.lockSockets.size + 1}`,
      userId: user.id,
      name: user.name,
    };

    this.lockSockets.set(ws, client);
    ws.send(
      JSON.stringify({
        type: 'snapshot',
        connection: client.connection,
        user_id: client.userId,
        locks: [...this.locks.values()],
        presence: Object.fromEntries(this.viewers),
      }),
    );

    ws.onMessage((data) => {
      const { type, key } = JSON.parse(String(data));
      const current = this.locks.get(key);

      if (type === 'open' || type === 'close') {
        this.updateViewers(key, (viewers) => [
          ...viewers.filter((viewer) => viewer.connection !== client.connection),
          ...(type === 'open'
            ? [{ connection: client.connection, user_id: client.userId, name: client.name }]
            : []),
        ]);

        return;
      }

      if (type === 'release') {
        if (current?.connection === client.connection) {
          this.locks.delete(key);
          this.broadcastLocks({ type: 'changed', key, lock: null });
        }

        return;
      }

      if (type === 'acquire' && current && current.connection !== client.connection) {
        ws.send(JSON.stringify({ type: 'refused', key, reason: 'held', lock: current }));

        return;
      }

      const lock = {
        key,
        user_id: client.userId,
        name: client.name,
        since: new Date().toISOString(),
        connection: client.connection,
      };

      this.locks.set(key, lock);
      this.broadcastLocks({ type: 'changed', key, lock });
    });

    ws.onClose(() => {
      this.lockSockets.delete(ws);
      // What the tab had open is closed at once, unlike its locks
      [...this.viewers.keys()].forEach((key) => {
        if (this.viewers.get(key)?.some(({ connection }) => connection === client.connection)) {
          this.updateViewers(key, (viewers) =>
            viewers.filter(({ connection }) => connection !== client.connection),
          );
        }
      });
    });
  }

  /**
   * Answer a request.
   * @param {Route} route Route.
   * @returns {Promise<void>}
   */
  async handle(route) {
    const request = route.request();
    const { pathname } = new URL(request.url());

    const cors = {
      'Access-Control-Allow-Origin': request.headers().origin ?? '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
    };

    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }

    this.requests.push(`${request.method()} ${pathname}`);

    /**
     * Respond with JSON.
     * @param {number} status Status.
     * @param {any} body Body.
     * @returns {Promise<void>}
     */
    const respond = (status, body) => route.fulfill({ status, headers: cors, json: body });
    /**
     * Respond with an error.
     * @param {number} status Status.
     * @param {string} code Error code.
     * @returns {Promise<void>}
     */
    const fail = (status, code) => respond(status, { error: { code, message: code } });
    const body = request.postData() ? request.postDataJSON() : undefined;
    const sessionToken = request.headers().authorization?.replace(/^Bearer /, '');
    const sessionUser = this.users.get(this.sessions.get(sessionToken ?? '') ?? '');

    if (pathname === '/version') {
      return respond(200, {
        api: 1,
        kdf: 'v1',
        site_id: this.siteId,
        package: '@sveltia/cms-additions',
        version: SERVICE_VERSION,
        sign_in_methods: ['password', ...(this.githubSignIn ? ['github'] : [])],
      });
    }

    // The service would send the browser on to GitHub, which sends it back; skip straight to that
    if (pathname === '/v1/auth/start/github') {
      const params = new URL(request.url()).searchParams;
      const redirectUri = params.get('redirect_uri') ?? '';
      const back = new URL(redirectUri);

      back.searchParams.set('state', params.get('state') ?? '');

      // A link signs the user who asked for it in again
      const username = this.githubLinks.get(params.get('link') ?? '') ?? this.githubSignIn;

      if (username && this.users.has(username)) {
        const code = `code-${this.authCodes.size + 1}`;

        this.authCodes.set(code, {
          username,
          challenge: params.get('code_challenge') ?? '',
          redirectUri,
        });
        back.searchParams.set('code', code);
      } else {
        back.searchParams.set('error', 'not_invited');
      }

      return route.fulfill({ status: 302, headers: { Location: back.toString() } });
    }

    if (pathname === '/v1/auth/token' && body?.grant_type === 'authorization_code') {
      const entry = this.authCodes.get(body.code);

      const challenge = createHash('sha256')
        .update(body.code_verifier ?? '')
        .digest('base64url');

      this.authCodes.delete(body.code);

      if (!entry || entry.challenge !== challenge || entry.redirectUri !== body.redirect_uri) {
        return fail(400, 'invalid_grant');
      }

      const user = /** @type {MockAdditionsUser} */ (this.users.get(entry.username));
      const token = `session-${this.sessions.size + 200}`;

      this.githubUsers.add(user.username);
      this.sessions.set(token, user.username);

      return respond(200, {
        access_token: this.github.token,
        refresh_token: token,
        token_type: 'bearer',
        user: this.toPublicUser(user),
        git: this.getGitToken(user),
      });
    }

    if (pathname === '/v1/tenants' || pathname.startsWith('/v1/tenants/')) {
      if (!this.tenants) {
        return fail(404, 'not_found');
      }

      if (sessionToken !== this.adminSecret) {
        return fail(401, 'wrong_admin_secret');
      }

      if (request.method() === 'GET') {
        return respond(200, { tenants: this.tenants });
      }

      if (request.method() === 'POST') {
        if (this.tenants.some(({ id }) => id === body.id)) {
          return fail(409, 'tenant_exists');
        }

        const tenant = {
          id: body.id,
          name: body.name ?? body.id,
          created_at: new Date().toISOString(),
          url: `${ADDITIONS_URL}/t/${body.id}`,
        };

        this.tenants.push(tenant);

        return respond(201, { tenant });
      }

      const id = pathname.split('/').pop();

      if (!this.tenants.some((tenant) => tenant.id === id)) {
        return fail(404, 'tenant_not_found');
      }

      this.tenants = this.tenants.filter((tenant) => tenant.id !== id);

      return respond(200, { deleted: true });
    }

    if (pathname.startsWith('/v1/setup/')) {
      if (sessionToken !== this.adminSecret) {
        return fail(401, 'wrong_admin_secret');
      }

      if (pathname === '/v1/setup/status') {
        return respond(200, {
          site_id: this.siteId,
          data_key: 'ok',
          admins: [...this.users.values()].filter(({ role }) => role === 'admin').length,
          allowed_domains: this.allowedDomains,
          github_app: this.githubApp,
          installation: this.githubApp ? { owner: 'sveltia', name: 'e2e-site' } : null,
        });
      }

      if (pathname === '/v1/setup/admin') {
        const existing = this.users.get(body.username);

        if (existing && existing.role !== 'admin') {
          return fail(409, 'not_an_admin');
        }

        /** @type {MockAdditionsUser} */
        const user = existing ?? {
          id: `user-${this.users.size + 1}`,
          username: body.username,
          name: body.username,
          role: 'admin',
          prehash: '',
          mustChangePassword: false,
        };

        Object.assign(user, { prehash: body.prehash, mustChangePassword: false });
        this.users.set(user.username, user);

        if (body.allow_origin && request.headers().origin) {
          this.allowedDomains = [new URL(request.headers().origin).hostname];
        }

        return respond(200, { user: this.toPublicUser(user) });
      }

      if (pathname === '/v1/setup/github') {
        this.setupReturnURL = body.return_url;
        this.setupOwnerType = body.owner_type;

        return respond(200, {
          action_url: 'https://github.com/settings/apps/new?state=e2e-state',
          manifest: { name: 'Sveltia CMS e2e-site' },
        });
      }
    }

    if (pathname === '/v1/auth/sign-in') {
      const user = this.users.get(body.username.toLowerCase());

      if (!user || user.prehash !== body.prehash) {
        return fail(401, 'invalid_credentials');
      }

      const token = `session-${this.sessions.size + 1}`;

      this.sessions.set(token, user.username);

      return respond(200, { session_token: token, user: this.toPublicUser(user) });
    }

    if (pathname === '/v1/auth/token') {
      const user = this.users.get(this.sessions.get(body.refresh_token) ?? '');

      if (!user || user.mustChangePassword) {
        return fail(401, 'unauthenticated');
      }

      return respond(200, {
        access_token: this.github.token,
        refresh_token: body.refresh_token,
        token_type: 'bearer',
        user: this.toPublicUser(user),
        git: this.getGitToken(user),
      });
    }

    if (!sessionUser || !sessionToken) {
      return fail(401, 'unauthenticated');
    }

    if (pathname === '/v1/auth/session') {
      return respond(200, {
        user: this.toPublicUser(sessionUser),
        git: sessionUser.mustChangePassword ? null : this.getGitToken(sessionUser),
      });
    }

    if (pathname === '/v1/auth/password') {
      if (body.current_prehash !== sessionUser.prehash) {
        return fail(400, 'wrong_password');
      }

      Object.assign(sessionUser, { prehash: body.new_prehash, mustChangePassword: false });
      this.sessions.delete(sessionToken);

      const token = `session-${this.sessions.size + 100}`;

      this.sessions.set(token, sessionUser.username);

      return respond(200, { session_token: token });
    }

    if (pathname === '/v1/auth/profile' && request.method() === 'PATCH') {
      if (sessionUser.mustChangePassword) {
        return fail(403, 'password_change_required');
      }

      // Only an admin changes the email, on the Users page
      if ('email' in body) {
        return fail(403, 'forbidden');
      }

      sessionUser.name = body.name.trim();

      return respond(200, { user: this.toPublicUser(sessionUser) });
    }

    if (
      pathname === '/v1/users' ||
      pathname.startsWith('/v1/users/') ||
      pathname === '/v1/settings' ||
      pathname.startsWith('/v1/settings/')
    ) {
      if (sessionUser.role !== 'admin') {
        return fail(403, 'forbidden');
      }

      return this.handleAdmin(request.method(), pathname, body, respond, fail);
    }

    if (pathname === '/v1/auth/link/github') {
      const link = `link-${this.githubLinks.size + 1}`;

      this.githubLinks.set(link, sessionUser.username);

      return respond(200, { link });
    }

    if (pathname === '/v1/socket/ticket') {
      const ticket = `ticket-${this.lockTickets.size + 1}-${Date.now()}`;

      this.lockTickets.set(ticket, sessionUser);

      return respond(200, { ticket, expires_in: 30 });
    }

    if (pathname === '/v1/credentials') {
      return respond(200, this.credentials);
    }

    if (pathname === '/v1/comments' || pathname.startsWith('/v1/comments/')) {
      return this.handleComments(request, pathname, body, sessionUser, respond, fail);
    }

    if (pathname === '/v1/auth/sign-out') {
      this.sessions.delete(sessionToken);

      return respond(200, { signed_out: true });
    }

    return fail(404, 'not_found');
  }

  /**
   * Answer the comment requests like the service: anyone signed in can read and write, the
   * author can edit, the author or an admin can delete.
   * @param {import('@playwright/test').Request} request Request.
   * @param {string} pathname Path.
   * @param {any} body JSON body.
   * @param {MockAdditionsUser} sessionUser Signed-in user.
   * @param {(status: number, body: any) => Promise<void>} respond Respond with JSON.
   * @param {(status: number, code: string) => Promise<void>} fail Respond with an error.
   * @returns {Promise<void>}
   */
  async handleComments(request, pathname, body, sessionUser, respond, fail) {
    const method = request.method();
    const key = new URL(request.url()).searchParams.get('key') ?? '';
    /**
     * Check whether the signed-in user wrote a comment.
     * @param {{ author: { id: string } }} comment Comment.
     * @returns {boolean} Result.
     */
    const own = (comment) => comment.author.id === sessionUser.id;

    /**
     * Get a comment in the API’s format.
     * @param {any} comment Comment.
     * @returns {Record<string, any>} Comment.
     */
    const toPublic = (comment) => ({
      ...comment,
      can_edit: own(comment),
      can_delete: own(comment) || sessionUser.role === 'admin',
    });

    if (pathname === '/v1/comments/counts') {
      /** @type {Record<string, number>} */
      const counts = {};

      this.comments.forEach((comment) => {
        counts[comment.key] = (counts[comment.key] ?? 0) + 1;
      });

      return respond(200, { counts });
    }

    if (pathname === '/v1/comments' && method === 'GET') {
      return respond(200, {
        comments: this.comments.filter((comment) => comment.key === key).map(toPublic),
        has_more: false,
      });
    }

    if (pathname === '/v1/comments' && method === 'POST') {
      const now = new Date().toISOString();

      const comment = {
        id: `comment-${this.comments.length + 1}`,
        key: body.key,
        body: body.body,
        author: {
          id: sessionUser.id,
          name: sessionUser.name,
          username: sessionUser.username,
          image: null,
        },
        created_at: now,
        updated_at: now,
      };

      this.comments.push(comment);
      this.announceComments(comment.key);

      return respond(201, { comment: toPublic(comment) });
    }

    const comment = this.comments.find(({ id }) => id === pathname.split('/')[3]);

    if (!comment) {
      return fail(404, 'comment_not_found');
    }

    if (method === 'PATCH') {
      if (!own(comment)) {
        return fail(403, 'forbidden');
      }

      Object.assign(comment, { body: body.body, updated_at: new Date().toISOString() });
      this.announceComments(comment.key);

      return respond(200, { comment: toPublic(comment) });
    }

    if (!toPublic(comment).can_delete) {
      return fail(403, 'forbidden');
    }

    this.comments = this.comments.filter(({ id }) => id !== comment.id);
    this.announceComments(comment.key);

    return respond(200, { deleted: true });
  }

  /**
   * Answer the user management and settings requests of an admin.
   * @param {string} method HTTP method.
   * @param {string} pathname Path.
   * @param {any} body JSON body.
   * @param {(status: number, body: any) => Promise<void>} respond Respond with JSON.
   * @param {(status: number, code: string) => Promise<void>} fail Respond with an error.
   * @returns {Promise<void>}
   */
  async handleAdmin(method, pathname, body, respond, fail) {
    if (pathname === '/v1/settings/github/private-key' && method === 'PUT') {
      if (!/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(body.private_key)) {
        return fail(400, 'invalid_private_key');
      }

      this.githubPrivateKey = body.private_key;
    }

    if (pathname.startsWith('/v1/settings/github')) {
      const app = this.githubApp ?? {
        slug: 'sveltia-cms-e2e-site',
        owner: 'e2e',
        html_url: 'https://github.com/apps/sveltia-cms-e2e-site',
      };

      return respond(200, {
        status: this.githubPrivateKey ? 'ok' : 'key_missing',
        app: {
          id: 1,
          ...app,
          settings_url: `https://github.com/settings/apps/${app.slug}`,
        },
        installation: { owner: 'e2e', name: 'site' },
        default_branch: this.githubPrivateKey ? { name: 'main', protection: 'unprotected' } : null,
      });
    }

    // Like the service, empty values are dropped, and open tabs are told to load them again
    if (pathname === '/v1/settings/credentials') {
      this.credentials = {
        api_keys: Object.fromEntries(
          Object.entries(body.api_keys ?? {}).filter(([, value]) => !!value),
        ),
        deploy_hook: body.deploy_hook?.url ? body.deploy_hook : null,
      };
      this.broadcastLocks({ type: 'credentials' });

      return respond(200, this.credentials);
    }

    if (pathname === '/v1/settings') {
      if (method === 'PATCH') {
        this.allowedDomains = body.allowed_domains ?? this.allowedDomains;
        this.commitAuthor = body.commit_author ?? this.commitAuthor;
      }

      return respond(200, {
        allowed_domains: this.allowedDomains,
        commit_author: this.commitAuthor,
        sign_in_methods: { github: !!this.githubSignIn },
        sign_up_rules: [],
      });
    }

    if (pathname === '/v1/users') {
      if (method === 'POST') {
        if (this.users.has(body.username)) {
          return fail(409, 'username_taken');
        }

        /** @type {MockAdditionsUser} */
        const user = {
          id: `user-${this.users.size + 1}`,
          username: body.username,
          name: body.name,
          role: body.role,
          prehash: body.prehash,
          mustChangePassword: true,
        };

        this.users.set(user.username, user);

        return respond(201, { user: this.toPublicUser(user) });
      }

      return respond(200, {
        users: [...this.users.values()].map((user) => ({
          ...this.toPublicUser(user),
          last_sign_in_at: null,
          pending_token_revocations: 0,
        })),
      });
    }

    const [, , , id, action] = pathname.split('/');
    const target = [...this.users.values()].find((user) => user.id === id);

    if (!target) {
      return fail(404, 'user_not_found');
    }

    if (method === 'PATCH') {
      Object.assign(target, body.role ? { role: body.role } : {});

      return respond(200, { user: this.toPublicUser(target) });
    }

    if (action === 'password') {
      Object.assign(target, { prehash: body.prehash, mustChangePassword: true });

      return respond(200, { user: this.toPublicUser(target) });
    }

    if (method === 'DELETE' && !action) {
      this.users.delete(target.username);
    }

    return respond(200, {});
  }
}
