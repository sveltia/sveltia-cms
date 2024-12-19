/* eslint-disable jsdoc/require-property */

/**
 * User details. Most properties are from the GitHub API. The properties other than `backendName`
 * are not available for the local backend.
 * @typedef {object} User
 * @property {string} backendName - Backend name, e.g. `github`.
 * @property {string} [token] - Backend OAuth token.
 * @property {number} [id] - User ID.
 * @property {string} [name] - User display name.
 * @property {string} [login] - User account name.
 * @property {string} [email] - User email.
 * @property {string} [avatarURL] - Avatar URL.
 * @property {string} [profileURL] - Profile URL.
 */

/**
 * User preferences.
 * @typedef {object} Preferences
 * @property {Record<string, string>} [apiKeys] - API keys for integrations.
 * @property {Record<string, string>} [logins] - Log-in credentials (user name and password) for
 * integrations.
 * @property {string} [theme] - Selected UI theme, either `dark` or `light`.
 * @property {LocaleCode} [locale] - Selected UI locale, e.g. `en`.
 * @property {boolean} [closeOnSave] - Whether to close the entry editor after saving a draft.
 * @property {boolean} [underlineLinks] - Whether to always underline links.
 * @property {boolean} [devModeEnabled] - Whether to enable the developer mode.
 * @property {string} [deployHookURL] - Webhook URL to manually trigger a new deployment on any
 * connected CI/CD provider.
 */

/**
 * Basic Git repository information retrieved from the config file.
 * @typedef {object} RepositoryInfo
 * @property {string} service - Repository hosting service name, e.g. `github`.
 * @property {string} label - Service label, e.g. `GitHub`.
 * @property {string} owner - Owner name, which could be either an organization or individual user.
 * @property {string} repo - Repository name.
 * @property {string} [branch] - Branch name, e.g. `master` or `main`.
 * @property {string} [baseURL] - The repository’s web-accessible URL that can be linked from the
 * CMS UI to the backend service. Git backends only.
 * @property {string} [databaseName] - IndexedDB database name. Git backends only.
 * @property {string} [treeBaseURL] - Repository’s tree base URL with a branch name. It’s the same
 * as `baseURL` when the default branch is used. Git backends only.
 * @property {string} [blobBaseURL] - Repository’s blob base URL with a branch name. Git backends
 * only.
 */

/**
 * Options for the commit changes operation.
 * @typedef {object} CommitChangesOptions
 * @property {CommitType} commitType - Commit type. Used only for Git backends.
 * @property {Collection} [collection] - Collection of the corresponding entry or asset.
 * @property {boolean} [skipCI] - Whether to disable automatic deployments for the commit. Used only
 * for Git backends.
 */

/**
 * Options for the `signIn` function on {@link BackendService}.
 * @typedef {object} SignInOptions
 * @property {boolean} auto - Whether the sign-in process is automatic.
 * @property {string} [token] - User’s Locally-cached authentication token. Git backends only.
 */

/**
 * The current status of a Git backend service.
 * @typedef {'none' | 'minor' | 'major' | 'unknown'} BackendServiceStatus
 */

/**
 * Backend service.
 * @typedef {object} BackendService
 * @property {string} name - Service name, e.g. `github`.
 * @property {string} label - Service label, e.g. `GitHub`.
 * @property {RepositoryInfo} [repository] - Basic repository info. Git and local backends only.
 * @property {string} [statusDashboardURL] - URL of status dashboard page of the service. Git
 * backends only.
 * @property {() => Promise<BackendServiceStatus>} [checkStatus] - Function to check the backend
 * service’s status. Git backends only.
 * @property {() => RepositoryInfo} [getRepositoryInfo] - Function to get the configured
 * repository’s basic information. Git backends only.
 * @property {() => void} init - Function to initialize the backend.
 * @property {(options: SignInOptions) => Promise<User | void>} signIn - Function to sign in.
 * @property {() => Promise<void>} signOut - Function to sign out.
 * @property {() => Promise<void>} fetchFiles - Function to fetch files.
 * @property {(asset: Asset) => Promise<Blob>} [fetchBlob] - Function to fetch an asset as a Blob.
 * Git backends only.
 * @property {(changes: FileChange[], options: CommitChangesOptions) =>
 * Promise<string | (?File)[] | void>} commitChanges - Function to save file changes, including
 * additions and deletions, and return the commit URL (Git backends only) or created/updated files
 * (local backend only).
 * @property {() => Promise<Response>} [triggerDeployment] - Function to manually trigger a new
 * deployment on any connected CI/CD provider. GitHub only.
 */

/**
 * External media library service, such as a stock photo provider or a cloud storage service.
 * @typedef {object} MediaLibraryService
 * @property {'stock_photos' | 'cloud_storage'} serviceType - Service type.
 * @property {string} serviceId - Service ID.
 * @property {string} serviceLabel - Service label.
 * @property {string} serviceURL - Service URL.
 * @property {boolean} showServiceLink - Whether to show a link to the service in the media library.
 * @property {boolean} hotlinking - Whether to hotlink files.
 * @property {'api_key' | 'password'} authType - Authentication type.
 * @property {string} [developerURL] - URL of the page that provides the API/developer service.
 * @property {string} [apiKeyURL] - URL of the page that provides an API key.
 * @property {RegExp} [apiKeyPattern] - API key pattern.
 * @property {() => Promise<boolean>} [init] - Function to initialize the service.
 * @property {(userName: string, password: string) => Promise<boolean>} [signIn] - Function to sign
 * in to the service.
 * @property {(query: string, options: { kind?: string, apiKey: string, userName?: string,
 * password?: string }) => Promise<ExternalAsset[]>} search - Function to search files.
 */

