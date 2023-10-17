/* eslint-disable jsdoc/require-property */

/**
 * User details. Most properties are from the GitHub API. The properties other than `backendName`
 * are not available for the local backend.
 * @typedef {object} User
 * @property {string} backendName Backend name, e.g. `github`.
 * @property {string} [token] Backend OAuth token.
 * @property {string} [name] User display name.
 * @property {string} [login] User account name.
 * @property {string} [email] User email.
 * @property {string} [avatar_url] Avatar URL.
 * @property {string} [html_url] Profile URL.
 * @property {object} [detail] Account detail.
 */

/**
 * User preferences.
 * @typedef {object} Preferences
 * @property {{ [key: string]: string }} [apiKeys] API keys for integrations.
 * @property {{ [key: string]: string }} [logins] Log-in credentials (user name and password) for
 * integrations.
 * @property {string} [theme] Selected UI theme, either `dark` or `light`.
 * @property {LocaleCode} [locale] Selected UI locale, e.g. `en`.
 * @property {boolean} [devModeEnabled] Whether to enable the developer mode.
 * @property {string} [error] Error message.
 */

/**
 * Basic Git repository information retrieved from the config file.
 * @typedef {object} RepositoryInfo
 * @property {string} owner Owner name, which could be either an organization or individual user.
 * @property {string} repo Repository name.
 * @property {string} branch Branch name. It’s `master` by default for historical reasons, though
 * the current default branch name on GitHub is `main`.
 * @property {string} url Repository URL that can be linked from the CMS UI to the backend service.
 */

/**
 * Backend service.
 * @typedef {object} BackendService
 * @property {string} label Service label.
 * @property {RepositoryInfo} [repository] Basic repository info. Git backend only.
 * @property {() => void} init Function to initialize the backend.
 * @property {(token: string) => Promise<User>} signIn Function to sign in.
 * @property {() => Promise<void>} signOut Function to sign out.
 * @property {() => Promise<void>} fetchFiles Function to fetch files.
 * @property {(asset: Asset) => Promise<Blob>} [fetchBlob] Function to fetch an asset as a Blob. Git
 * backend only.
 * @property {(items: SavingFile[], options: object) => Promise<void>} saveFiles Function to save
 * files.
 * @property {(items: DeletingFile[], options: object) => Promise<void>} deleteFiles Function to
 * delete files.
 */

/**
 * External media library service, such as a stock photo provider or a cloud storage service.
 * @typedef {object} MediaLibraryService
 * @property {'stock_photos' | 'cloud_storage'} serviceType Service type.
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
 * @property {(query: string, options: { kind: string, apiKey: string, userName: string,
 * password: string }) => Promise<ExternalAsset[]>} search Function to search files.
 */

/**
 * Translation service.
 * @typedef {object} TranslationService
 * @property {string} serviceId Service ID.
 * @property {string} serviceLabel Service label.
 * @property {string} developerURL URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL URL of the page that provides an API key.
 * @property {RegExp} apiKeyPattern API key pattern.
 * @property {string[]} sourceLanguages Supported source languages.
 * @property {string[]} targetLanguages Supported target languages.
 * @property {(texts: string[], options: { sourceLocale: string | undefined, targetLocale: string,
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
 * @typedef {'create' | 'update' | 'delete' | 'uploadMedia' | 'deleteMedia' |
 * 'openAuthoring'} CommitType
 */

/**
 * Basic file type.
 * @typedef {'image' | 'audio' | 'video' | 'document' | 'other'} AssetKind
 */

/**
 * ISO 639-1 locale code like `en`, or `default` for the unspecified default content locale.
 * @typedef {string} LocaleCode
 */

/**
 * Internationalization (i18n) file structure type.
 * @typedef {'single_file' | 'multiple_files' | 'multiple_folders'} I18nFileStructure
 */

/**
 * Entry/asset path configuration.
 * @typedef {object} PathConfig
 * @property {string} collectionName Collection name.
 * @property {string} [internalPath] Root-relative path in the repository.
 * @property {string} [publicPath] Root-relative path in the live site.
 * @property {string} [fileName] File name. (File collection only)
 * @property {string} [file] File path. (File collection only)
 * @property {string} [folder] Folder path. (Folder/entry collection only)
 * @property {string} [extension] File extension.
 * @property {string} [format] File format.
 * @property {string | string[]} [frontmatterDelimiter] Frontmatter delimiter.
 * @property {boolean} [yamlQuote] YAML quote configuration.
 */

