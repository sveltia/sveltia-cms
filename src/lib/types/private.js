/**
 * @import { Component } from 'svelte';
 * @import { Writable } from 'svelte/store';
 * @import {
 * BackendName,
 * Collection,
 * CollectionFile,
 * Field,
 * FieldKeyPath,
 * FileExtension,
 * FileFormat,
 * FileFormatter,
 * FileParser,
 * GitBackendName,
 * I18nFileStructure,
 * LocaleCode,
 * RasterImageFormat,
 * SelectField,
 * SiteConfig,
 * } from './public';
 */

/**
 * ISO 639-1 locale code or `_default` for the unspecified default content locale. And `_` is a
 * special one that can be used to hold locale-agnostic data.
 * @typedef {LocaleCode | '_default' | '_'} InternalLocaleCode
 */

/**
 * @typedef {object} SiteConfigExtraProps
 * @property {string} _siteURL `site_url` or the current `location.origin` if it’s not set.
 * @property {string} _baseURL The base/origin of `_siteURL`.
 */

/**
 * Site configuration for internal use.
 * @typedef {SiteConfig & SiteConfigExtraProps} InternalSiteConfig
 */

/**
 * User details. Most properties are from the GitHub API. The properties other than `backendName`
 * are not available for the local backend.
 * @typedef {object} User
 * @property {BackendName | 'local'} backendName Backend name, e.g. `github`.
 * @property {string} [token] Backend OAuth access token.
 * @property {string} [refreshToken] Backend OAuth refresh token.
 * @property {number} [id] User ID.
 * @property {string} [name] User display name.
 * @property {string} [login] User account name.
 * @property {string} [email] User email.
 * @property {string} [avatarURL] Avatar URL.
 * @property {string} [profileURL] Profile URL.
 */

/**
 * User preferences.
 * @typedef {object} Preferences
 * @property {Record<string, string>} [apiKeys] API keys for integrations.
 * @property {Record<string, string>} [logins] Log-in credentials (user name and password) for
 * integrations.
 * @property {string} [theme] Selected UI theme, either `dark` or `light`.
 * @property {InternalLocaleCode} [locale] Selected UI locale, e.g. `en`.
 * @property {boolean} [useDraftBackup] Whether to use the entry draft backup mechanism.
 * @property {boolean} [closeOnSave] Whether to close the entry editor after saving a draft.
 * @property {boolean} [closeWithEscape] Whether to close the entry editor by pressing the Escape
 * key.
 * @property {boolean} [underlineLinks] Whether to always underline links.
 * @property {boolean} [beta] Whether to enable beta features.
 * @property {boolean} [devModeEnabled] Whether to enable the developer mode.
 * @property {string} [deployHookURL] Webhook URL to manually trigger a new deployment on any
 * connected CI/CD provider.
 * @property {string} [defaultTranslationService] Default translation service ID, e.g. `google`.
 */

/**
 * Basic Git repository information retrieved from the config file.
 * @typedef {object} RepositoryInfo
 * @property {GitBackendName | ''} service Repository hosting service name, e.g. `github`.
 * @property {string} label Service label, e.g. `GitHub`.
 * @property {string} owner Owner name, which could be either an organization or individual user.
 * @property {string} repo Repository name.
 * @property {string} [branch] Branch name, e.g. `master` or `main`.
 * @property {string} [repoURL] The repository’s web-accessible URL that can be linked from the CMS
 * UI to the backend service. Git backends only.
 * @property {string} [newPatURL] URL of the page where the user can create a personal access token
 * (PAT). Git backends only.
 * @property {string} [treeBaseURL] Repository’s tree base URL with a branch name. It’s the same as
 * `baseURL` when the default branch is used. Git backends only.
 * @property {string} [blobBaseURL] Repository’s blob base URL with a branch name. Git backends
 * only.
 * @property {boolean} [isSelfHosted] Whether the repository is on a GitHub Enterprise Server or
 * GitLab Self-Managed, or self-hosted Gitea/Forgejo instance.
 * @property {string} [databaseName] IndexedDB database name. Git backends only.
 */

/**
 * API endpoint configuration.
 * @typedef {object} ApiEndpointConfig
 * @property {string} clientId OAuth client ID.
 * @property {string} authURL OAuth authorization URL.
 * @property {string} tokenURL OAuth token URL.
 * @property {string} [authScheme] Authorization scheme. Default is `token`.
 * @property {string} restBaseURL REST API endpoint, e.g. `/api/v3`.
 * @property {string} [graphqlBaseURL] GraphQL API endpoint, e.g. `/api/graphql`.
 */