/**
 * Translation service.
 * @typedef {object} TranslationService
 * @property {string} serviceId - Service ID.
 * @property {string} serviceLabel - Service label.
 * @property {string} developerURL - URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL - URL of the page that provides an API key.
 * @property {RegExp} apiKeyPattern - API key pattern.
 * @property {(locale: string) => string | undefined} getSourceLanguage - Get a supported source
 * language that matches the given locale code.
 * @property {(locale: string) => string | undefined} getTargetLanguage - Get a supported target
 * language that matches the given locale code.
 * @property {(texts: string[], options: { sourceLocale: string, targetLocale: string,
 * apiKey: string }) => Promise<string[]>} translate - Function to translate strings.
 */

/**
 * Git commit author.
 * @typedef {object} CommitAuthor
 * @property {string} name - Displayed name.
 * @property {string} email - Email.
 * @property {number} [id] - User account ID for the Git backend.
 * @property {string} [login] - User account name for the Git backend.
 */

/**
 * Git commit type.
 * @typedef {'create' | 'update' | 'delete' | 'uploadMedia' | 'deleteMedia' |
 * 'openAuthoring'} CommitType
 */

/**
 * Basic file type.
 * @typedef {'image' | 'audio' | 'video' | 'document' | 'other'} AssetKind
 */

/**
 * ISO 639-1 locale code like `en`.
 * @typedef {string} StandardLocaleCode
 */

/**
 * ISO 639-1 locale code or `_default` for the unspecified default content locale. And `_` is a
 * special one that can be used to hold locale-agnostic data.
 * @typedef {StandardLocaleCode | '_default' | '_'} LocaleCode
 */

/**
 * Internationalization (i18n) file structure type.
 * @typedef {'single_file' | 'multiple_files' | 'multiple_folders'} I18nFileStructure
 */

/**
 * Metadata of a file retrieved from a Git repository.
 * @typedef {object} RepositoryFileMetadata
 * @property {CommitAuthor} [commitAuthor] - Git committer info for a Git backend.
 * @property {Date} [commitDate] - Commit date for a Git backend.
 */

/**
 * Base file info retrieved from a Git repository.
 * @typedef {object} RepositoryFileInfo
 * @property {string} sha - SHA-1 hash for the file.
 * @property {number} size - File size in bytes.
 * @property {string} [text] - Raw text for a plaintext file, like HTML or Markdown.
 * @property {RepositoryFileMetadata} meta - Metadata from the repository.
 */

/**
 * Canonical metadata of entry/asset files as well as text file contents retrieved from a Git
 * repository, keyed with a file path.
 * @typedef {Record<string, RepositoryFileInfo>} RepositoryContentsMap
 */

/**
 * File info being processed as {@link Entry} or {@link Asset}.
 * @typedef {object} BaseFileListItem
 * @property {'entry' | 'asset'} [type] - File type handled in the CMS.
 * @property {File} [file] - File object. Local backend only.
 * @property {string} path - File path.
 * @property {string} sha - SHA-1 hash for the file.
 * @property {number} [size] - File size in bytes.
 * @property {string} [text] - Raw text for a plaintext file, like HTML or Markdown.
 * @property {RepositoryFileMetadata} [meta] - Metadata from the repository. Git backends only.
 */

/**
 * Supported file extension.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'md' | 'markdown' | 'html' | string} FileExtension
 */

/**
 * Supported Markdown front matter format.
 * @typedef {'yaml-frontmatter' | 'toml-frontmatter' | 'json-frontmatter'} FrontMatterFormat
 */

/**
 * Supported file format.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'frontmatter' | FrontMatterFormat} FileFormat
 */

/**
 * Entry file configuration.
 * @typedef {object} FileConfig
 * @property {FileExtension} extension - File extension.
 * @property {FileFormat} format - File format.
 * @property {string} [basePath] - Normalized `folder` collection option, relative to the project
 * root folder. Folder collection only.
 * @property {string} [subPath] - Normalized `path` collection option, relative to `basePath`.
 * Folder collection only.
 * @property {RegExp} [fullPathRegEx] - Regular expression that matches full entry paths, taking the
 * i18n structure into account. Folder collection only.
 * @property {string} [fullPath] - File path of the default locale. File collection only.
 * @property {[string, string]} [fmDelimiters] - Front matter delimiters.
 * @property {boolean} [yamlQuote] - YAML quote configuration.
 */

/**
 * Entry folder configuration by collection.
 * @typedef {object} CollectionEntryFolder
 * @property {string} collectionName - Collection name.
 * @property {string} [fileName] - File identifier. File collection only.
 * @property {Record<LocaleCode, string>} [filePathMap] - File path map. The key is a locale, and
 * the value is the corresponding file path. File collection only.
 * @property {string} [folderPath] - Folder path. Entry collection only.
 */