/**
 * File info being processed as {@link Entry} or {@link Asset}.
 * @typedef {object} BaseFileListItem
 * @property {string} [type] File type.
 * @property {File} [file] File object. Local backend only.
 * @property {?string} [url] Blob URL for the asset or temporary Blob URL for a local file being
 * uploaded. It can be `null` if the Blob URL is not generated yet.
 * @property {string} [name] File name.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 * @property {number} size File size in bytes.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {object} [meta] Metadata.
 * @property {string} [fetchURL] URL to fetch the file content. Git backend only.
 * @property {string} [repoFileURL] Web-accessible URL on the Git repository. Git backend only.
 * @property {PathConfig} [config] Path configuration.
 */

/**
 * Global or Collection’s unparsed i18n configuration.
 * @typedef {object} RawI18nConfig
 * @property {I18nFileStructure} [structure] File structure.
 * @property {LocaleCode[]} locales List of locales.
 * @property {LocaleCode} [default_locale] Default locale.
 * @see https://decapcms.org/docs/beta-features/#i18n-support
 */

/**
 * Collection’s canonical i18n configuration.
 * @typedef {object} I18nConfig
 * @property {I18nFileStructure} structure File structure.
 * @property {boolean} hasLocales Whether i18n is enabled for the collection.
 * @property {LocaleCode[]} locales List of locales. Can be an empty array if i18n is not enabled.
 * @property {LocaleCode} [defaultLocale] Default locale. Can be `undefined` if i18n is not
 * enabled.
 */

/**
 * Default or external media library configuration.
 * @typedef {object} MediaLibraryConfig
 * @property {string} [name] External library name.
 * @property {object} [config] Config to be passed to the media library.
 * @property {number} [config.max_file_size] Maximum file size in bytes. The default media library
 * only.
 * @property {boolean} [config.multiple] Whether to allow selecting multiple files.
 * @property {boolean} [allow_multiple] Whether to force disabling multiple inputs in the external
 * media library.
 * @see https://decapcms.org/docs/widgets/#file
 * @see https://decapcms.org/docs/widgets/#image
 * @see https://decapcms.org/docs/cloudinary/
 * @see https://decapcms.org/docs/uploadcare/
 * @see https://decapcms.org/docs/beta-features/#image-widget-file-size-limit
 */

/**
 * Global site configuration.
 * @typedef {object} SiteConfig
 * @property {object} [backend] Backend config.
 * @property {string} backend.name Backend name, e.g. `github`.
 * @property {string} [backend.repo] Git organization and repository name joined with `/`.
 * @property {string} [backend.branch] Git branch name.
 * @property {string} [backend.api_root] Git API endpoint.
 * @property {string} [backend.site_domain] Site domain used for OAuth.
 * @property {string} [backend.base_url] OAuth base URL origin.
 * @property {string} [backend.auth_endpoint] OAuth URL path.
 * @property {{ [key: string]: string }} [backend.commit_messages] Commit message map.
 * @property {string} [site_url] Site URL.
 * @property {string} [display_url] Site URL linked from the UI.
 * @property {string} [logo_url] Site logo URL.
 * @property {string} [media_folder] Global internal media folder path.
 * @property {string} [public_folder] Global public media folder path.
 * @property {MediaLibraryConfig} [media_library] media library configuration.
 * @property {object} [slug] Slug options.
 * @property {'unicode' | 'ascii'} [slug.encoding] Encoding option.
 * @property {boolean} [slug.clean_accents] Whether to remove accents.
 * @property {string} [slug.sanitize_replacement] String to replace sanitized characters.
 * @property {Collection[]} [collections] Collections.
 * @property {RawI18nConfig} [i18n] Global i18n configuration.
 * @property {string} [publish_mode] Enable Editorial Workflow.
 * @property {boolean} [show_preview_links] Whether to show preview links in Editorial Workflow.
 * @property {string} [error] Custom error message.
 * @see https://decapcms.org/docs/configuration-options/
 */