/**
 * Fetch API options.
 * @typedef {object} FetchApiOptions
 * @property {string} [method] HTTP method. The default is `GET`.
 * @property {Record<string, string>} [headers] HTTP headers. The default is an empty object.
 * @property {any} [body] HTTP body. The default is `null`.
 * @property {boolean} [isGraphQL] Whether the request is a GraphQL request. The default is `false`.
 * @property {'json' | 'text' | 'blob' | 'raw'} [responseType] Response type. The default is `json`,
 * while `raw` returns the `Response` object as is.
 * @property {string} [token] OAuth access token. If not provided, it will be taken from the `user`
 * store.
 * @property {string} [refreshToken] OAuth refresh token. If not provided, it will be taken from the
 * `user` store.
 */

/**
 * Options for a commit operation in the backend.
 * @typedef {object} CommitOptions
 * @property {CommitType} commitType Commit type. Used only for Git backends.
 * @property {InternalCollection} [collection] Collection of the corresponding entry or asset.
 * @property {boolean} [skipCI] Whether to disable automatic deployments for the commit. Used only
 * for Git backends.
 */

/**
 * Results of a commit operation.
 * @typedef {object} CommitResults
 * @property {string} sha Git object ID (SHA-1 hash) of the commit. It’s a pseudo hash for the local
 * backend.
 * @property {CommitAuthor} [author] Git committer info for a Git backend.
 * @property {Date} [date] Commit date for a Git backend.
 * @property {Record<string, { sha: string, file?: Blob }>} files Map of committed files. The key is
 * a file path, and the value is an object containing the Git object ID of the updated file. The
 * blob object is also included for the local backend.
 */

/**
 * Change results containing the commit information, saved entries, and saved assets.
 * @typedef {object} ChangeResults
 * @property {CommitResults} commit Commit results.
 * @property {Entry[]} savedEntries List of saved entries.
 * @property {Asset[]} savedAssets List of saved assets.
 */

/**
 * Options for the `signIn` function on {@link BackendService}.
 * @typedef {object} SignInOptions
 * @property {boolean} auto Whether the sign-in process is automatic.
 * @property {string} [token] User’s locally-cached OAuth access token. Git backends only.
 * @property {string} [refreshToken] User’s locally-cached OAuth refresh token. Git backends only.
 */

/**
 * OAuth access token and refresh token.
 * @typedef {object} AuthTokens
 * @property {string} token User’s locally-cached OAuth access token. Git backends only.
 * @property {string} [refreshToken] User’s locally-cached OAuth refresh token. Git backends only.
 * This is optional because earlier versions of Sveltia CMS did not support refresh tokens.
 */

/**
 * The current status of a Git backend service.
 * @typedef {'none' | 'minor' | 'major' | 'unknown'} BackendServiceStatus
 */

/**
 * Backend service.
 * @typedef {object} BackendService
 * @property {boolean} isGit Whether the backend is a Git service.
 * @property {string} name Service name, e.g. `github`.
 * @property {string} label Service label, e.g. `GitHub`.
 * @property {RepositoryInfo} [repository] Basic repository info. Git and local backends only.
 * @property {string} [statusDashboardURL] URL of status dashboard page of the service. Git backends
 * only.
 * @property {() => Promise<BackendServiceStatus>} [checkStatus] Function to check the backend
 * service’s status. Git backends only.
 * @property {() => RepositoryInfo | undefined} init Function to initialize the backend.
 * @property {(options: SignInOptions) => Promise<User | void>} signIn Function to sign in.
 * @property {() => Promise<void>} signOut Function to sign out.
 * @property {() => Promise<void>} fetchFiles Function to fetch files.
 * @property {(asset: Asset) => Promise<Blob>} [fetchBlob] Function to fetch an asset as a Blob. Git
 * backends only.
 * @property {(changes: FileChange[], options: CommitOptions) => Promise<CommitResults>
 * } commitChanges Function to save file changes, including additions and deletions, and return the
 * commit hash and a map of committed files.
 * @property {() => Promise<Response>} [triggerDeployment] Function to manually trigger a new
 * deployment on any connected CI/CD provider. GitHub only.
 */

/**
 * External media library service, such as a stock asset provider or a cloud storage service.
 * @typedef {object} MediaLibraryService
 * @property {'stock_assets' | 'cloud_storage'} serviceType Service type.
 * @property {string} serviceId Service ID.
 * @property {string} serviceLabel Service label.
 * @property {string} serviceURL Service URL.
 * @property {boolean} showServiceLink Whether to show a link to the service in the media library.
 * @property {boolean} hotlinking Whether to hotlink files.
 * @property {'api_key' | 'password'} authType Authentication type.
 * @property {string} [developerURL] URL of the page that provides the API/developer service.
 * @property {string} [apiKeyURL] URL of the page that provides an API key.
 * @property {RegExp} [apiKeyPattern] API key pattern.
 * @property {() => Promise<boolean>} [init] Function to initialize the service.
 * @property {(userName: string, password: string) => Promise<boolean>} [signIn] Function to sign in
 * to the service.
 * @property {(query: string, options: { kind?: string, apiKey: string, userName?: string,
 * password?: string }) => Promise<ExternalAsset[]>} search Function to search files.
 */