/**
 * Asset folder configuration by collection.
 * @typedef {object} CollectionAssetFolder
 * @property {string} [collectionName] - Collection name or `undefined` for the global folder.
 * @property {string} internalPath - Folder path on the repository/filesystem, relative to the
 * project root directory. It can be a partial path if the collection’s `media_folder` property is a
 * relative path, because the complete path is entry-specific in that case.
 * @property {string} publicPath - Absolute folder path that will appear in the public URL, starting
 * with `/`. It can be empty if the collection’s `public_folder` property is a relative path,
 * because the complete path cannot be easily determined.
 * @property {boolean} entryRelative - Whether the `internalPath` is a relative path from the
 * assets’s associated entry.
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
 * Global or Collection’s unparsed i18n configuration.
 * @typedef {object} RawI18nConfig
 * @property {I18nFileStructure} [structure] - File structure.
 * @property {LocaleCode[]} locales - List of locales.
 * @property {LocaleCode} [default_locale] - Default locale.
 * @property {boolean} [save_all_locales] - Whether to save collection entries in all the locales.
 * If `false`, editors will be able to disable the output of non-default locales through the UI. An
 * option suggested in https://github.com/decaporg/decap-cms/issues/6932.
 * @property {{ key: string, value: string }} [canonical_slug] - Property name and value template
 * used to add a canonical slug to entry files, which helps Sveltia CMS and some frameworks to link
 * localized files when entry slugs are localized. The default property name is `translationKey`
 * used in Hugo’s multilingual support, and the default value is the default locale’s slug.
 * @see https://decapcms.org/docs/i18n/
 * @see https://github.com/sveltia/sveltia-cms#localizing-entry-slugs
 */

/**
 * Normalized i18n configuration of a collection or collection file.
 * @typedef {object} I18nConfig
 * @property {boolean} i18nEnabled - Whether i18n is enabled for the collection or collection file.
 * @property {boolean} [saveAllLocales] - Whether to save the entries in all the locales. If
 * `false`, editors will be able to disable the output of non-default locales through the UI.
 * @property {LocaleCode[]} locales - List of locales, or `['_default']` if i18n is not enabled.
 * @property {LocaleCode} defaultLocale - Default locale, or `_default` if i18n is not enabled.
 * @property {I18nFileStructure} structure - File structure.
 * @property {{ key: string, value: string }} canonicalSlug - See `canonical_slug` above.
 */

/**
 * Default or external media library configuration.
 * @typedef {object} MediaLibraryConfig
 * @property {string} [name] - External library name.
 * @property {object} [config] - Config to be passed to the media library.
 * @property {number} [config.max_file_size] - Maximum file size in bytes. The default media library
 * only.
 * @property {boolean} [config.multiple] - Whether to allow selecting multiple files.
 * @property {boolean} [allow_multiple] - Whether to force disabling multiple inputs in the external
 * media library.
 * @see https://decapcms.org/docs/widgets/#file
 * @see https://decapcms.org/docs/widgets/#image
 * @see https://decapcms.org/docs/cloudinary/
 * @see https://decapcms.org/docs/uploadcare/
 * @see https://decapcms.org/docs/widgets/#image
 */

/**
 * Global site configuration.
 * @typedef {object} SiteConfig
 * @property {object} backend - Backend config.
 * @property {string} backend.name - Backend name, e.g. `github`.
 * @property {string} [backend.repo] - Git organization and repository name joined with `/`.
 * @property {string} [backend.branch] - Git branch name.
 * @property {string} [backend.api_root] - Git API endpoint.
 * @property {string} [backend.site_domain] - Site domain used for OAuth.
 * @property {string} [backend.base_url] - OAuth base URL origin.
 * @property {string} [backend.auth_endpoint] - OAuth URL path.
 * @property {'pkce' | 'implicit'} [backend.auth_type] - OAuth authentication method. GitLab only.
 * @property {string} [backend.app_id] - OAuth application ID. GitLab only.
 * @property {Record<string, string>} [backend.commit_messages] - Commit message map.
 * @property {boolean} [backend.automatic_deployments] - Whether to enable or disable automatic
 * deployments with any connected CI/CD provider, such as GitHub Actions or Cloudflare Pages. If
 * `false`, the `[skip ci]` prefix will be added to commit messages. Git backends only.
 * @property {string} [site_url] - Site URL.
 * @property {string} [display_url] - Site URL linked from the UI.
 * @property {string} [logo_url] - Site logo URL.
 * @property {string} media_folder - Global internal media folder path.
 * @property {string} [public_folder] - Global public media folder path.
 * @property {MediaLibraryConfig} [media_library] - Media library configuration.
 * @property {object} [slug] - Slug options.
 * @property {'unicode' | 'ascii'} [slug.encoding] - Encoding option.
 * @property {boolean} [slug.clean_accents] - Whether to remove accents.
 * @property {string} [slug.sanitize_replacement] - String to replace sanitized characters.
 * @property {RawCollection[]} collections - Collections.
 * @property {RawI18nConfig} [i18n] - Global i18n configuration.
 * @property {object} [editor] - Editor view configuration.
 * @property {boolean} editor.preview - Whether to show the preview pane for all the collections.
 * Default: `true`.
 * @property {'simple' | 'editorial_workflow'} [publish_mode] - Enable Editorial Workflow.
 * @property {boolean} [show_preview_links] - Whether to show site preview links.
 * @see https://decapcms.org/docs/configuration-options/
 */

