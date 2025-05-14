/**
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
 * @property {string} [token] Backend OAuth token.
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
 * @property {boolean} [underlineLinks] Whether to always underline links.
 * @property {boolean} [beta] Whether to enable beta features.
 * @property {boolean} [devModeEnabled] Whether to enable the developer mode.
 * @property {string} [deployHookURL] Webhook URL to manually trigger a new deployment on any
 * connected CI/CD provider.
 */

/**
 * Basic Git repository information retrieved from the config file.
 * @typedef {object} RepositoryInfo
 * @property {GitBackendName | ''} service Repository hosting service name, e.g. `github`.
 * @property {string} label Service label, e.g. `GitHub`.
 * @property {string} owner Owner name, which could be either an organization or individual user.
 * @property {string} repo Repository name.
 * @property {string} [branch] Branch name, e.g. `master` or `main`.
 * @property {string} [baseURL] The repository’s web-accessible URL that can be linked from the CMS
 * UI to the backend service. Git backends only.
 * @property {string} [databaseName] IndexedDB database name. Git backends only.
 * @property {string} [treeBaseURL] Repository’s tree base URL with a branch name. It’s the same as
 * `baseURL` when the default branch is used. Git backends only.
 * @property {string} [blobBaseURL] Repository’s blob base URL with a branch name. Git backends
 * only.
 * @property {boolean} [isSelfHosted] Whether the repository is on a GitHub Enterprise Server or
 * self-hosted GitLab instance.
 */

/**
 * Options for the commit changes operation.
 * @typedef {object} CommitChangesOptions
 * @property {CommitType} commitType Commit type. Used only for Git backends.
 * @property {InternalCollection} [collection] Collection of the corresponding entry or asset.
 * @property {boolean} [skipCI] Whether to disable automatic deployments for the commit. Used only
 * for Git backends.
 */

/**
 * Options for the `signIn` function on {@link BackendService}.
 * @typedef {object} SignInOptions
 * @property {boolean} auto Whether the sign-in process is automatic.
 * @property {string} [token] User’s Locally-cached authentication token. Git backends only.
 */

/**
 * The current status of a Git backend service.
 * @typedef {'none' | 'minor' | 'major' | 'unknown'} BackendServiceStatus
 */

/**
 * Backend service.
 * @typedef {object} BackendService
 * @property {boolean} isRemoteGit Whether the backend is a remote Git service.
 * @property {string} name Service name, e.g. `github`.
 * @property {string} label Service label, e.g. `GitHub`.
 * @property {RepositoryInfo} [repository] Basic repository info. Git and local backends only.
 * @property {string} [statusDashboardURL] URL of status dashboard page of the service. Git backends
 * only.
 * @property {() => Promise<BackendServiceStatus>} [checkStatus] Function to check the backend
 * service’s status. Git backends only.
 * @property {() => RepositoryInfo} [getRepositoryInfo] Function to get the configured repository’s
 * basic information. Git backends only.
 * @property {() => void} init Function to initialize the backend.
 * @property {(options: SignInOptions) => Promise<User | void>} signIn Function to sign in.
 * @property {() => Promise<void>} signOut Function to sign out.
 * @property {() => Promise<void>} fetchFiles Function to fetch files.
 * @property {(asset: Asset) => Promise<Blob>} [fetchBlob] Function to fetch an asset as a Blob. Git
 * backends only.
 * @property {(changes: FileChange[], options: CommitChangesOptions) =>
 * Promise<string | (?File)[] | void>} commitChanges Function to save file changes, including
 * additions and deletions, and return the commit URL (Git backends only) or created/updated files
 * (local backend only).
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
 * Translation service.
 * @typedef {object} TranslationService
 * @property {string} serviceId Service ID.
 * @property {string} serviceLabel Service label.
 * @property {string} developerURL URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL URL of the page that provides an API key.
 * @property {RegExp} apiKeyPattern API key pattern.
 * @property {(locale: string) => string | undefined} getSourceLanguage Get a supported source
 * language that matches the given locale code.
 * @property {(locale: string) => string | undefined} getTargetLanguage Get a supported target
 * language that matches the given locale code.
 * @property {(texts: string[], options: { sourceLocale: string, targetLocale: string,
 * apiKey: string }) => Promise<string[]>} translate Function to translate strings.
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
 * @property {string} sha SHA-1 hash for the file.
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
 * File info being processed as {@link Entry} or {@link Asset}.
 * @typedef {object} BaseFileListItem
 * @property {'entry' | 'asset'} [type] File type handled in the CMS.
 * @property {File} [file] File object. Local backend only.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 * @property {number} [size] File size in bytes.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {RepositoryFileMetadata} [meta] Metadata from the repository. Git backends only.
 */