/**
 * Translate function options.
 * @typedef {object} TranslateOptions
 * @property {string} sourceLocale Source language.
 * @property {string} targetLocale Target language.
 * @property {string} apiKey API authentication key.
 */

/**
 * Translation service.
 * @typedef {object} TranslationService
 * @property {string} serviceId Service ID.
 * @property {string} serviceLabel Service label.
 * @property {string} apiLabel API label.
 * @property {string} developerURL URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL URL of the page that provides an API key.
 * @property {RegExp} apiKeyPattern API key pattern.
 * @property {boolean} markdownSupported Whether the service supports markdown content.
 * @property {(locale: string) => string | undefined} getSourceLanguage Get a supported source
 * language that matches the given locale code.
 * @property {(locale: string) => string | undefined} getTargetLanguage Get a supported target
 * language that matches the given locale code.
 * @property {(texts: string[], options: TranslateOptions) => Promise<string[]>} translate Function
 * to translate strings.
 */

/**
 * Git commit author.
 * @typedef {object} CommitAuthor
 * @property {string} name Displayed name.
 * @property {string} email Email.
 * @property {number} [id] User account ID for the Git backend.
 * @property {string} [login] User account name for the Git backend.
 */

/**
 * Git commit type.
 * @typedef {'create' | 'update' | 'delete' | 'uploadMedia' | 'deleteMedia' | 'openAuthoring'
 * } CommitType
 */

/**
 * Basic file type.
 * @typedef {'image' | 'audio' | 'video' | 'document' | 'other'} AssetKind
 */

/**
 * Metadata of a file retrieved from a Git repository.
 * @typedef {object} RepositoryFileMetadata
 * @property {CommitAuthor} [commitAuthor] Git committer info for a Git backend.
 * @property {Date} [commitDate] Commit date for a Git backend.
 */

/**
 * Base file info retrieved from a Git repository.
 * @typedef {object} RepositoryFileInfo
 * @property {string} sha Git object ID (SHA-1 hash) for the file.
 * @property {number} size File size in bytes.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {RepositoryFileMetadata} meta Metadata from the repository.
 */

/**
 * Canonical metadata of entry/asset files as well as text file contents retrieved from a Git
 * repository, keyed with a file path.
 * @typedef {Record<string, RepositoryFileInfo>} RepositoryContentsMap
 */

/**
 * Entry file configuration.
 * @typedef {object} FileConfig
 * @property {FileExtension} extension File extension.
 * @property {FileFormat} format File format.
 * @property {string} [basePath] Normalized `folder` collection option, relative to the project root
 * folder. Entry collection only.
 * @property {string} [subPath] Normalized `path` collection option, relative to `basePath`. Entry
 * collection only.
 * @property {RegExp} [fullPathRegEx] Regular expression that matches full entry paths, taking the
 * i18n structure into account. Entry collection only.
 * @property {string} [fullPath] File path of the default locale. File/singleton collection only.
 * @property {[string, string]} [fmDelimiters] Front matter delimiters.
 * @property {boolean} [yamlQuote] YAML quote configuration. DEPRECATED in favor of the global YAML
 * format options.
 */

/**
 * File info being processed as {@link Entry} or {@link Asset}.
 * @typedef {object} BaseFileListItemProps
 * @property {File} [file] File object. Local backend only.
 * @property {string} path File path.
 * @property {string} name File name, without a path.
 * @property {string} sha Git object ID (SHA-1 hash) for the file.
 * @property {number} size File size in bytes.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {RepositoryFileMetadata} [meta] Metadata from the repository. Git backends only.
 */

/**
 * Collection-level or file-level entry folder information.
 * @typedef {object} EntryFolderInfo
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {Record<InternalLocaleCode, string>} [filePathMap] File path map. The key is a locale,
 * and the value is the corresponding file path. File/singleton collection only.
 * @property {string} [folderPath] Folder path. Entry collection only.
 * @property {Record<InternalLocaleCode, string>} [folderPathMap] Folder path map. Entry collection
 * only. Paths in `folderPathMap` are prefixed with a locale if the `multiple_folders_i18n_root`
 * i18n structure is used, while `folderPath` is a bare collection `folder` path.
 */

/**
 * Global, collection-level, file-level or field-level asset folder information.
 * @typedef {object} AssetFolderInfo
 * @property {string | undefined} collectionName Collection name or `undefined` for the All Assets
 * and Global Assets folders.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {FieldKeyPath} [keyPath] Field key path.
 * @property {string | undefined} internalPath Folder path on the repository/filesystem, relative to
 * the project root directory. It can be a partial path if the collection’s `media_folder` property
 * is a relative path, because the complete path is entry-specific in that case. It will be
 * `undefined` for the All Assets folder.
 * @property {string | undefined} publicPath Absolute folder path that will appear in the public
 * URL, starting with `/`. It can be empty if the collection’s `public_folder` property is a
 * relative path, because the complete path cannot be easily determined. It will be `undefined` for
 * the All Assets folder.
 * @property {boolean} entryRelative Whether the `internalPath` is a relative path from the asset’s
 * associated entry.
 * @property {boolean} hasTemplateTags Whether the `internalPath` contains template tags like
 * `/assets/images/{{slug}}`, which require special handling like `entryRelative`.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */

