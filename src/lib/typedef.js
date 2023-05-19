/* eslint-disable jsdoc/require-property */

/**
 * @typedef {object} User User details. Most properties are from the GitHub API.
 * @property {string} backendName Backend name, e.g. `github`.
 * @property {string} token Backend OAuth token.
 * @property {string} name User display name.
 * @property {string} login User account name.
 * @property {string} email User email.
 * @property {string} avatar_url Avatar URL.
 * @property {string} html_url Profile URL.
 * @property {object} detail Account detail.
 */

/**
 * @typedef {object} Preferences User preferences.
 * @property {object} [apiKeys] API keys for integrations.
 * @property {string} [theme] Selected UI theme, either `dark` or `light`.
 * @property {string} [locale] Selected UI locale, e.g. `en`.
 * @property {string} [error] Error message.
 */

/**
 * @typedef {('create'|'update'|'delete'|'uploadMedia'|'deleteMedia'|'openAuthoring')} CommitType
 * Git commit type.
 */

/**
 * @typedef {string} LocaleCode ISO 639-1 locale code like `en`.
 */

/**
 * @typedef {('single_file' | 'multiple_files' | 'multiple_folders')} I18nFileStructure
 */

/**
 * @typedef {object} I18nConfig Collection’s i18n configuration.
 * @property {I18nFileStructure} structure File structure.
 * @property {boolean} hasLocales Whether i18n is enabled for the collection.
 * @property {LocaleCode[]} locales List of locales. Can be an empty array if i18n is not enabled.
 * @property {string} [defaultLocale] Default locale. Can be `undefined` if i18n is not
 * enabled.
 */

/**
 * @typedef {object} SiteConfig Global site configuration.
 * @property {object} [backend] Backend config.
 * @property {string} [site_url] Site URL.
 * @property {string} [display_url] Site URL linked from the UI.
 * @property {string} [logo_url] Site logo URL.
 * @property {string} [media_folder] Global internal media folder path.
 * @property {string} [public_folder] Global public media folder path.
 * @property {object} [media_library] External media library configuration.
 * @property {object} [slug] Slug options.
 * @property {Collection[]} [collections] Collections.
 * @property {object} [i18n] Global i18n configuration.
 * @property {string} [publish_mode] Enable Editorial Workflow.
 * @property {boolean} [show_preview_links] Whether to show preview links in Editorial Workflow.
 * @property {string} [error] Custom error message.
 * @see https://decapcms.org/docs/configuration-options/
 */

/**
 * @typedef {object} Collection Collection definition.
 * @property {string} name Collection name.
 * @property {string} [label] UI label.
 * @property {string} [label_singular] Singular UI label.
 * @property {string} [description] Description.
 * @property {string} [icon] Material Symbols icon name.
 * @property {string} [identifier_field] Field name to be used as the ID of a collection item.
 * @property {object[]} [files] File list for a file collection.
 * @property {string} [folder] Folder path for a folder/entry collection.
 * @property {Field[]} [fields] Fields for a folder/entry collection.
 * @property {string} [path] Subfolder path for a folder/entry collection.
 * @property {string} [media_folder] Internal media folder path for a folder/entry collection.
 * @property {string} [public_folder] Public media folder path for a folder/entry collection.
 * @property {object} [filter] Filter for a folder/entry collection.
 * @property {object} [nested] Nested collection config for a folder/entry collection.
 * @property {boolean} [hide] Whether to hide the collection in the UI.
 * @property {boolean} [create] Whether to allow creating items in a folder/entry collection.
 * @property {boolean} [delete] Whether to allow deleting items in a folder/entry collection.
 * @property {boolean} [publish] Whether to hide the publishing control UI for Editorial Workflow.
 * @property {string} [format] File format.
 * @property {string} [extension] File extension.
 * @property {(string|string[])} [frontmatter_delimiter] Delimiters used for the Frontmatter format.
 * @property {string} [slug] Item slug template for a folder/entry collection.
 * @property {string} [summary] Item summary template for a folder/entry collection.
 * @property {string[]} [sortable_fields] Custom sorting fields.
 * @property {object[]} [view_filters] Predefined view filters.
 * @property {object[]} [view_groups] Predefined view groups.
 * @property {(boolean|object)} [i18n] I18n configuration.
 * @property {I18nConfig} _i18n Normalized i18n configuration with the global i18n config combined.
 * @property {string} [preview_path] Preview URL template.
 * @property {string} [preview_path_date_field] Date field used for the preview URL template.
 * @property {object} [editor] Editor view config with the optional `preview` property.
 * @see https://decapcms.org/docs/configuration-options/#collections
 */