/**
 * View filter.
 * @typedef {object} ViewFilter
 * @property {string} label Label.
 * @property {string} field Field name.
 * @property {string | boolean} [pattern] Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * Collection definition.
 * @typedef {object} Collection
 * @property {string} name Collection name.
 * @property {string} [label] UI label.
 * @property {string} [label_singular] Singular UI label.
 * @property {string} [description] Description.
 * @property {string} [icon] Material Symbols icon name.
 * @property {string} [identifier_field] Field name to be used as the ID of a collection item.
 * @property {CollectionFile[]} [files] File list for a file collection.
 * @property {string} [folder] Folder path for a folder/entry collection.
 * @property {Field[]} [fields] Fields for a folder/entry collection.
 * @property {string} [path] Subfolder path for a folder/entry collection.
 * @property {string} [media_folder] Internal media folder path for a folder/entry collection.
 * @property {string} [public_folder] Public media folder path for a folder/entry collection.
 * @property {object} [filter] Filter for a folder/entry collection.
 * @property {string} filter.field Field name.
 * @property {any} filter.value Field value.
 * @property {object} [nested] Nested collection config for a folder/entry collection.
 * @property {boolean} [hide] Whether to hide the collection in the UI.
 * @property {boolean} [create] Whether to allow creating items in a folder/entry collection.
 * @property {boolean} [delete] Whether to allow deleting items in a folder/entry collection.
 * @property {boolean} [publish] Whether to hide the publishing control UI for Editorial Workflow.
 * @property {string} [format] File format.
 * @property {string} [extension] File extension.
 * @property {string | string[]} [frontmatter_delimiter] Delimiters used for the Frontmatter format.
 * @property {boolean} [yaml_quote] Whether to double-quote all the strings values if the YAML
 * format is used for file output. Default: `false`.
 * @property {string} [slug] Item slug template for a folder/entry collection.
 * @property {string} [summary] Item summary template for a folder/entry collection.
 * @property {string[]} [sortable_fields] Custom sorting fields.
 * @property {ViewFilter[]} [view_filters] Predefined view filters.
 * @property {ViewFilter[]} [view_groups] Predefined view groups.
 * @property {RawI18nConfig | boolean} [i18n] I18n configuration.
 * @property {I18nConfig} _i18n Normalized i18n configuration with the global i18n config combined.
 * @property {string} [preview_path] Preview URL template.
 * @property {string} [preview_path_date_field] Date field used for the preview URL template.
 * @property {object} [editor] Editor view configuration.
 * @property {boolean} editor.preview Whether to hide the preview.
 * @see https://decapcms.org/docs/configuration-options/#collections
 */

/**
 * Collection file.
 * @typedef {object} CollectionFile
 * @property {string} label File label.
 * @property {string} name File name.
 * @property {string} file File path.
 * @property {Field[]} fields Fields.
 * @property {object} [editor] Editor view configuration.
 * @property {boolean} editor.preview Whether to hide the preview.
 * @see https://decapcms.org/docs/collection-types/#file-collections
 */

/**
 * Common field properties.
 * @typedef {object} CommonFieldProps
 * @property {string} name Field name.
 * @property {string} [label] Field label.
 * @property {string} [comment] Field description.
 * @property {string} [widget] Widget name.
 * @property {boolean} [required] Whether to require input.
 * @property {string[]} [pattern] Validation format.
 * @property {string} [hint] Value hint to be displayed below the input.
 * @property {boolean | 'translate' | 'duplicate'} [i18n] I18n configuration.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets
 */

/**
 * Boolean field properties.
 * @typedef {object} BooleanFieldProps
 * @property {boolean} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#boolean
 */

/**
 * Boolean field definition.
 * @typedef {CommonFieldProps & BooleanFieldProps} BooleanField
 */

/**
 * Color field properties.
 * @typedef {object} ColorFieldProps
 * @property {string} [default] Default value.
 * @property {boolean} [allowInput] Whether to show the textbox to allow editing the value.
 * @property {boolean} [enableAlpha] Whether to save the alpha channel value.
 * @see https://decapcms.org/docs/widgets/#color
 */

/**
 * Color field definition.
 * @typedef {CommonFieldProps & ColorFieldProps} ColorField
 */

/**
 * DateTime field properties.
 * @typedef {object} DateTimeFieldProps
 * @property {string} [default] Default value.
 * @property {string} [format] Moment.js format to save the value.
 * @property {boolean | string} [date_format] Moment.js format (string) to display the date in the
 * UI, `true` to use the default locale format, or `false` to disable the date input.
 * @property {boolean | string} [time_format] Moment.js format (string) to display the time in the
 * UI, `true` to use the default locale format, or `false` to disable the time input.
 * @property {boolean} [picker_utc] Whether to show the value in UTC.
 * @see https://decapcms.org/docs/widgets/#datetime
 */