/**
 * File info being processed as {@link Entry}.
 * @typedef {BaseFileListItemProps & { type: 'entry', folder: EntryFolderInfo }} BaseEntryListItem
 */

/**
 * File info being processed as {@link Asset}.
 * @typedef {BaseFileListItemProps & { type: 'asset', folder: AssetFolderInfo }} BaseAssetListItem
 */

/**
 * File info for Git configuration files, such as `.gitattributes`, `.gitkeep`, etc.
 * @typedef {BaseFileListItemProps & { type: 'config' }} BaseConfigListItem
 */

/**
 * File list item that can be an entry, asset or config file.
 * @typedef {BaseEntryListItem | BaseAssetListItem | BaseConfigListItem} BaseFileListItem
 */

/**
 * @typedef {object} BaseFileList
 * @property {BaseEntryListItem[]} entryFiles Entry file list.
 * @property {BaseAssetListItem[]} assetFiles Asset file list.
 * @property {BaseConfigListItem[]} configFiles Config file list.
 * @property {BaseFileListItem[]} allFiles All the file list combined.
 * @property {number} count Number of `allFiles`.
 */

/**
 * @typedef {object} I18nFileStructureMap
 * @property {boolean} i18nSingleFile Whether the i18n structure is a single file.
 * @property {boolean} i18nMultiFile Whether the i18n structure is multiple files.
 * @property {boolean} i18nMultiFolder Whether the i18n structure is multiple folders.
 * @property {boolean} i18nRootMultiFolder Whether the i18n structure is multiple folders with the
 * locale in the root.
 */

/**
 * Internal i18n configuration of a collection or collection file.
 * @typedef {object} InternalI18nOptions
 * @property {boolean} i18nEnabled Whether i18n is enabled for the collection or collection file.
 * @property {boolean} [saveAllLocales] Whether to save the entries in all the locales. If `false`,
 * editors will be able to disable the output of non-default locales through the UI.
 * @property {InternalLocaleCode[]} allLocales List of all available locales, or `['_default']` if
 * i18n is not enabled.
 * @property {InternalLocaleCode[]} initialLocales Locales to be enabled when creating a new entry
 * draft.
 * @property {InternalLocaleCode} defaultLocale Default locale, or `_default` if i18n is not
 * enabled.
 * @property {I18nFileStructure} structure File structure.
 * @property {I18nFileStructureMap} structureMap I18n structure map.
 * @property {{ key: string, value: string }} canonicalSlug See `canonical_slug` above.
 * @property {boolean} omitDefaultLocaleFromFileName Whether to exclude the default locale from
 * entry filenames.
 */

/**
 * Collection type. A folder collection in Netlify/Decap CMS is called an entry collection in
 * Sveltia CMS. We also support a special singleton collection type that is used for single files
 * not associated with any collection, such as a site configuration file.
 * @typedef {'entry' | 'file' | 'singleton'} CollectionType
 */

/**
 * Extra properties for a collection.
 * @typedef {object} CollectionExtraProps
 * @property {CollectionType} _type Collection type.
 * @property {InternalI18nOptions} _i18n Internal i18n configuration combined with the top-level
 * configuration.
 */

/**
 * Extra properties for an entry collection.
 * @typedef {object} EntryCollectionExtraProps
 * @property {FileConfig} _file Entry file configuration.
 * @property {FieldKeyPath[]} _thumbnailFieldNames A list of field key paths to be used to find an
 * entry thumbnail. See {@link Collection.thumbnail} for details.
 */

/**
 * An entry collection definition.
 * @typedef {Collection & CollectionExtraProps & EntryCollectionExtraProps} EntryCollection
 */

/**
 * Extra properties for a file/singleton collection.
 * @typedef {object} FileCollectionExtraProps
 * @property {Record<string, InternalCollectionFile>} _fileMap File map with normalized collection
 * file definitions. The key is a file identifier.
 */

/**
 * A file/singleton collection definition.
 * @typedef {Collection & CollectionExtraProps & FileCollectionExtraProps} FileCollection
 */

/**
 * A collection definition.
 * @typedef {EntryCollection | FileCollection} InternalCollection
 */

/**
 * Extra properties for a collection file.
 * @typedef {object} ExtraCollectionFileProps
 * @property {FileConfig} _file Entry file configuration.
 * @property {InternalI18nOptions} _i18n Internal i18n configuration combined with the top-level and
 * collection-level configuration.
 */

/**
 * A collection file definition.
 * @typedef {CollectionFile & ExtraCollectionFileProps} InternalCollectionFile
 */