/**
 * Common field properties.
 * @typedef {object} CommonFieldProps
 * @property {string} name Field name.
 * @property {string} [label] Field label.
 * @property {string} [comment] Field description.
 * @property {string} [widget] Widget name.
 * @property {any} [default] Default value.
 * @property {boolean} [required] Whether to require input.
 * @property {string[]} [pattern] Validation format.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets
 */

/**
 * Common field definition.
 * @typedef {CommonFieldProps} Field
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {string} collection Referenced collection name.
 * @property {string} [file] Referenced file name for a file collection.
 * @property {string} value_field Name of field to be stored as the value.
 * @property {string[]} search_fields Name of fields to be searched.
 * @property {string[]} [display_fields] Name of fields to be displayed.
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
 * @typedef {object} Entry Entry item.
 * @property {string} sha SHA-1 hash from one of the locales. It serves as the ID of an entry, so it
 * can be used for keyed-`each` in Svelte. Avoid using `slug` as a loop key because different
 * collections could have entries with the same slug.
 * @property {string} slug Entry slug.
 * @property {{ [key: LocaleCode]: LocalizedEntry }} locales Localized content map keyed with a
 * locale code. When i18n is not enabled with the site configuration, there will be one single
 * property named `default`.
 * @property {string} collectionName Collection name.
 * @property {boolean} [isNew] `true` if it’s a new entry draft.
 * @property {string} [fileName] File name for a file collection.
 * @property {{ name: string, email: string }} [commitAuthor] Git committer’s name or email for a
 * Git backend.
 * @property {Date} [commitDate] Commit date for a Git backend.
 */

/**
 * @typedef {object} EntryContent Parsed, localized entry content.
 */

/**
 * @typedef {object} LocalizedEntry Each locale’s content and metadata.
 * @property {EntryContent} content Parsed, localized entry content.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 */

/**
 * @typedef {{ [key: string]: any }} FlattenedEntryContent Flattened {@link EntryContent} object,
 * where key is a key path: dot-connected field name like `author.name` and value is the
 * corresponding field value.
 * @see https://www.npmjs.com/package/flatten
 */

/**
 * @typedef {{ [key: string]: any }} FlattenedEntryContentValidityState Flattened
 * {@link EntryContent} object, where key is a key path, but value will be the value’s validity,
 * using the same properties as the native HTML5 constraint validation.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */

/**
 * @typedef {{ [key: string]: File }} FlattenedEntryContentFileList Flattened {@link EntryContent}
 * object, where key is a key path, but value will be a file to be uploaded.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */

/**
 * @typedef {object} EntryDraft Entry draft.
 * @property {boolean} [isNew] `true` if it’s a new entry draft.
 * @property {string} [slug] Entry slug. Empty if it’s new.
 * @property {string} collectionName Collection name.
 * @property {Collection} collection Collection details.
 * @property {string} [fileName] File name. (File collection only)
 * @property {object} [collectionFile] File details. (File collection only)
 * @property {Entry} [originalEntry] Original entry if it’s not a new entry draft.
 * @property {{ [key: LocaleCode]: FlattenedEntryContent }} originalValues Key is a locale code,
 * value is an flattened object containing all the original field values.
 * @property {{ [key: LocaleCode]: FlattenedEntryContent }} currentValues Key is a locale code,
 * value is an flattened object containing all the current field values while editing.
 * @property {{ [key: LocaleCode]: FlattenedEntryContentFileList }} files Files to be uploaded.
 * @property {{ [key: LocaleCode]: FlattenedEntryContentValidityState }} validities Key is a locale
 * code, value is an flattened object containing validation results of all the current field values
 * while editing.
 */