/**
 * DateTime field definition.
 * @typedef {CommonFieldProps & DateTimeFieldProps} DateTimeField
 */

/**
 * File field properties.
 * @typedef {object} FileFieldProps
 * @property {string} [default] Default value.
 * @property {boolean} [choose_url] Whether to hide the Insert from URL button.
 * @property {string} [media_folder] Internal media folder path for the field.
 * @property {string} [public_folder] Public media folder path for the field.
 * @property {MediaLibraryConfig} [media_library] media library configuration.
 * @see https://decapcms.org/docs/widgets/#file
 */

/**
 * File field definition.
 * @typedef {CommonFieldProps & FileFieldProps} FileField
 */

/**
 * List field properties.
 * @typedef {object} ListFieldProps
 * @property {string[] | { [key: string]: any }[] | { [key: string]: any }} [default] Default value.
 * @property {boolean} [allow_add] Whether to allow adding new values.
 * @property {boolean} [add_to_top] Whether show the Add button at the top of items.
 * @property {string} [label_singular] Label to be displayed on the Add button.
 * @property {string} [summary] Template of the label to be displayed on the collapsed UI.
 * @property {boolean} [collapsed] Whether to collapse the UI by default.
 * @property {boolean} [minimize_collapsed] Whether to collapse the entire UI.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @property {Field} [field] Single widget to be repeated.
 * @property {Field[]} [fields] Multiple widgets to be repeated.
 * @property {ListFieldType[]} [types] Multiple Object widgets (variable types) to be selected.
 * @property {string} [typeKey] Property name to store the type.
 * @see https://decapcms.org/docs/widgets/#list
 * @see https://decapcms.org/docs/beta-features/#list-widget-variable-types
 */

/**
 * List field variable type.
 * @typedef {object} ListFieldType
 * @property {string} label Label to distinguish the different types.
 * @property {string} name Type name.
 * @property {string} [widget] Widget type. `object` only.
 * @property {string} [summary] Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} fields Nested fields.
 * @see https://decapcms.org/docs/beta-features/#list-widget-variable-types
 */

/**
 * List field definition.
 * @typedef {CommonFieldProps & ListFieldProps} ListField
 */

/**
 * Markdown field properties.
 * @typedef {object} MarkdownFieldProps
 * @property {string} [default] Default value.
 * @property {boolean} [minimal] Whether to minimize the toolbar height.
 * @property {string[]} [buttons] Formatting button list.
 * @property {string[]} [editor_components] Editor button list.
 * @property {string[]} [modes] `raw` and/or `rich_text`.
 * @property {boolean} [sanitize_preview] Whether to sanitize the preview HTML.
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Markdown field definition.
 * @typedef {CommonFieldProps & MarkdownFieldProps} MarkdownField
 */

/**
 * Number field properties.
 * @typedef {object} NumberFieldProps
 * @property {string | number} [default] Default value.
 * @property {'int' | 'float'} [value_type] Type of value to be saved.
 * @property {number} [min] Minimum value.
 * @property {number} [max] Maximum value.
 * @property {number} [step] Number to increase/decrease with the arrow key/button.
 * @see https://decapcms.org/docs/widgets/#number
 */

/**
 * Number field definition.
 * @typedef {CommonFieldProps & NumberFieldProps} NumberField
 */

/**
 * Object field properties.
 * @typedef {object} ObjectFieldProps
 * @property {object} [default] Default values.
 * @property {boolean} [collapsed] Whether to collapse the UI by default.
 * @property {string} [summary] Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} fields Nested fields.
 * @see https://decapcms.org/docs/widgets/#object
 */

/**
 * Object field definition.
 * @typedef {CommonFieldProps & ObjectFieldProps} ObjectField
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {string} collection Referenced collection name.
 * @property {string} [file] Referenced file name for a file collection.
 * @property {string} value_field Name of field to be stored as the value.
 * @property {string[]} search_fields Name of fields to be searched.
 * @property {string[]} [display_fields] Name of fields to be displayed.
 * @property {any} [default] Default value.
 * @property {boolean} [multiple] Whether to accept multiple values.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @see https://decapcms.org/docs/widgets/#relation
 */

/**
 * Relation field definition.
 * @typedef {CommonFieldProps & RelationFieldProps} RelationField
 */