/**
 * Each locale’s content and metadata.
 * @typedef {object} LocalizedEntry
 * @property {string} slug Localized entry slug.
 * @property {string} path File path.
 * @property {FlattenedEntryContent} content Parsed, localized, flattened entry content.
 */

/**
 * Localized entry map keyed with a locale code. When i18n is not enabled with the site config,
 * there will be one single property named `_default`.
 * @typedef {Record<InternalLocaleCode, LocalizedEntry>} LocalizedEntryMap
 */

/**
 * Entry properties.
 * @typedef {object} EntryProps
 * @property {string} id Unique entry ID mainly used on the cross-collection search page, where the
 * `sha`, `slug` or `fileName` property may duplicate.
 * @property {string} slug The slug of the default locale.
 * @property {string} subPath File name for a file/singleton collection, or file path without an
 * extension for an entry collection. Same as `slug` in most cases.
 * @property {LocalizedEntryMap} locales Localized entry map.
 */

/**
 * Entry item.
 * @typedef {EntryProps & RepositoryFileMetadata} Entry
 */

/**
 * Parsed, localized entry content.
 * @typedef {Record<string, any>} RawEntryContent
 */

/**
 * Flattened {@link RawEntryContent} object.
 * @typedef {Record<FieldKeyPath, any>} FlattenedEntryContent - where key is a key path and value is
 * the corresponding field value.
 * @see https://www.npmjs.com/package/flatten
 */

/**
 * Flattened entry file list object, where key is a blob URL, and value is be a file to be uploaded
 * and its target asset folder.
 * @typedef {Record<string, { file: File, folder?: AssetFolderInfo }>} EntryFileMap
 */

/**
 * A legacy version of {@link EntryFileMap} that may be used in backups.
 * @typedef {Record<string, File>} LegacyEntryFileMap
 * @todo Remove this before the 1.0 release.
 */

/**
 * Validation state of a field value. The key is a validation property name, and the value is a
 * boolean. These are the same properties as the native HTML5 constraint validation.
 * @typedef {Record<string, boolean>} EntryValidityState
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */

/**
 * Flattened entry validity state object, where key is a key path, but value will be the value’s
 * validity.
 * @typedef {Record<FieldKeyPath, EntryValidityState>} FlattenedEntryValidityStateMap
 */

/**
 * Flattened entry expander state object, where key is a key path, but value will be the field’s
 * expander UI state.
 * @typedef {Record<FieldKeyPath, boolean>} FlattenedEntryExpanderStateMap
 */

/**
 * Key is a locale code, value is whether to enable/disable the locale’s content output.
 * @typedef {Record<InternalLocaleCode, boolean>} LocaleStateMap
 */

/**
 * Locale slug map.
 * @typedef {Record<InternalLocaleCode, string | undefined>} LocaleSlugMap
 */

/**
 * Locale content map.
 * @typedef {Record<InternalLocaleCode, FlattenedEntryContent>} LocaleContentMap
 */

/**
 * Locale validity map.
 * @typedef {Record<InternalLocaleCode, FlattenedEntryValidityStateMap>} LocaleValidityMap
 */

/**
 * Locale expander map.
 * @typedef {Record<InternalLocaleCode, FlattenedEntryExpanderStateMap>} LocaleExpanderMap
 */

/**
 * Entry draft.
 * @typedef {object} EntryDraft
 * @property {number} createdAt Timestamp of the draft creation.
 * @property {boolean} isNew `true` if it’s a new entry draft in an entry collection.
 * @property {boolean} isIndexFile Whether the corresponding entry is the collection’s special index
 * file used specifically in Hugo.
 * @property {boolean} canPreview Whether the entry draft can show the preview pane.
 * @property {string} collectionName Collection name, or `_singletons` for a singleton file.
 * @property {InternalCollection} collection Collection details, or pseudo-collection for a
 * singleton file.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {InternalCollectionFile} [collectionFile] File details. File/singleton collection only.
 * @property {Field[]} fields Field definition for the collection or collection file. If index file
 * inclusion is enabled and the draft is the index file, it will be the index file’s fields.
 * @property {Entry} [originalEntry] Original entry or `undefined` if it’s a new entry draft.
 * @property {LocaleStateMap} originalLocales Original locale state at the time of draft creation.
 * @property {LocaleStateMap} currentLocales Current locale state.
 * @property {LocaleSlugMap} originalSlugs Key is a locale code, value is the original slug.
 * @property {LocaleSlugMap} currentSlugs Key is a locale code, value is the current slug.
 * @property {LocaleContentMap} originalValues Key is a locale code, value is a flattened object
 * containing all the original field values.
 * @property {LocaleContentMap} currentValues Key is a locale code, value is a flattened, proxified
 * object containing all the current field values while editing.
 * @property {LocaleContentMap} extraValues Key is a locale code, value is a flattened object
 * containing field values in Markdown editor components.
 * @property {EntryFileMap} files Files to be uploaded.
 * @property {LocaleValidityMap} validities Key is a locale code, value is a flattened object
 * containing validation results of all the current field values while editing.
 * @property {LocaleExpanderMap} expanderStates Key is a locale code, value is a flattened object
 * containing the expander UI state.
 * @property {Record<LocaleCode, boolean | 'readonly'>} slugEditor Whether to show the slug editor
 * for each locale.
 */