/**
 * View filter.
 * @typedef {object} ViewFilter
 * @property {string} label - Label.
 * @property {string} field - Field name.
 * @property {string | boolean} pattern - Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * A raw collection defined in the configuration file.
 * @typedef {object} RawCollection
 * @property {string} name - Collection name.
 * @property {string} [label] - UI label.
 * @property {string} [label_singular] - Singular UI label.
 * @property {string} [description] - Description.
 * @property {string} [icon] - Material Symbols icon name.
 * @property {string} [identifier_field] - Field name to be used as the ID of a collection item.
 * @property {RawCollectionFile[]} [files] - File list for a file collection.
 * @property {string} [folder] - Folder path for an entry collection.
 * @property {Field[]} [fields] - Fields for an entry collection.
 * @property {string} [path] - Subfolder path for an entry collection.
 * @property {string} [media_folder] - Internal media folder path for an entry collection.
 * @property {string} [public_folder] - Public media folder path for an entry collection.
 * @property {object} [filter] - Filter for an entry collection.
 * @property {string} filter.field - Field name.
 * @property {any | any[]} [filter.value] - Field value. `null` can be used to match an undefined
 * field. Multiple values can be defined with an array.
 * @property {string} [filter.pattern] - Regex matching pattern.
 * @property {object} [nested] - Nested collection config for an entry collection.
 * @property {boolean} [hide] - Whether to hide the collection in the UI.
 * @property {boolean} [create] - Whether to allow creating items in an entry collection.
 * @property {boolean} [delete] - Whether to allow deleting items in an entry collection.
 * @property {boolean} [publish] - Whether to hide the publishing control UI for Editorial Workflow.
 * @property {FileExtension} [extension] - File extension.
 * @property {FileFormat} [format] - File format.
 * @property {string | string[]} [frontmatter_delimiter] - Delimiters used for the front matter
 * format.
 * @property {boolean} [yaml_quote] - Whether to double-quote all the strings values if the YAML
 * format is used for file output. Default: `false`.
 * @property {string} [slug] - Item slug template for an entry collection.
 * @property {number} [slug_length] - The maximum number of characters allowed for an entry slug. An
 * option suggested in https://github.com/decaporg/decap-cms/issues/6987.
 * @property {string} [summary] - Item summary template for an entry collection.
 * @property {string[]} [sortable_fields] - Custom sorting fields.
 * @property {ViewFilter[]} [view_filters] - Predefined view filters.
 * @property {ViewFilter[]} [view_groups] - Predefined view groups.
 * @property {RawI18nConfig | boolean} [i18n] - I18n configuration.
 * @property {string} [preview_path] - Preview URL template.
 * @property {string} [preview_path_date_field] - Date field used for the preview URL template.
 * @property {object} [editor] - Editor view configuration.
 * @property {boolean} editor.preview - Whether to show the preview pane for the collection.
 * Default: `true`.
 * @property {boolean} [divider] - A special option to make this collection a divider UI in the
 * primary sidebar’s collection list. Other options will be ignored, but you may still need a random
 * `name` and an empty `files` list to avoid a config file validation error in VS Code.
 * @property {FieldKeyPath} [thumbnail] - Key path to an entry thumbnail displayed on the entry
 * list. A nested field can be specified using dot notation, e.g. `images.0.src`. If omitted, the
 * `name` of the first image field is used.
 * @see https://decapcms.org/docs/configuration-options/#collections
 */

/**
 * Collection type. Note: Sveltia CMS calls a folder collection an entry collection.
 * @typedef {'entry' | 'file'} CollectionType
 */

/**
 * Extra properties for a collection.
 * @typedef {object} CollectionExtraProps
 * @property {CollectionType} _type - Collection type.
 * @property {I18nConfig} _i18n - Normalized i18n configuration combined with the top-level
 * configuration.
 * @property {CollectionAssetFolder} [_assetFolder] - Asset folder configuration.
 */

/**
 * Extra properties for an entry collection.
 * @typedef {object} EntryCollectionExtraProps
 * @property {FileConfig} _file - Entry file configuration.
 * @property {FieldKeyPath} [_thumbnailFieldName] - Key path to an entry thumbnail. The `thumbnail`
 * option or the first image field name.
 */

/**
 * An entry collection definition.
 * @typedef {RawCollection & CollectionExtraProps & EntryCollectionExtraProps} EntryCollection
 */

/**
 * Extra properties for a file collection.
 * @typedef {object} FileCollectionExtraProps
 * @property {Record<string, CollectionFile>} _fileMap - File map with normalized collection file
 * definitions. The key is a file identifier.
 */

/**
 * A file collection definition.
 * @typedef {RawCollection & CollectionExtraProps & FileCollectionExtraProps} FileCollection
 */

/**
 * A collection definition.
 * @typedef {EntryCollection | FileCollection} Collection
 */

/**
 * A raw collection file defined in the configuration file.
 * @typedef {object} RawCollectionFile
 * @property {string} name - File identifier.
 * @property {string} [label] - File label.
 * @property {string} file - File path.
 * @property {Field[]} fields - Fields.
 * @property {RawI18nConfig | boolean} [i18n] - I18n configuration.
 * @property {string} [preview_path] - Preview URL template.
 * @property {string} [preview_path_date_field] - Date field used for the preview URL template.
 * @property {object} [editor] - Editor view configuration.
 * @property {boolean} editor.preview - Whether to show the preview pane for the collection.
 * Default: `true`.
 * @see https://decapcms.org/docs/collection-types/#file-collections
 */

/**
 * Extra properties for a collection file.
 * @typedef {object} ExtraCollectionFileProps
 * @property {FileConfig} _file - Entry file configuration.
 * @property {I18nConfig} _i18n - Normalized i18n configuration combined with the top-level and
 * collection-level configuration.
 */

/**
 * A collection file definition.
 * @typedef {RawCollectionFile & ExtraCollectionFileProps} CollectionFile
 */

/**
 * Common field properties.
 * @typedef {object} CommonFieldProps
 * @property {string} name - Field name.
 * @property {string} [label] - Field label.
 * @property {string} [comment] - Field description.
 * @property {string} [widget] - Widget name.
 * @property {boolean} [required] - Whether to require input.
 * @property {string[]} [pattern] - Validation format.
 * @property {string} [hint] - Value hint to be displayed below the input.
 * @property {boolean} [preview] - Whether to show the preview of the field. Default: `true`.
 * @property {boolean | 'translate' | 'duplicate'} [i18n] - I18n configuration.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets/#common-widget-options
 */

