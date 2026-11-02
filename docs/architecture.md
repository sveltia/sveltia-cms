# Architecture

Sveltia CMS is a browser-based, single-page application. Its UI and business logic run in the
browser; it loads site configuration and accesses content through the backend selected in that
configuration. The diagrams below describe the current implementation, not a required deployment
topology.

## C4 level 1: System context

```mermaid
C4Context
  title System Context - Sveltia CMS

  Person(editor, "Content editor", "Edits and publishes site content")
  System(cms, "Sveltia CMS", "Browser-based Git CMS for editing content and assets")
  System_Ext(site, "Configured site", "Serves the admin page and CMS configuration")
  System_Ext(git, "Git provider", "GitHub, GitLab, Gitea, or Forgejo repository and APIs")
  System_Ext(deploy, "Deployment service", "Optional build and deployment status or publish integration")

  Rel(editor, cms, "Uses", "Browser")
  Rel(cms, site, "Loads the admin page and configuration from", "HTTPS")
  Rel(cms, git, "Authenticates; reads and writes content, assets, and workflow data", "Provider APIs")
  Rel(cms, deploy, "Checks status or triggers a publish when configured", "Provider APIs")
```

The configured site and content repository may be the same project or separate projects. Deployment
integrations are optional and depend on the configured provider and workflow.

## C4 level 2: Container

```mermaid
C4Container
  title Container Diagram - Sveltia CMS

  Person(editor, "Content editor", "Uses the CMS in a web browser")
  System_Boundary(cms, "Sveltia CMS") {
    Container(app, "CMS web application", "Svelte SPA / JavaScript", "Renders the editor UI and runs CMS services in the browser")
  }
  System_Ext(site, "Configured site", "Static site or web server", "Provides the admin page and config.yml (or JSON/TOML configuration)")
  System_Ext(git, "Git provider", "GitHub, GitLab, Gitea, or Forgejo APIs", "Authenticates users and stores repository content and workflow data")
  System_Ext(browser, "Browser capabilities", "IndexedDB, Origin Private File System, File System Access API", "Stores preferences and caches; supports the optional local backend")
  System_Ext(deploy, "Deployment service", "Provider or build platform APIs", "Optional deployment status and publish integration")

  Rel(editor, app, "Uses")
  Rel(app, site, "Loads the admin page and configuration from", "HTTPS")
  Rel(app, git, "Authenticates and reads or writes configured repository data", "HTTPS")
  Rel(app, browser, "Persists local state and accesses files when enabled")
  Rel(app, deploy, "Reads deployment status or requests publishing when configured", "HTTPS")
```

The published CMS bundle is static; there is no Sveltia CMS application server in the content
editing request path. In local-backend mode, browser file APIs provide the local working copy, with
a configured Git provider used for the remote repository operations.

## C4 level 3: Components

```mermaid
C4Component
  title Component Diagram - CMS web application

  Container_Boundary(app, "CMS web application") {
    Component(ui, "Svelte UI", "src/lib/components", "Entrance, content, asset, workflow, search, settings, and custom-page views")
    Component(config, "Configuration and app services", "services/config, services/app", "Loads and validates configuration; coordinates app state, navigation, and localization")
    Component(domain, "Content and workflow services", "services/contents, services/assets, services/search, services/workflow", "Manages collections, entries, media, search, drafts, and publishing workflows")
    Component(identity, "User and backend services", "services/user, services/backends", "Handles accounts and auth; selects Git-provider, local, or test backends")
    Component(api, "Compatibility and extension API", "services/api; main.js", "Exposes the CMS initialization API and registration points for custom fields, previews, and pages")
    Component(common, "Shared services and utilities", "services/common, services/integrations, services/utils", "Shared transformations, integration metadata, browser helpers, and common utilities")
  }
  System_Ext(site, "Configured site", "Provides configuration and may register CMS extensions")
  System_Ext(git, "Git provider APIs", "GitHub, GitLab, Gitea, or Forgejo")
  System_Ext(browser, "Browser storage and file APIs", "IndexedDB, OPFS, and File System Access API")
  System_Ext(deploy, "Deployment APIs", "Optional configured deployment integration")

  Rel(site, api, "Initializes the CMS and may register extensions")
  Rel(ui, config, "Reads app configuration and state")
  Rel(ui, domain, "Runs content, asset, search, and workflow actions")
  Rel(ui, api, "Uses registered extensions and compatibility features")
  Rel(config, identity, "Selects the configured backend")
  Rel(domain, identity, "Reads and writes repository data through backend services")
  Rel(domain, common, "Uses shared transformations and integration helpers")
  Rel(identity, git, "Authenticates and calls provider APIs")
  Rel(identity, browser, "Uses local files and browser-backed persistence when applicable")
  Rel(domain, deploy, "Checks or triggers deployments when configured")
```

## Source map

| Area | Entry points |
| --- | --- |
| Browser bundle and public API | `src/lib/main.js`, `src/lib/services/api/` |
| Svelte application and pages | `src/lib/components/` |
| Configuration and app lifecycle | `src/lib/services/config/`, `src/lib/services/app/` |
| Content, media, search, and workflows | `src/lib/services/contents/`, `assets/`, `search/`, `workflow/` |
| Authentication and provider backends | `src/lib/services/user/`, `src/lib/services/backends/` |
| Deployment integrations and shared helpers | `src/lib/services/deployments/`, `integrations/`, `common/`, `utils/` |
| Localization and shared types | `src/lib/locales/`, `src/lib/types/` |