/**
 * Entry draft backup, which is a subset of {@link EntryDraft} plus metadata.
 * @typedef {object} EntryDraftBackup
 * @property {Date} timestamp When the backup was created.
 * @property {string} siteConfigVersion The SHA-1 hash of the site configuration file, which is used
 * to verify that the backup can be safely restored.
 * @property {string} collectionName Collection name.
 * @property {string} slug Entry slug. An empty string for a new entry.
 * @property {LocaleStateMap} currentLocales Current locale state.
 * @property {LocaleSlugMap} currentSlugs Key is a locale code, value is the current slug.
 * @property {LocaleContentMap} currentValues Key is a locale code, value is a flattened object
 * containing all the current field values while editing.
 * @property {EntryFileMap | LegacyEntryFileMap} files Files to be uploaded.
 */

/**
 * Commit action to perform. It should match GitLab’s commit action types. The `move` action can be
 * combined with a content update, not just a moving/renaming of the file.
 * @typedef {'create' | 'update' | 'move' | 'delete'} CommitAction
 * @see https://docs.gitlab.com/ee/api/commits.html#create-a-commit-with-multiple-files-and-actions
 */

/**
 * File entry to be created, updated or deleted.
 * @typedef {object} FileChange
 * @property {CommitAction} action Commit action.
 * @property {string} path File path.
 * @property {string} [previousPath] Original path to a file being moved. Required when the commit
 * `action` is `move`.
 * @property {string} [previousSha] Git object ID (SHA-1 hash) for the original file being updated,
 * moved or deleted.
 * @property {string} [slug] Entry slug or `undefined` for an asset.
 * @property {string | File} [data] File data. `undefined` for a deleted file, or a file object for
 * a new or updated file. It can also be a string for a text file like Markdown or HTML, which is
 * automatically converted to a Blob.
 */

/**
 * Toast notification state for content/asset updates.
 * @typedef {object} UpdateToastState
 * @property {number} count The number of items.
 * @property {boolean} saved Whether the items have been created or updated.
 * @property {boolean} moved Whether the items have been moved.
 * @property {boolean} renamed Whether the items have been renamed.
 * @property {boolean} deleted Whether the items have been deleted.
 * @property {boolean} published Whether the items have been published. This is `true` only when
 * automatic deployments are enabled and triggered.
 */

/**
 * Asset to be uploaded.
 * @typedef {object} UploadingAssets
 * @property {AssetFolderInfo | undefined} folder Target asset folder info.
 * @property {File[]} files File list.
 * @property {Asset} [originalAsset] Asset to be replaced.
 */

/**
 * Asset to be moved.
 * @typedef {object} MovingAsset
 * @property {Asset} asset Asset.
 * @property {string} path New file path.
 */

/**
 * Asset properties.
 * @typedef {object} AssetProps
 * @property {File} [file] File object. Local backend and unsaved files only.
 * @property {string} [blobURL] Blob URL for the asset. It’s a temporary URL for a remote file being
 * fetched or a local file being uploaded. Or `undefined` if the URL is not generated yet.
 * @property {string} name File name.
 * @property {string} path File path.
 * @property {string} sha Git object ID (SHA-1 hash) for the file.
 * @property {number} size File size in bytes.
 * @property {AssetKind} kind Basic file type.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {AssetFolderInfo} folder Asset folder info.
 * @property {boolean} [unsaved] Whether the asset is unsaved.
 */

/**
 * Asset item.
 * @typedef {AssetProps & RepositoryFileMetadata} Asset
 */

/**
 * Media file dimensions.
 * @typedef {object} MediaDimensions
 * @property {number} width Media width in pixels.
 * @property {number} height Media height in pixels.
 */

/**
 * GPS coordinates.
 * @typedef {object} GeoCoordinates
 * @property {number} latitude Latitude in degrees.
 * @property {number} longitude Longitude in degrees.
 */

/**
 * Asset details.
 * @typedef {object} AssetDetails
 * @property {string} [publicURL] The asset’s public URL on the live site.
 * @property {string} [repoBlobURL] Web-accessible URL on the Git repository. Git and local backends
 * only.
 * @property {MediaDimensions} [dimensions] Media dimensions available for an image or video file.
 * @property {number} [duration] Media duration available for a video or audio file, in seconds.
 * @property {Date} [createdDate] Date and time when the media was created, extracted from an image
 * file’s Exif data.
 * @property {GeoCoordinates} [coordinates] GPS coordinates extracted from an image file’s Exif
 * data.
 * @property {Entry[]} usedEntries List of entries using the asset.
 */