/**
 * Entry file configuration.
 * @typedef {object} FileConfig
 * @property {FileExtension} extension File extension.
 * @property {FileFormat} format File format.
 * @property {string} [basePath] Normalized `folder` collection option, relative to the project root
 * folder. Folder collection only.
 * @property {string} [subPath] Normalized `path` collection option, relative to `basePath`. Folder
 * collection only.
 * @property {RegExp} [fullPathRegEx] Regular expression that matches full entry paths, taking the
 * i18n structure into account. Folder collection only.
 * @property {string} [fullPath] File path of the default locale. File collection only.
 * @property {[string, string]} [fmDelimiters] Front matter delimiters.
 * @property {boolean} [yamlQuote] YAML quote configuration. DEPRECATED in favor of the global YAML
 * format options.
 */

/**
 * Entry folder configuration by collection.
 * @typedef {object} CollectionEntryFolder
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] File identifier. File collection only.
 * @property {Record<InternalLocaleCode, string>} [filePathMap] File path map. The key is a locale,
 * and the value is the corresponding file path. File collection only.
 * @property {string} [folderPath] Folder path. Entry collection only.
 * @property {Record<InternalLocaleCode, string>} [folderPathMap] Folder path map. Entry collection
 * only. Paths in `folderPathMap` are prefixed with a locale if the `multiple_folders_i18n_root`
 * i18n structure is used, while `folderPath` is a bare collection `folder` path.
 */

/**
 * Asset folder configuration by collection.
 * @typedef {object} CollectionAssetFolder
 * @property {string} [collectionName] Collection name or `undefined` for the global folder.
 * @property {string} internalPath Folder path on the repository/filesystem, relative to the project
 * root directory. It can be a partial path if the collection’s `media_folder` property is a
 * relative path, because the complete path is entry-specific in that case.
 * @property {string} publicPath Absolute folder path that will appear in the public URL, starting
 * with `/`. It can be empty if the collection’s `public_folder` property is a relative path,
 * because the complete path cannot be easily determined.
 * @property {boolean} entryRelative Whether the `internalPath` is a relative path from the asset’s
 * associated entry.
 * @property {boolean} hasTemplateTags Whether the `internalPath` contains template tags like
 * `/assets/images/{{slug}}`, which require special handling like `entryRelative`.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */

/**
 * File info being processed as {@link Entry}.
 * @typedef {BaseFileListItem & { folder: CollectionEntryFolder }} BaseEntryListItem
 */

/**
 * File info being processed as {@link Asset}.
 * @typedef {BaseFileListItem & { folder: CollectionAssetFolder }} BaseAssetListItem
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
 * @property {{ key: string, value: string }} canonicalSlug See `canonical_slug` above.
 * @property {boolean} omitDefaultLocaleFromFileName Whether to exclude the default locale from
 * entry filenames.
 */

/**
 * Collection type. Note: Sveltia CMS calls a folder collection an entry collection.
 * @typedef {'entry' | 'file'} CollectionType
 */

/**
 * Extra properties for a collection.
 * @typedef {object} CollectionExtraProps
 * @property {CollectionType} _type Collection type.
 * @property {InternalI18nOptions} _i18n Internal i18n configuration combined with the top-level
 * configuration.
 * @property {CollectionAssetFolder} [_assetFolder] Asset folder configuration.
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
 * Extra properties for a file collection.
 * @typedef {object} FileCollectionExtraProps
 * @property {Record<string, InternalCollectionFile>} _fileMap File map with normalized collection
 * file definitions. The key is a file identifier.
 */

/**
 * A file collection definition.
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
 * @property {string} sha SHA-1 hash for the file.
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
 * @property {string} sha SHA-1 hash from one of the locales. It serves as the ID of an entry, so it
 * can be used for keyed-`each` in Svelte. Avoid using `slug` as a loop key because different
 * collections could have entries with the same slug.
 * @property {string} slug The slug of the default locale.
 * @property {string} subPath File name for a file collection, or file path without an extension for
 * an entry collection. Same as `slug` in most cases.
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
 * Flattened entry file list object, where key is a uuid, and value is be a file to be uploaded.
 * @typedef {Record<string, File>} EntryFileMap
 */