/**
 * Variable type for List/Object fields.
 * @typedef {object} VariableFieldType
 * @property {string} label - Label to distinguish the different types.
 * @property {string} name - Type name.
 * @property {string} [widget] - Widget type. `object` only.
 * @property {string} [summary] - Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} fields - Nested fields.
 * @see https://decapcms.org/docs/variable-type-widgets/
 */

/**
 * Boolean field properties.
 * @typedef {object} BooleanFieldProps
 * @property {boolean} [default] - Default value.
 * @property {string} [before_input] - An extra label to be displayed before the input UI. Default:
 * an empty string.
 * @property {string} [after_input] - An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#boolean
 */

/**
 * Boolean field definition.
 * @typedef {CommonFieldProps & BooleanFieldProps} BooleanField
 */

/**
 * Color field properties.
 * @typedef {object} ColorFieldProps
 * @property {string} [default] - Default value.
 * @property {boolean} [allowInput] - Whether to show the textbox to allow editing the value.
 * @property {boolean} [enableAlpha] - Whether to save the alpha channel value.
 * @see https://decapcms.org/docs/widgets/#color
 */

/**
 * Color field definition.
 * @typedef {CommonFieldProps & ColorFieldProps} ColorField
 */

/**
 * Compute field properties.
 * @typedef {object} ComputeFieldProps
 * @property {string} value - Value template, like `posts-{{fields.slug}}`.
 */

/**
 * Compute field definition.
 * @typedef {CommonFieldProps & ComputeFieldProps} ComputeField
 */

/**
 * DateTime field properties.
 * @typedef {object} DateTimeFieldProps
 * @property {string} [default] - Default value.
 * @property {string} [format] - Moment.js format to save the value.
 * @property {boolean | string} [date_format] - Moment.js format (string) to display the date in the
 * UI, `true` to use the default locale format, or `false` to disable the date input.
 * @property {boolean | string} [time_format] - Moment.js format (string) to display the time in the
 * UI, `true` to use the default locale format, or `false` to disable the time input.
 * @property {boolean} [picker_utc] - Whether to show the value in UTC.
 * @see https://decapcms.org/docs/widgets/#datetime
 */

/**
 * @typedef {object} DateTimeFieldNormalizedProps
 * @property {string | undefined} format - Same as {@link DateTimeFieldProps.format}.
 * @property {string | boolean | undefined} dateFormat - Same as
 * {@link DateTimeFieldProps.date_format}.
 * @property {string | boolean | undefined} timeFormat - Same as
 * {@link DateTimeFieldProps.time_format}.
 * @property {boolean} dateOnly - Whether the field is date only.
 * @property {boolean} timeOnly - Whether the field is time only.
 * @property {boolean} utc - Whether the field’s picker is UTC.
 */

/**
 * DateTime field definition.
 * @typedef {CommonFieldProps & DateTimeFieldProps} DateTimeField
 */

/**
 * File field properties.
 * @typedef {object} FileFieldProps
 * @property {string} [default] - Default value.
 * @property {boolean} [choose_url] - Whether to hide the Insert from URL button.
 * @property {string} [media_folder] - Internal media folder path for the field.
 * @property {string} [public_folder] - Public media folder path for the field.
 * @property {MediaLibraryConfig} [media_library] - Media library configuration.
 * @see https://decapcms.org/docs/widgets/#file
 */

/**
 * File field definition.
 * @typedef {CommonFieldProps & FileFieldProps} FileField
 */

/**
 * Hidden field properties.
 * @typedef {object} HiddenFieldProps
 * @property {string} [default] - Default value.
 * @see https://decapcms.org/docs/widgets/#hidden
 */

/**
 * Hidden field definition.
 * @typedef {CommonFieldProps & HiddenFieldProps} HiddenField
 */

/**
 * List field properties.
 * @typedef {object} ListFieldProps
 * @property {string[] | Record<string, any>[] | Record<string, any>} [default] - Default value.
 * @property {boolean} [allow_add] - Whether to allow adding new values.
 * @property {boolean} [add_to_top] - Whether show the Add button at the top of items.
 * @property {string} [label_singular] - Label to be displayed on the Add button.
 * @property {string} [summary] - Template of the label to be displayed on the collapsed UI.
 * @property {boolean} [collapsed] - Whether to collapse the UI by default.
 * @property {boolean} [minimize_collapsed] - Whether to collapse the entire UI.
 * @property {number} [min] - Minimum number of items.
 * @property {number} [max] - Maximum number of items.
 * @property {Field} [field] - Single widget to be repeated.
 * @property {Field[]} [fields] - Multiple widgets to be repeated.
 * @property {VariableFieldType[]} [types] - Multiple Object widgets (variable types) to be
 * selected.
 * @property {string} [typeKey] - Property name to store the type.
 * @property {boolean} [root] - Whether to save the field value at the top-level of the data file
 * without the field name. If the `single_file` i18n structure is enabled, the lists will still be
 * saved under locale keys.
 * @see https://decapcms.org/docs/widgets/#list
 * @see https://decapcms.org/docs/variable-type-widgets/
 */

/**
 * List field definition.
 * @typedef {CommonFieldProps & ListFieldProps} ListField
 */

/**
 * Markdown field properties.
 * @typedef {object} MarkdownFieldProps
 * @property {string} [default] - Default value.
 * @property {boolean} [minimal] - Whether to minimize the toolbar height.
 * @property {string[]} [buttons] - Formatting button list.
 * @property {string[]} [editor_components] - Editor button list.
 * @property {string[]} [modes] - `raw` and/or `rich_text`.
 * @property {boolean} [sanitize_preview] - Whether to sanitize the preview HTML.
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Markdown field definition.
 * @typedef {CommonFieldProps & MarkdownFieldProps} MarkdownField
 */