/**
 * @typedef {object} CollectionAssetPaths Asset path configuration by collection.
 * @property {string} collectionName Collection name or `*` for the global folder.
 * @property {string} internalPath Folder path on the repository/filesystem.
 * @property {string} publicPath Folder path that will appear in the URL.
 */

/**
 * @typedef {object} Asset Asset item.
 * @property {string} name File name.
 * @property {string} path File path.
 * @property {string} sha SHA-1 hash for the file.
 * @property {number} size File size in bytes.
 * @property {string} kind Basic file type, one of `image`, `audio`, `video`, `document` or `other`.
 * @property {?number} text Raw text for a plaintext file, like HTML or Markdown.
 * @property {string} [collectionName] Collection name if it belongs to a collection asset folder.
 * @property {string} folder Path of a collection-specific folder that contains the file or global
 * media folder.
 * @property {{ name: string, email: string }} [commitAuthor] Git committer’s name or email for a
 * Git backend.
 * @property {Date} [commitDate] Commit date for a Git backend.
 * @property {string} [tempURL] Temporary blob URL for a local file being uploaded.
 */

/**
 * @typedef {object} StockPhoto Stock photo.
 * @property {string} id Photo ID.
 * @property {string} description Photo description.
 * @property {string} previewURL Thumbnail image URL.
 * @property {string} downloadURL Large image URL for download.
 * @property {string} fileName File name for download.
 * @property {string} credit Attribution HTML string, including the photographer name/link and
 * service name/link.
 */

/**
 * @typedef {object} SelectedAsset Asset selected on `<SelectAssetsDialog>`.
 * @property {Asset} [asset] One of the existing assets available in the CMS.
 * @property {File} [file] File selected from the user’s computer, or an image file downloaded from
 * a stock photo provider.
 * @property {string} [url] URL from direct input or a hotlinking stock photo.
 * @property {string} [credit] Attribution HTML string for a stock photo, including the photographer
 * name/link and service name/link.
 */

/**
 * @typedef {('ascending' | 'descending')} SortOrder Sorting order condition.
 */

/**
 * @typedef {object} EntryView Entry view settings.
 * @property {('grid' | 'list')} [type] View type.
 * @property {object} [sort] Sorting conditions.
 * @property {string} [sort.key] Target field name.
 * @property {SortOrder} [sort.order] Sort order.
 * @property {object} [filter] Filtering conditions.
 * @property {string} [filter.field] Target field name.
 * @property {string} [filter.pattern] Regex pattern.
 * @property {object} [group] Grouping conditions.
 * @property {string} [group.field] Target field name.
 * @property {string} [group.pattern] Regex pattern.
 * @property {boolean} [showMedia] Whether to show the Media pane.
 */

/**
 * @typedef {object} AssetView Asset view settings.
 * @property {('grid' | 'list')} [type] View type.
 * @property {object} [sort] Sort conditions.
 * @property {string} [sort.key] Target field name.
 * @property {SortOrder} [sort.order] Sort order.
 * @property {object} [filter] Filtering conditions.
 * @property {string} [filter.field] Target field name.
 * @property {string} [filter.pattern] Regex pattern.
 * @property {object} [group] Grouping conditions.
 * @property {string} [group.field] Target field name.
 * @property {string} [group.pattern] Regex pattern.
 * @property {boolean} [showInfo] Whether to show the Info pane.
 */