/**
 * Asset on an external media library, such as a stock photo/video or a file on cloud storage.
 * @typedef {object} ExternalAsset
 * @property {string} id Asset ID.
 * @property {string} description Asset description.
 * @property {string} previewURL Thumbnail (small image) URL.
 * @property {string} downloadURL Asset (large image) URL for download.
 * @property {string} fileName File name for download.
 * @property {Date} [lastModified] Last modified date.
 * @property {number} [size] File size in bytes.
 * @property {AssetKind} kind Basic file type.
 * @property {string} [credit] Attribution HTML string, including the photographer name/link and
 * service name/link.
 */

/**
 * Resource selected on `<SelectAssetsDialog>`.
 * @typedef {object} SelectedResource
 * @property {Asset} [asset] One of the existing assets available in the CMS.
 * @property {File} [file] File selected from the user’s computer, or an image file downloaded from
 * a stock asset provider.
 * @property {AssetFolderInfo} [folder] Target asset folder info for the `file`.
 * @property {string} [url] URL from direct input or a hotlinking stock asset.
 * @property {string} [credit] Attribution HTML string for a stock asset, including the photographer
 * name/link and service name/link.
 */

/**
 * Sorting order condition.
 * @typedef {'ascending' | 'descending'} SortOrder
 */

/**
 * Entry/Asset sorting conditions.
 * @typedef {object} SortingConditions
 * @property {string} [key] Target field name.
 * @property {SortOrder} [order] Sort order.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */

/**
 * Entry/Asset filtering conditions.
 * @typedef {object} FilteringConditions
 * @property {FieldKeyPath} field Target field name.
 * @property {string | RegExp | boolean} pattern Regular expression matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * Entry/Asset grouping conditions.
 * @typedef {object} GroupingConditions
 * @property {FieldKeyPath} field Target field name.
 * @property {string | RegExp | boolean} [pattern] Regular expression matching pattern or exact
 * value.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */

/**
 * Entry/Asset list view type.
 * @typedef {'grid' | 'list'} ViewType
 */

/**
 * Entry list view settings.
 * @typedef {object} EntryListView
 * @property {ViewType} type View type.
 * @property {SortingConditions} [sort] Sorting conditions.
 * @property {FilteringConditions} [filter] Filtering conditions. Deprecated in favour of `filters`.
 * @property {FilteringConditions[]} [filters] One or more filtering conditions.
 * @property {GroupingConditions | null} [group] Grouping conditions.
 * @property {boolean} [showMedia] Whether to show the Media pane.
 */

/**
 * Entry editor’s pane settings.
 * @typedef {object} EntryEditorPane
 * @property {'edit' | 'preview'} mode Mode.
 * @property {InternalLocaleCode} locale Locale.
 */

/**
 * Select Assets dialog view settings.
 * @typedef {object} SelectAssetsView
 * @property {ViewType} [type] View type.
 */

/**
 * Entry editor view settings.
 * @typedef {object} EntryEditorView
 * @property {boolean} [showPreview] Whether to show the preview pane.
 * @property {boolean} [syncScrolling] Whether to sync the scrolling position between the editor and
 * preview panes.
 * @property {Record<string, [?EntryEditorPane, ?EntryEditorPane]>} [paneStates] Key is a collection
 * name (and a file name joined by `|`), value is the left and right pane states. The state can be
 * `null` if preview is disabled.
 * @property {SelectAssetsView} [selectAssetsView] View settings for the Select Assets dialog.
 */

/**
 * Asset list view settings.
 * @typedef {object} AssetListView
 * @property {ViewType} type View type.
 * @property {SortingConditions} [sort] Sorting conditions.
 * @property {FilteringConditions} [filter] Filtering conditions.
 * @property {FilteringConditions[]} [filters] Unused.
 * @property {GroupingConditions} [group] Grouping conditions.
 * @property {boolean} [showInfo] Whether to show the Info pane.
 */

/**
 * Custom file format definition.
 * @typedef {object} CustomFileFormat
 * @property {string} extension File extension.
 * @property {FileParser} [parser] Parser method.
 * @property {FileFormatter} [formatter] Formatter method.
 */

/**
 * Key to store the current values in the {@link EntryDraft}. Usually `currentValues`, but can be
 * `extraValues` to store extra values for a Markdown editor component.
 * @typedef {'currentValues' | 'extraValues'} DraftValueStoreKey
 */

/**
 * Context for a field, which may change the behavior of the editor/preview.
 * @typedef {'markdown-editor-component' | 'single-field-list-widget'} WidgetContext
 */

/**
 * Context for a field editor.
 * @typedef {object} FieldEditorContext
 * @property {WidgetContext} [widgetContext] Where the field is rendered.
 * @property {DraftValueStoreKey} valueStoreKey Key to store the values in {@link EntryDraft}.
 * @property {Writable<Component>} [extraHint] Component to render an extra hint in the field
 * editor.
 */