/**
 * Select field properties.
 * @typedef {object} SelectFieldProps
 * @property {string[]} [default] Default values.
 * @property {string[] | { label: string, value: string }[]} options Options.
 * @property {boolean} [multiple] Whether to accept multiple values.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @see https://decapcms.org/docs/widgets/#select
 */

/**
 * Select field definition.
 * @typedef {CommonFieldProps & SelectFieldProps} SelectField
 */

/**
 * String field properties.
 * @typedef {object} StringFieldProps
 * @property {string} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#string
 */

/**
 * String field definition.
 * @typedef {CommonFieldProps & StringFieldProps} StringField
 */

/**
 * Text field properties.
 * @typedef {object} TextFieldProps
 * @property {string} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#text
 */

/**
 * Text field definition.
 * @typedef {CommonFieldProps & TextFieldProps} TextField
 */

/**
 * Any supported {@link Entry} field.
 * @typedef {BooleanField | ColorField | DateTimeField | FileField | ListField | MarkdownField |
 * NumberField | ObjectField | RelationField | SelectField | StringField | TextField} Field
 */

/**
 * Entry item.
 * @typedef {object} Entry
 * @property {string} [id] Unique entry ID mainly used on the cross-collection search page, where
 * the `sha`, `slug` or `fileName` property may duplicate.
 * @property {string} [sha] SHA-1 hash from one of the locales. It serves as the ID of an entry, so
 * it can be used for keyed-`each` in Svelte. Avoid using `slug` as a loop key because different
 * collections could have entries with the same slug.
 * @property {string} [slug] Entry slug.
 * @property {{ [locale: LocaleCode]: LocalizedEntry }} [locales] Localized content map keyed with a
 * locale code. When i18n is not enabled with the site configuration, there will be one single
 * property named `default`.
 * @property {string} collectionName Collection name.
 * @property {string} [fileName] File name for a file collection.
 * @property {CommitAuthor} [commitAuthor] Git committer info for a Git backend.
 * @property {Date} [commitDate] Commit date for a Git backend.
 */

/**
 * Parsed, localized entry content.
 * @typedef {{ [key: string]: any }} EntryContent
 */

/**
 * Each locale’s content and metadata.
 * @typedef {object} LocalizedEntry
 * @property {EntryContent} [content] Parsed, localized entry content.
 * @property {string} [path] File path.
 * @property {string} [sha] SHA-1 hash for the file.
 */

/**
 * Flattened {@link EntryContent} object,
 * @typedef {{ [keyPath: string]: any }} FlattenedEntryContent
 * where key is a key path: dot-connected field name like `author.name` and value is the
 * corresponding field value.
 * @see https://www.npmjs.com/package/flatten
 */

/**
 * Flattened {@link EntryContent} object, where key is a key path, but value will be a file to be
 * uploaded.
 * @typedef {{ [keyPath: string]: File }} FlattenedEntryContentFileList
 */

/**
 * Flattened {@link EntryContent} object, where key is a key path, but value will be the value’s
 * validity, using the same properties as the native HTML5 constraint validation.
 * @typedef {{ [keyPath: string]: { [key: string]: boolean } }} FlattenedEntryContentValidityState
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */

/**
 * Flattened {@link EntryContent} object, where key is a key path, but value will be the value’s
 * UI state.
 * @typedef {{ [keyPath: string]: any }} FlattenedEntryContentViewState
 */

/**
 * Entry draft.
 * @typedef {object} EntryDraft
 * @property {boolean} [isNew] `true` if it’s a new folder collection entry draft.
 * @property {string} [slug] Entry slug. Empty if it’s new.
 * @property {string} collectionName Collection name.
 * @property {Collection} collection Collection details.
 * @property {string} [fileName] File name. (File collection only)
 * @property {CollectionFile} [collectionFile] File details. (File collection only)
 * @property {Entry} [originalEntry] Original entry or `undefined` if it’s a new entry draft.
 * @property {{ [locale: LocaleCode]: FlattenedEntryContent }} originalValues Key is a locale code,
 * value is a flattened object containing all the original field values.
 * @property {{ [locale: LocaleCode]: FlattenedEntryContent }} currentValues Key is a locale code,
 * value is a flattened object containing all the current field values while editing.
 * @property {{ [locale: LocaleCode]: FlattenedEntryContentFileList }} files Files to be uploaded.
 * @property {{ [locale: LocaleCode]: FlattenedEntryContentValidityState }} validities Key is a
 * locale code, value is a flattened object containing validation results of all the current field
 * values while editing.
 * @property {{ [locale: LocaleCode]: FlattenedEntryContentViewState }} viewStates Key is a locale
 * code, value is a flattened object containing the UI state.
 */