/**
 * Flattened entry validity state object, where key is a key path, but value will be the value’s
 * validity, using the same properties as the native HTML5 constraint validation.
 * @typedef {Record<FieldKeyPath, Record<string, boolean>>} FlattenedEntryValidityState
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */

/**
 * Flattened entry expander state object, where key is a key path, but value will be the field’s
 * expander UI state.
 * @typedef {Record<FieldKeyPath, boolean>} FlattenedEntryExpanderState
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
 * @typedef {Record<InternalLocaleCode, FlattenedEntryValidityState>} LocaleValidityMap
 */

/**
 * Locale expander map.
 * @typedef {Record<InternalLocaleCode, FlattenedEntryExpanderState>} LocaleExpanderMap
 */

/**
 * Entry draft.
 * @typedef {object} EntryDraft
 * @property {boolean} isNew `true` if it’s a new entry draft in an entry collection.
 * @property {boolean} isIndexFile Whether the corresponding entry is the collection’s special index
 * file used specifically in Hugo.
 * @property {boolean} canPreview Whether the entry draft can show the preview pane.
 * @property {string} collectionName Collection name.
 * @property {InternalCollection} collection Collection details.
 * @property {string} [fileName] File identifier. File collection only.
 * @property {InternalCollectionFile} [collectionFile] File details. File collection only.
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
 * @property {EntryFileMap} files Files to be uploaded.
 * @property {LocaleValidityMap} validities Key is a locale code, value is a flattened object
 * containing validation results of all the current field values while editing.
 * @property {LocaleExpanderMap} expanderStates Key is a locale code, value is a flattened object
 * containing the expander UI state.
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
 * @property {EntryFileMap} files Files to be uploaded.
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
 * @property {string} [slug] Entry slug or `undefined` for an asset.
 * @property {string | File} [data] File data.
 * @property {string} [base64] Base64 of the data.
 */

/**
 * Toast notification state for content/asset updates.
 * @typedef {object} UpdatesToastState
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
 * @property {string | undefined} folder Target folder path.
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
 * @property {File} [file] File object. Local backend only.
 * @property {string} [blobURL] Blob URL for the asset. It’s a temporary URL for a remote file being
 * fetched or a local file being uploaded. Or `undefined` if the URL is not generated yet.
 * @property {string} name File name.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 * @property {number} size File size in bytes.
 * @property {AssetKind} kind Basic file type.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {string} folder Path of a collection-specific folder that contains the file or global
 * media folder.
 */

/**
 * Asset item.
 * @typedef {AssetProps & RepositoryFileMetadata} Asset
 */

/**
 * Asset details.
 * @typedef {object} AssetDetails
 * @property {string} [publicURL] The asset’s public URL on the live site.
 * @property {string} [repoBlobURL] Web-accessible URL on the Git repository. Git and local backends
 * only.
 * @property {{ width: number, height: number }} [dimensions] Media dimensions available for an
 * image, video or audio file.
 * @property {number} [duration] Media duration available for a video or audio file, in seconds.
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
 * Asset selected on `<SelectAssetsDialog>`.
 * @typedef {object} SelectedAsset
 * @property {Asset} [asset] One of the existing assets available in the CMS.
 * @property {File} [file] File selected from the user’s computer, or an image file downloaded from
 * a stock asset provider.
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
 * @property {string} field Target field name.
 * @property {string | boolean} pattern Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * Entry/Asset grouping conditions.
 * @typedef {object} GroupingConditions
 * @property {string} field Target field name.
 * @property {string | boolean} [pattern] Regex matching pattern or exact value.
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
 * @property {GroupingConditions} [group] Grouping conditions.
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
 * Context for a widget, which may change the behavior of the editor/preview.
 * @typedef {'markdown-editor-component' | 'single-field-list-widget'} WidgetContext
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
 * @property {WidgetContext} [context] Where the widget is rendered.
 */

/**
 * Common properties to be passed to a field widget’s preview component.
 * @typedef {object} WidgetPreviewProps
 * @property {InternalLocaleCode} locale Current pane’s locale.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {WidgetContext} [context] Where the widget is rendered.
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
 * @property {string} value Option value.
 * @property {string} [searchValue] Option value specifically for filtering.
 */

/**
 * Options for the `fillSlugTemplate` method.
 * @typedef {object} FillSlugTemplateOptions
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

export {};