/**
 * Number field properties.
 * @typedef {object} NumberFieldProps
 * @property {string | number} [default] - Default value.
 * @property {'int' | 'float'} [value_type] - Type of value to be saved.
 * @property {number} [min] - Minimum value.
 * @property {number} [max] - Maximum value.
 * @property {number} [step] - Number to increase/decrease with the arrow key/button.
 * @property {string} [before_input] - An extra label to be displayed before the input UI. Default:
 * an empty string.
 * @property {string} [after_input] - An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#number
 */

/**
 * Number field definition.
 * @typedef {CommonFieldProps & NumberFieldProps} NumberField
 */

/**
 * Object field properties.
 * @typedef {object} ObjectFieldProps
 * @property {object} [default] - Default values.
 * @property {boolean} [collapsed] - Whether to collapse the UI by default.
 * @property {string} [summary] - Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} [fields] - Nested fields.
 * @property {VariableFieldType[]} [types] - Multiple Object widgets (variable types) to be
 * selected.
 * @property {string} [typeKey] - Property name to store the type.
 * @see https://decapcms.org/docs/widgets/#object
 */

/**
 * Object field definition.
 * @typedef {CommonFieldProps & ObjectFieldProps} ObjectField
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {string} collection - Referenced collection name.
 * @property {string} [file] - Referenced file identifier for a file collection.
 * @property {string} value_field - Name of field to be stored as the value.
 * @property {string[]} [search_fields] - Name of fields to be searched. It’s a required field as
 * per the Decap CMS document, but we can fall back if the value is missing.
 * @property {string[]} [display_fields] - Name of fields to be displayed.
 * @property {any} [default] - Default value.
 * @property {boolean} [multiple] - Whether to accept multiple values.
 * @property {number} [min] - Minimum number of items.
 * @property {number} [max] - Maximum number of items.
 * @property {{ field: string, values: any[] }[]} [filters] - Entry filters.
 * @property {number} [dropdown_threshold] - Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: 5.
 * @see https://decapcms.org/docs/widgets/#relation
 */

/**
 * Relation field definition.
 * @typedef {CommonFieldProps & RelationFieldProps} RelationField
 */

/**
 * Select field properties.
 * @typedef {object} SelectFieldProps
 * @property {string[]} [default] - Default values.
 * @property {string[] | { label: string, value: string }[]} options - Options.
 * @property {boolean} [multiple] - Whether to accept multiple values.
 * @property {number} [min] - Minimum number of items.
 * @property {number} [max] - Maximum number of items.
 * @property {number} [dropdown_threshold] - Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: 5.
 * @see https://decapcms.org/docs/widgets/#select
 */

/**
 * Select field definition.
 * @typedef {CommonFieldProps & SelectFieldProps} SelectField
 */

/**
 * String field properties.
 * @typedef {object} StringFieldProps
 * @property {string} [default] - Default value.
 * @property {number} [minlength] - Minimum number of characters required for input.
 * @property {number} [maxlength] - Maximum number of characters required for input.
 * @property {'email' | 'url' | 'text'} [type] - Input type.
 * @property {string} [prefix] - A string to be prepended to the value. Default: an empty string.
 * @property {string} [suffix] - A string to be appended to the value. Default: an empty string.
 * @property {string} [before_input] - An extra label to be displayed before the input UI. Default:
 * an empty string.
 * @property {string} [after_input] - An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#string
 */

/**
 * String field definition.
 * @typedef {CommonFieldProps & StringFieldProps} StringField
 */

/**
 * Text field properties.
 * @typedef {object} TextFieldProps
 * @property {string} [default] - Default value.
 * @property {number} [minlength] - Minimum number of characters required for input.
 * @property {number} [maxlength] - Maximum number of characters required for input.
 * @see https://decapcms.org/docs/widgets/#text
 */

/**
 * Text field definition.
 * @typedef {CommonFieldProps & TextFieldProps} TextField
 */

/**
 * UUID field properties.
 * @typedef {object} UuidFieldProps
 * @property {string} [prefix] - A string to be prepended to the value. Default: an empty string.
 * @property {boolean} [use_b32_encoding] - Whether to encode the value with Base32. Default:
 * `false`.
 * @property {boolean} [read_only] - Whether to make the field read-only. Default: `true`.
 * @see https://decapcms.org/docs/widgets/#uuid
 */

/**
 * UUID field definition.
 * @typedef {CommonFieldProps & UuidFieldProps} UuidField
 */

/**
 * Any supported {@link Entry} field.
 * @typedef {BooleanField | ColorField | DateTimeField | FileField | ListField | MarkdownField |
 * NumberField | ObjectField | RelationField | SelectField | StringField | TextField} Field
 */

/**
 * Each locale’s content and metadata.
 * @typedef {object} LocalizedEntry
 * @property {string} slug - Localized entry slug.
 * @property {string} path - File path.
 * @property {string} sha - SHA-1 hash for the file.
 * @property {FlattenedEntryContent} content - Parsed, localized, flattened entry content.
 */

/**
 * Localized entry map keyed with a locale code. When i18n is not enabled with the site config,
 * there will be one single property named `_default`.
 * @typedef {Record<LocaleCode, LocalizedEntry>} LocalizedEntryMap
 */

