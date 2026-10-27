# Security Policy

## Supported Versions

Due to limited resources, we do not create branch releases for previous major/minor versions of Sveltia CMS. Instead, we only maintain the latest version.

For example, once version 2.1.0 is released, 2.0.x will no longer be supported. Likewise, once version 3.0.0 is released, 2.x.x will no longer be supported. This means that we do not backport bug fixes to older versions.

However, exceptions may be made in the event of critical security issues affecting a large number of users.

## Reporting a Vulnerability

If you discover a security vulnerability in our product, please email us at [hello@sveltia.dev](mailto:hello@sveltia.dev) with the details and your GitHub handle so that we can give you credit. Provided the maintainer is online, we will usually implement and ship a fix within a few hours and get back to you.

Although we do not offer a bug bounty program, if you report a security vulnerability in good faith, we will gladly acknowledge your contribution in our [security advisory](https://github.com/sveltia/sveltia-cms/security/advisories) and [release notes](https://github.com/sveltia/sveltia-cms/releases).

We don’t usually request CVEs as we consider them to be redundant for the following reasons. However, we may ask for a CVE if any high-severity or critical vulnerability is found.

- `npm audit` and other tools are [powered by GitHub](https://github.blog/security/supply-chain-security/github-advisory-database-now-powers-npm-audit/) where we publish advisories.
- Sveltia CMS is not a library that needs to consider downstream consumers.
- The CMS’s update process is transparent. The majority of users automatically receive the latest version [via a CDN](https://sveltiacms.app/en/docs/architecture#how-sveltia-cms-works).
- This Git-based CMS is intended for use by a single developer or a small, trusted team. It makes certain types of vulnerability, such as stored XSS and ReDoS, highly unlikely to be exploited, since the commit log reveals the attacker’s identity. In practice, the impact of most vulnerabilities is very limited, so using an unpatched version isn’t necessarily any less safe. However, users are still encouraged to use the latest version to benefit from the latest improvements.
