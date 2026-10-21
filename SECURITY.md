# Security Policy

## Supported Versions

Due to limited resources, we do not create branch releases for previous major/minor versions of Sveltia CMS. Instead, we only maintain the latest version.

For example, once version 2.1.0 is released, 2.0.x will no longer be supported. Likewise, once version 3.0.0 is released, 2.x.x will no longer be supported. This means that we do not backport bug fixes to older versions.

However, exceptions may be made in the event of critical security issues affecting a large number of users.

## Reporting a Vulnerability

Please email us at [hello@sveltia.dev](mailto:hello@sveltia.dev). We will respond as soon as possible.

Although we do not offer a bug bounty program, if you report a security vulnerability in good faith, we will gladly acknowledge your contribution in our [security advisory](https://github.com/sveltia/sveltia-cms/security/advisories) and [release notes](https://github.com/sveltia/sveltia-cms/releases).

We do not request CVEs as these are redundant:

- `npm audit` and other tools are [powered by GitHub](https://github.blog/security/supply-chain-security/github-advisory-database-now-powers-npm-audit/) where we publish advisories.
- Sveltia CMS is not a library that needs to consider downstream consumers.
- Sveltia CMS’s update process is transparent. The majority of users automatically receive the latest version [via a CDN](https://sveltiacms.app/en/docs/architecture#how-sveltia-cms-works).