/**
 * Entry item.
 * @typedef {object} Entry
 * @property {string} id - Unique entry ID mainly used on the cross-collection search page, where
 * the `sha`, `slug` or `fileName` property may duplicate.
 * @property {string} sha - SHA-1 hash from one of the locales. It serves as the ID of an entry, so
 * it can be used for keyed-`each` in Svelte. Avoid using `slug` as a loop key because different
 * collections could have entries with the same slug.
 * @property {string} slug - The slug of the default locale.
 * @property {string} subPath - File name for a file collection, or file path without an extension
 * for an entry collection. Same as `slug` in most cases.
 * @property {LocalizedEntryMap} locales - Localized entry map.
 * @property {CommitAuthor} [commitAuthor] - Git committer info for a Git backend.
 * @property {Date} [commitDate] - Commit date for a Git backend.
 */

/**
 * A field name. It can be written in dot notation if the field is nested, e.g. `author.name`. We
 * call it `keyPath`, which is derived from the IndexedDB API’s `keyPath` property, and use it
 * everywhere, as entry data is managed as a flatten object for easier access.
 * @typedef {string} FieldKeyPath
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
 * @typedef {Record<LocaleCode, boolean>} LocaleStateMap
 */

/**
 * Entry draft.
 * @typedef {object} EntryDraft
 * @property {boolean} isNew - `true` if it’s a new entry draft in an entry collection.
 * @property {string} collectionName - Collection name.
 * @property {Collection} collection - Collection details.
 * @property {string} [fileName] - File identifier. File collection only.
 * @property {CollectionFile} [collectionFile] - File details. File collection only.
 * @property {Entry} [originalEntry] - Original entry or `undefined` if it’s a new entry draft.
 * @property {LocaleStateMap} originalLocales - Original locale state at the time of draft creation.
 * @property {LocaleStateMap} currentLocales - Current locale state.
 * @property {Record<LocaleCode, FlattenedEntryContent>} originalValues - Key is a locale code,
 * value is a flattened object containing all the original field values.
 * @property {Record<LocaleCode, FlattenedEntryContent>} currentValues - Key is a locale code, value
 * is a flattened, proxified object containing all the current field values while editing.
 * @property {EntryFileMap} files - Files to be uploaded.
 * @property {Record<LocaleCode, FlattenedEntryValidityState>} validities - Key is a locale code,
 * value is a flattened object containing validation results of all the current field values while
 * editing.
 * @property {Record<LocaleCode, FlattenedEntryExpanderState>} expanderStates - Key is a locale
 * code, value is a flattened object containing the expander UI state.
 */

/**
 * Entry draft backup, which is a subset of {@link EntryDraft} plus metadata.
 * @typedef {object} EntryDraftBackup
 * @property {Date} timestamp - When the backup was created.
 * @property {string} siteConfigVersion - The SHA-1 hash of the site configuration file, which is
 * used to verify that the backup can be safely restored.
 * @property {string} collectionName - Collection name.
 * @property {string} slug - Entry slug. An empty string for a new entry.
 * @property {LocaleStateMap} currentLocales - Current locale state.
 * @property {Record<LocaleCode, FlattenedEntryContent>} currentValues - Key is a locale code, value
 * is a flattened object containing all the current field values while editing.
 * @property {EntryFileMap} files - Files to be uploaded.
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
 * @property {CommitAction} action - Commit action.
 * @property {string} path - File path.
 * @property {string} [previousPath] - Original path to a file being moved. Required when the commit
 * `action` is `move`.
 * @property {string} [slug] - Entry slug or `undefined` for an asset.
 * @property {string | File} [data] - File data.
 * @property {string} [base64] - Base64 of the data.
 */

/**
 * Toast notification state for content/asset updates.
 * @typedef {object} UpdatesToastState
 * @property {number} count - The number of items.
 * @property {boolean} saved - Whether the items have been created or updated.
 * @property {boolean} moved - Whether the items have been moved.
 * @property {boolean} renamed - Whether the items have been renamed.
 * @property {boolean} deleted - Whether the items have been deleted.
 * @property {boolean} published - Whether the items have been published. This is `true` only when
 * automatic deployments are enabled and triggered.
 */

/**
 * Asset to be uploaded.
 * @typedef {object} UploadingAssets
 * @property {string | undefined} folder - Target folder path.
 * @property {File[]} files - File list.
 * @property {Asset} [originalAsset] - Asset to be replaced.
 */

/**
 * Asset to be moved.
 * @typedef {object} MovingAsset
 * @property {Asset} asset - Asset.
 * @property {string} path - New file path.
 */

/**
 * Asset item.
 * @typedef {object} Asset
 * @property {File} [file] - File object. Local backend only.
 * @property {string} [blobURL] - Blob URL for the asset. It’s a temporary URL for a remote file
 * being fetched or a local file being uploaded. Or `undefined` if the URL is not generated yet.
 * @property {string} name - File name.
 * @property {string} path - File path.
 * @property {string} sha - SHA-1 hash for the file.
 * @property {number} size - File size in bytes.
 * @property {AssetKind} kind - Basic file type.
 * @property {string} [text] - Raw text for a plaintext file, like HTML or Markdown.
 * @property {string} folder - Path of a collection-specific folder that contains the file or global
 * media folder.
 * @property {CommitAuthor} [commitAuthor] - Git committer info for a Git backend.
 * @property {Date} [commitDate] - Commit date for a Git backend.
 */

/**
 * Asset details.
 * @typedef {object} AssetDetails
 * @property {string} [publicURL] - The asset’s public URL on the live site.
 * @property {string} [repoBlobURL] - Web-accessible URL on the Git repository. Git and local
 * backends only.
 * @property {{ width: number, height: number }} [dimensions] - Media dimensions available for an
 * image, video or audio file.
 * @property {number} [duration] - Media duration available for a video or audio file, in seconds.
 * @property {Entry[]} usedEntries - List of entries using the asset.
 */