/**
 * Common properties to be passed to a field widget’s editor component.
 * @typedef {object} WidgetEditorProps
 * @property {InternalLocaleCode} locale Current pane’s locale.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {string} fieldId Field ID.
 * @property {string} fieldLabel Field label.
 * @property {boolean} [required] Whether to mark the field required.
 * @property {boolean} [readonly] Whether to mark the field read-only.
 * @property {boolean} [invalid] Whether to mark the field invalid.
 */

/**
 * Common properties to be passed to a field widget’s preview component.
 * @typedef {object} WidgetPreviewProps
 * @property {InternalLocaleCode} locale Current pane’s locale.
 * @property {FieldKeyPath} keyPath Field key path.
 */

/**
 * @typedef {object} DateTimeFieldNormalizedProps
 * @property {string | undefined} format Same as {@link DateTimeFieldProps.format}. If it’s missing,
 * {@link DateTimeFieldProps.date_format} and {@link DateTimeFieldProps.time_format} will be used
 * instead. If these options are also missing, the value will be `undefined`, which makes the output
 * standard ISO 8601 format.
 * @property {boolean} dateOnly Whether the field is date only.
 * @property {boolean} timeOnly Whether the field is time only.
 * @property {boolean} utc Whether the field’s picker is UTC.
 */

/**
 * Select/Relation field editor’s selector properties.
 * @typedef {object} SelectFieldSelectorProps
 * @property {InternalLocaleCode} locale Current pane’s locale.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {string} fieldId Field ID.
 * @property {SelectField} fieldConfig Field configuration.
 * @property {boolean} [required] Whether to mark the field required.
 * @property {boolean} [readonly] Whether to mark the field read-only.
 * @property {boolean} [invalid] Whether to mark the field invalid.
 * @property {SelectFieldSelectorOption[]} options Selector options.
 */

/**
 * Select/Relation field editor’s selector option.
 * @typedef {object} SelectFieldSelectorOption
 * @property {string} label Option label.
 * @property {any} value Option value.
 * @property {string} [searchValue] Option value specifically for filtering.
 */

/**
 * @typedef {object} GetDefaultValueMapFuncArgs
 * @property {Field} fieldConfig Field configuration.
 * @property {FieldKeyPath} keyPath Field key path, e.g. `author.name`.
 * @property {LocaleCode} locale Locale code.
 * @property {string} [dynamicValue] Dynamic default value parsed from the URL query string.
 * @see https://decapcms.org/docs/dynamic-default-values/
 */

/**
 * Options for the `fillTemplate` method.
 * @typedef {object} FillTemplateOptions
 * @property {'preview_path' | 'media_folder'} [type] Slug type.
 * @property {InternalCollection} collection Entry collection.
 * @property {FlattenedEntryContent} content Entry content for the default locale.
 * @property {string} [currentSlug] Entry slug already created for the path.
 * @property {string} [entryFilePath] File path of the entry. Required if the `type` is
 * `preview_path` or `media_folder`.
 * @property {InternalLocaleCode} [locale] Locale. Required if the `type` is `preview_path`.
 * @property {Record<string, string>} [dateTimeParts] Map of date/time parts. Required if the `type`
 * is `preview_path`.
 * @property {boolean} [isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 */

/**
 * Entry slug variants.
 * @typedef {object} EntrySlugVariants
 * @property {string} defaultLocaleSlug Default locale’s entry slug.
 * @property {LocaleSlugMap | undefined} localizedSlugs Localized slug map.
 * @property {string | undefined} canonicalSlug Canonical slug.
 */

/**
 * Supported image fit option.
 * @typedef {'scale-down' | 'contain'} ImageFitOption
 */

/**
 * Image transformation options used internally.
 * @typedef {object} InternalImageTransformationOptions
 * @property {RasterImageFormat} [format] New image format. Default: original format.
 * @property {number} [quality] Image quality between 0 and 100. Default: 85.
 * @property {number} [width] Width. Default: original width.
 * @property {number} [height] Height. Default: original height.
 * @property {ImageFitOption} [fit] Fit option. Default: `scale-down`.
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 * @see https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types
 */

/**
 * Shape of the `processedAssets` store.
 * @typedef {object} ProcessedAssets
 * @property {boolean} processing Whether the files are being processed.
 * @property {File[]} undersizedFiles Files that can be uploaded.
 * @property {File[]} oversizedFiles Files that cannot be uploaded due to the size limit.
 * @property {WeakMap<File, File>} transformedFileMap Mapping of transformed files and the
 * originals.
 */

/**
 * Arguments for the `getField` function.
 * @typedef {object} GetFieldArgs
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] Collection file name. File/singleton collection only.
 * @property {string} [componentName] Markdown editor component name.
 * @property {FlattenedEntryContent} [valueMap] Object holding current entry values. This is
 * required when working with list/object widget variable types.
 * @property {FieldKeyPath} keyPath Key path, e.g. `author.name`.
 * @property {boolean} [isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 */

export {};