/**
 * File to be saved.
 * @typedef {object} SavingFile
 * @property {string} path File path.
 * @property {string} [slug] Entry slug or `undefined` for an asset.
 * @property {string | File} data File data.
 * @property {string} [base64] Base64 of the data.
 */

/**
 * File to be deleted.
 * @typedef {object} DeletingFile
 * @property {string} path File path.
 * @property {string} [slug] Entry slug or `undefined` for an asset.
 */

/**
 * Asset to be uploaded.
 * @typedef {object} UploadingAssets
 * @property {string | undefined} folder Target folder path.
 * @property {File[]} files File list.
 */

/**
 * Asset path configuration by collection.
 * @typedef {object} CollectionAssetPaths
 * @property {?string} collectionName Collection name or `null` for the global folder.
 * @property {string} internalPath Folder path on the repository/filesystem, relative to the project
 * root directory. It can be a partial path if the collection’s `media_folder` property is a
 * relative path, because the complete path is entry-specific in that case.
 * @property {string} publicPath Absolute folder path that will appear in the public URL, starting
 * with `/`. It can be empty if the collection’s `public_folder` property is a relative path,
 * because the complete path cannot be easily determined.
 * @property {boolean} entryRelative Whether the `internalPath` is a relative path from the assets’s
 * associated entry.
 * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
 */

/**
 * Asset item.
 * @typedef {object} Asset
 * @property {File} [file] File object. Local backend only.
 * @property {?string} url Blob URL for the asset or temporary Blob URL for a local file being
 * uploaded. It can be `null` if the Blob URL is not generated yet.
 * @property {string} name File name.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 * @property {number} size File size in bytes.
 * @property {AssetKind} kind Basic file type.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {string} [collectionName] Collection name if it belongs to a collection asset folder.
 * @property {string} folder Path of a collection-specific folder that contains the file or global
 * media folder.
 * @property {CommitAuthor} [commitAuthor] Git committer info for a Git backend.
 * @property {Date} [commitDate] Commit date for a Git backend.
 * @property {string} [fetchURL] URL to fetch the file content. Git backend only.
 * @property {string} [repoFileURL] Web-accessible URL on the Git repository. Git backend only.
 */

/**
 * Asset details.
 * @typedef {object} AssetDetails
 * @property {string} displayURL URL that can be linked in the app UI. It can be a temporary,
 * non-public blob URL for a local file.
 * @property {{ width: number, height: number }} [dimensions] Media dimensions available for an
 * image, video or audio file.
 * @property {number} [duration] Media duration available for a video or audio file, in seconds.
 * @property {Entry[]} usedEntries List of entries using the asset.
 */

/**
 * Asset on an external media library, such as a stock photo or a file on cloud storage.
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
 * a stock photo service.
 * @property {string} [url] URL from direct input or a hotlinking stock photo.
 * @property {string} [credit] Attribution HTML string for a stock photo, including the photographer
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
 * @property {ViewType} [type] View type.
 * @property {SortingConditions} [sort] Sorting conditions.
 * @property {FilteringConditions} [filter] Filtering conditions.
 * @property {GroupingConditions} [group] Grouping conditions.
 * @property {boolean} [showMedia] Whether to show the Media pane.
 */

/**
 * Entry editor’s pane settings.
 * @typedef {object} EntryEditorPane
 * @property {'edit' | 'preview'} mode Mode.
 * @property {LocaleCode} locale Locale.
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
 * @property {{ [collectionName: string]: [?EntryEditorPane, ?EntryEditorPane]}} [paneStates] Key is
 * a collection name, value is the left and right pane states. The state can be `null` if preview is
 * disabled.
 * @property {SelectAssetsView} [selectAssetsView] View settings for the Select Assets dialog.
 */

/**
 * Asset list view settings.
 * @typedef {object} AssetListView
 * @property {ViewType} [type] View type.
 * @property {SortingConditions} [sort] Sorting conditions.
 * @property {FilteringConditions} [filter] Filtering conditions.
 * @property {GroupingConditions} [group] Grouping conditions.
 * @property {boolean} [showInfo] Whether to show the Info pane.
 */