/**
 * Asset on an external media library, such as a stock photo or a file on cloud storage.
 * @typedef {object} ExternalAsset
 * @property {string} id - Asset ID.
 * @property {string} description - Asset description.
 * @property {string} previewURL - Thumbnail (small image) URL.
 * @property {string} downloadURL - Asset (large image) URL for download.
 * @property {string} fileName - File name for download.
 * @property {Date} [lastModified] - Last modified date.
 * @property {number} [size] - File size in bytes.
 * @property {AssetKind} kind - Basic file type.
 * @property {string} [credit] - Attribution HTML string, including the photographer name/link and
 * service name/link.
 */

/**
 * Asset selected on `<SelectAssetsDialog>`.
 * @typedef {object} SelectedAsset
 * @property {Asset} [asset] - One of the existing assets available in the CMS.
 * @property {File} [file] - File selected from the user’s computer, or an image file downloaded
 * from a stock photo service.
 * @property {string} [url] - URL from direct input or a hotlinking stock photo.
 * @property {string} [credit] - Attribution HTML string for a stock photo, including the
 * photographer name/link and service name/link.
 */

/**
 * Sorting order condition.
 * @typedef {'ascending' | 'descending'} SortOrder
 */

/**
 * Entry/Asset sorting conditions.
 * @typedef {object} SortingConditions
 * @property {string} [key] - Target field name.
 * @property {SortOrder} [order] - Sort order.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */

/**
 * Entry/Asset filtering conditions.
 * @typedef {object} FilteringConditions
 * @property {string} field - Target field name.
 * @property {string | boolean} pattern - Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * Entry/Asset grouping conditions.
 * @typedef {object} GroupingConditions
 * @property {string} field - Target field name.
 * @property {string | boolean} [pattern] - Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */

/**
 * Entry/Asset list view type.
 * @typedef {'grid' | 'list'} ViewType
 */

/**
 * Entry list view settings.
 * @typedef {object} EntryListView
 * @property {ViewType} type - View type.
 * @property {SortingConditions} [sort] - Sorting conditions.
 * @property {FilteringConditions} [filter] - Filtering conditions. Deprecated in favour of
 * `filters`.
 * @property {FilteringConditions[]} [filters] - One or more filtering conditions.
 * @property {GroupingConditions} [group] - Grouping conditions.
 * @property {boolean} [showMedia] - Whether to show the Media pane.
 */

/**
 * Entry editor’s pane settings.
 * @typedef {object} EntryEditorPane
 * @property {'edit' | 'preview'} mode - Mode.
 * @property {LocaleCode} locale - Locale.
 */

/**
 * Select Assets dialog view settings.
 * @typedef {object} SelectAssetsView
 * @property {ViewType} [type] - View type.
 */

/**
 * Entry editor view settings.
 * @typedef {object} EntryEditorView
 * @property {boolean} [showPreview] - Whether to show the preview pane.
 * @property {boolean} [syncScrolling] - Whether to sync the scrolling position between the editor
 * and preview panes.
 * @property {Record<string, [?EntryEditorPane, ?EntryEditorPane]>} [paneStates] - Key is a
 * collection name (and a file name joined by `|`), value is the left and right pane states. The
 * state can be `null` if preview is disabled.
 * @property {SelectAssetsView} [selectAssetsView] - View settings for the Select Assets dialog.
 */

/**
 * Asset list view settings.
 * @typedef {object} AssetListView
 * @property {ViewType} type - View type.
 * @property {SortingConditions} [sort] - Sorting conditions.
 * @property {FilteringConditions} [filter] - Filtering conditions.
 * @property {FilteringConditions[]} [filters] - Unused.
 * @property {GroupingConditions} [group] - Grouping conditions.
 * @property {boolean} [showInfo] - Whether to show the Info pane.
 */

/**
 * Entry file Parser.
 * @typedef {(text: string) => any | Promise<any>} FileParser
 */

/**
 * Entry file formatter.
 * @typedef {(value: any) => string | Promise<string>} FileFormatter
 */

/**
 * Custom file format definition.
 * @typedef {object} CustomFileFormat
 * @property {string} extension - File extension.
 * @property {FileParser} parser - Parser method.
 * @property {FileFormatter} formatter - Formatter method.
 */

/**
 * Custom editor component configuration.
 * @typedef {object} EditorComponentConfiguration
 * @property {string} id - Component name.
 * @property {string} label - UI label.
 * @property {string} [icon] - Material Symbols icon name.
 * @property {{ name: string, label: string, widget: string }[]} fields - Fields to be displayed on
 * the component.
 * @property {RegExp} pattern - Regular expression to search a block from Markdown document.
 * @property {(match: string[]) => { [key: string]: any }} fromBlock - Function to convert the
 * matching result to field properties.
 * @property {(props: { [key: string]: any }) => string} toBlock - Function to convert field
 * properties to Markdown content.
 * @property {(props: { [key: string]: any }) => string} toPreview - Function to convert field
 * properties to field preview.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 */

/**
 * Options for the `fillSlugTemplate` method.
 * @typedef {object} FillSlugTemplateOptions
 * @property {'preview_path' | 'media_folder'} [type] - Slug type.
 * @property {Collection} collection - Entry collection.
 * @property {FlattenedEntryContent} content - Entry content for the default locale.
 * @property {string} [currentSlug] - Entry slug already created for the path.
 * @property {string} [entryFilePath] - File path of the entry. Required if the `type` is
 * `preview_path` or `media_folder`.
 * @property {LocaleCode} [locale] - Locale. Required if the `type` is `preview_path`.
 * @property {Record<string, string>} [dateTimeParts] - Map of date/time parts. Required if the
 * `type` is `preview_path`.
 */
