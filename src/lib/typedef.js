/* eslint-disable jsdoc/require-property */

/**
 * @typedef {('create'|'update'|'delete'|'uploadMedia'|'deleteMedia'|'openAuthoring')} CommitType
 * Git commit type.
 */

/**
 * @typedef {string} LocaleCode ISO 639-1 locale code like `en`.
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
 * @property {string} [commitAuthor] Git committer’s name or email for a Git backend.
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
 * @typedef {{ [key: string]: ValidityState }} FlattenedEntryContentValidityState Flattened
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
 * @property {object} collection Collection details.
 * @property {string} [fileName] File name. (File collection only)
 * @property {string} [collectionFile] File details. (File collection only)
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
 * @property {string} [commitAuthor] Git committer’s name or email for a Git backend.
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
