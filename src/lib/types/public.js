/**
 * @import { ComponentType, ReactElement } from 'react';
 * @import { MapOf } from 'immutable';
 */

/**
 * The following type definitions written in TypeScript-flavored JSDoc are used both internally and
 * externally, covering all the CMS configuration options and JavaScript method arguments available
 * on the `CMS` object. This file is automatically converted into a TypeScript type declaration file
 * (`public.d.ts`) and JSON schema (`sveltia-cms.json`) during the build process (see
 * `vite.config.js`), which are then distributed via npm. The outdated Netlify/Decap CMS equivalents
 * can be found below.
 * @see https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/index.d.ts
 * @see https://www.schemastore.org/netlify.json
 */

/**
 * Standard [IETF locale tag](https://en.wikipedia.org/wiki/IETF_language_tag) like `en` or `en-US`.
 * @typedef {string} LocaleCode
 */

/**
 * An entry field name. It can be written in dot notation like `author.name` if the field is nested
 * with an Object field. For a List subfield, a wildcard can be used like `authors.*.name`. We call
 * this a key path, which is derived from the [IndexedDB API
 * terminology](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology#key_path),
 * and use it everywhere, as entry data is managed as a [flatten
 * object](https://www.npmjs.com/package/flat) for easier access.
 * @typedef {string} FieldKeyPath
 */

/**
 * Cloud media storage name.
 * @typedef {'cloudinary' | 'uploadcare' | 'aws_s3' | 'azure_blob_storage' | 'backblaze_b2' |
 * 'bunny_storage' | 'cloudflare_r2' | 'digitalocean_spaces' | 'scaleway_object_storage' |
 * 'supabase_storage'} CloudMediaLibraryName
 */

/**
 * Supported media storage name.
 * @typedef {'default' | CloudMediaLibraryName | 'stock_assets'} MediaLibraryName
 */

/**
 * Supported raster image format. HEIC (HEIF) is an input format: browsers other than Safari can’t
 * display it, so a `heic` or `raster_image` transformation converts it to a format they can.
 * @typedef {'avif' | 'gif' | 'heic' | 'jpeg' | 'png' | 'webp'} RasterImageFormat
 */

/**
 * Supported vector image format.
 * @typedef {'svg'} VectorImageFormat
 */

/**
 * Supported raster image conversion format. We don’t support AVIF at this time because no browser
 * supports AVIF encoding natively and `@jsquash/avif` is slow. Meanwhile, browsers other than
 * Safari support WebP encoding and `@jsquash/webp` is relatively fast.
 * @typedef {'webp'} RasterImageConversionFormat
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 * @see https://stackoverflow.com/q/61206083
 */

/**
 * Raster image transformation options. See the
 * [documentation](https://sveltiacms.app/en/docs/media#image-optimization) for details.
 * @typedef {object} RasterImageTransformationOptions
 * @property {RasterImageConversionFormat} [format] New format. Default: `webp`. If the browser
 * can’t encode WebP, the image may be saved as PNG instead, with the file extension changed
 * accordingly.
 * @property {number} [quality] Image quality as an integer between 0 and 100. Default: `85`.
 * @property {number} [width] Maximum width in pixels. A wider image is scaled down, keeping the
 * aspect ratio, while a smaller one is never scaled up. Default: original width.
 * @property {number} [height] Maximum height in pixels. A taller image is scaled down, keeping the
 * aspect ratio, while a smaller one is never scaled up. Default: original height.
 */

/**
 * Raster image transformation option map.
 * @typedef {object} RasterImageTransformations
 * @property {RasterImageTransformationOptions} [raster_image] Raster image transformation options
 * that apply to any supported raster image format.
 * @property {RasterImageTransformationOptions} [avif] AVIF image transformation options.
 * @property {RasterImageTransformationOptions} [gif] GIF image transformation options.
 * @property {RasterImageTransformationOptions} [heic] HEIC image transformation options.
 * @property {RasterImageTransformationOptions} [jpeg] JPEG image transformation options.
 * @property {RasterImageTransformationOptions} [png] PNG image transformation options.
 * @property {RasterImageTransformationOptions} [webp] WebP image transformation options.
 */

/**
 * Vector image transformation options.
 * @typedef {object} VectorImageTransformationOptions
 * @property {boolean} [optimize] Whether to optimize the image with [SVGO](https://svgo.dev/),
 * which removes unnecessary data such as comments and editor metadata. Default: `false`.
 */

/**
 * Vector image transformation option map.
 * @typedef {object} VectorImageTransformations
 * @property {VectorImageTransformationOptions} [svg] SVG image transformation options.
 */

/**
 * Image transformation option map.
 * @typedef {RasterImageTransformations & VectorImageTransformations} ImageTransformations
 */

/**
 * File transformation option map.
 * @typedef {ImageTransformations} FileTransformations
 */

/**
 * Options shared by the media libraries that accept file uploads.
 * @typedef {object} SharedMediaLibraryOptions
 * @property {number} [max_file_size] Maximum file size in bytes that can be accepted for uploading.
 * Default: `Infinity`, meaning no limit.
 * @property {boolean} [slugify_filename] Whether to rename an original asset file when saving it,
 * according to the global `slug` option. Default: `false`, meaning that the original file name is
 * kept by default, while Netlify/Decap CMS forces to slugify file names. If set to `true`, for
 * example, `Hello World (1).webp` would be `hello-world-1.webp`.
 * @property {string} [filename_template] Template to rename an uploaded file with, like
 * `{{slug}}-{{uuid_short}}`. It supports the same tags and transformations as the entry `slug`
 * option, including `{{slug}}`, `{{fields.title}}`, date/time tags and `{{uuid}}`, as well as
 * `{{filename}}` and `{{extension}}` for the original file name and extension. The extension is
 * always appended, so the template shouldn’t include it. The values of the tags are slugified, and
 * the entry tags are filled with the default locale’s content when the entry is saved. A file
 * uploaded in the asset library or to a cloud storage service is named right away, without an
 * entry, so only the other tags make sense there; Cloudinary keeps the name as the original file
 * name of an asset whose public ID is generated. A file renamed by hand before saving keeps that
 * name, and a file replacing an existing asset takes over its name. Default: `undefined`, meaning
 * that the original file name is kept, or slugified if the `slugify_filename` option is enabled.
 * @property {FileTransformations} [transformations] File transformation option map. The key is an
 * original format like `png` or `jpeg`. It can also be `raster_image` that matches any supported
 * raster image format. See the
 * [documentation](https://sveltiacms.app/en/docs/media#image-optimization) for details.
 */

/**
 * Configuration for the default media storage.
 * @typedef {object} DefaultMediaLibraryBaseConfig
 * @property {boolean} [multiple] Whether to allow multiple file selection in the media storage.
 * This option is available for compatibility with the Cloudinary and Uploadcare media storage
 * providers, but you can simply use the `multiple` option for the File/Image field types instead,
 * which takes precedence over this option.
 * @see https://decapcms.org/docs/widgets/#File
 * @see https://decapcms.org/docs/widgets/#Image
 * @see https://sveltiacms.app/en/docs/fields/file
 * @see https://sveltiacms.app/en/docs/fields/image
 */

/**
 * Configuration for the default media storage.
 * @typedef {SharedMediaLibraryOptions & DefaultMediaLibraryBaseConfig} DefaultMediaLibraryConfig
 */

/**
 * Options for the default media storage.
 * @typedef {object} DefaultMediaLibrary
 * @property {DefaultMediaLibraryConfig} [config] Configuration for the default media storage.
 */

/**
 * Options for the [Cloudinary media storage](https://sveltiacms.app/en/docs/media/cloudinary).
 * @typedef {object} CloudinaryMediaLibrary
 * @property {boolean} [output_filename_only] Whether to output a file name instead of a full URL.
 * Default: `false`.
 * @property {boolean} [use_transformations] Whether to include transformation segments in an output
 * URL. Default: `true`.
 * @property {Record<string, any>} [config] Options to be passed to the Cloudinary Media Library
 * widget, such as `multiple`, `max_files`, `default_transformations` and `folder`. The `cloud_name`
 * and `api_key` options are required. A field-level `config` is merged over the site-level one, so
 * the credentials only need to be set at the site level. See the [Cloudinary
 * documentation](https://cloudinary.com/documentation/media_library_widget#2_set_the_configuration_options)
 * for a full list of available options. The `multiple` option is overridden by the field’s own
 * `multiple` option, and `max_files` by the field’s `max` option. Default `max_files`: `20`.
 */

/**
 * Settings for the [Uploadcare media storage](https://sveltiacms.app/en/docs/media/uploadcare).
 * @typedef {object} UploadcareMediaLibrarySettings
 * @property {boolean} [autoFilename] Whether to append a file name to an output URL. Default:
 * `false`.
 * @property {string} [defaultOperations] [Transformation
 * operations](https://uploadcare.com/docs/transformations/image/) to be included in the output URL
 * of an image, starting with a slash, e.g. `/resize/800x600/`. Default: none.
 */

/**
 * Options for the [Uploadcare media storage](https://sveltiacms.app/en/docs/media/uploadcare).
 * @typedef {object} UploadcareMediaLibrary
 * @property {Record<string, any>} [config] Options to be passed to Uploadcare, such as `multiple`.
 * The `publicKey` option is required. A field-level `config` is merged over the site-level one, so
 * the key can be set at either the site or field level. The `cdnBase` option sets the CDN origin
 * used in output URLs. Default: the origin of the file URL returned by Uploadcare, typically
 * `https://ucarecdn.com`. See the [Uploadcare
 * documentation](https://uploadcare.com/docs/uploads/file-uploader-options/) for a full list of
 * available options. Some options, including `previewStep`, will be ignored in Sveltia CMS because
 * we use an API-based integration instead of Uploadcare’s deprecated jQuery File Uploader.
 * @property {UploadcareMediaLibrarySettings} [settings] Integration settings. Field-level settings
 * are merged over the site-level ones.
 */

/**
 * Options for S3-compatible media libraries.
 * @typedef {object} S3MediaLibrary
 * @property {string} [access_key_id] AWS access key ID or equivalent (safe to store in config).
 * Required for all services except Bunny Storage, where it defaults to `bucket`, as the storage
 * zone name serves as the access key ID.
 * @property {string} bucket Bucket name. For Bunny Storage, this is the storage zone name.
 * @property {string} [region] Region, e.g. `us-east-1`. Required for Amazon S3, Backblaze B2, Bunny
 * Storage (two-letter storage region code, e.g. `de`), DigitalOcean Spaces and Scaleway Object
 * Storage. For Supabase Storage, set it to the project’s region; it defaults to `us-east-1`.
 * Ignored for Cloudflare R2, which always uses `auto`.
 * @property {string} [account_id] Cloudflare account ID. Required for Cloudflare R2.
 * @property {'default' | 'eu' | 'fedramp'} [jurisdiction] Cloudflare R2 jurisdiction. Required for
 * buckets created in the EU or FedRAMP jurisdictions; the global endpoint returns an error for
 * those buckets. Default: `'default'`.
 * @property {string} [project_id] Supabase project reference ID. Required for Supabase Storage.
 * @property {string} [endpoint] Custom endpoint URL for another S3-compatible service, such as
 * MinIO, configured as `aws_s3`. Ignored for the other services, whose endpoints are derived from
 * their own options.
 * @property {string} [prefix] Path prefix within the bucket, e.g. `uploads/`. A trailing slash is
 * added if missing.
 * @property {boolean} [force_path_style] Whether to use path-style URLs
 * (`https://s3.region.amazonaws.com/bucket/key`) instead of virtual-hosted-style URLs
 * (`https://bucket.s3.region.amazonaws.com/key`) for Amazon S3. Path-style URLs are always used
 * with a custom `endpoint`. Default: `false`.
 * @property {string} [public_url] Base URL for public asset access. When set, asset preview and
 * download URLs are constructed as `{public_url}/{key}` instead of the S3 API endpoint URL.
 * Required for Cloudflare R2 (S3 API endpoint always requires authentication); set to the `r2.dev`
 * development URL (e.g. `https://pub-abcd1234.r2.dev`) or a custom domain. Also required for Bunny
 * Storage; set to the hostname of a pull zone connected to the storage zone (e.g.
 * `https://my-zone.b-cdn.net`) or a custom domain. Optional for Amazon S3 and DigitalOcean Spaces —
 * use when serving assets through a CDN or custom domain (e.g. CloudFront or Route 53 for S3, CDN
 * endpoint for Spaces). Backblaze B2, DigitalOcean Spaces, Scaleway Object Storage and Supabase
 * Storage have a default public URL derived from the other options.
 */

/**
 * Options for the Azure Blob Storage media library. Unlike the S3-compatible services, which are
 * authorized with an access key pair, the Blob service is accessed with a [shared access signature
 * (SAS)](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview) token that
 * each user enters in the CMS’s Settings dialog, so no credential belongs in this configuration.
 * The token needs the Read, Write, Create and List permissions on the container, and the storage
 * account needs a [CORS
 * rule](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)
 * that allows the `GET`, `PUT` and `OPTIONS` methods along with the `x-ms-blob-type` and
 * `content-type` headers from the CMS’s origin.
 * @typedef {object} AzureMediaLibrary
 * @property {string} [account_name] Storage account name. Required unless `endpoint` is given.
 * @property {string} container Blob container name.
 * @property {string} [endpoint] Custom Blob service endpoint including the account, such as a
 * custom domain or the Azurite emulator URL. Overrides `account_name`.
 * @property {string} [prefix] Path prefix within the container, e.g. `uploads/`. A trailing slash
 * is added if missing.
 * @property {string} [public_url] Base URL for public asset access. When set, asset download URLs
 * are constructed as `{public_url}/{blob_name}` instead of the Blob service URL. Required unless
 * the container allows anonymous read access, because the URL stored in an entry can’t contain the
 * SAS token, which expires. Set it to an Azure CDN or Front Door endpoint, or a custom domain.
 */

/**
 * Name of supported stock photo/video provider.
 * @typedef {'pexels' | 'picsum' | 'pixabay' | 'unsplash'} StockAssetProviderName
 */

/**
 * Options for the unified stock photo/video providers.
 * @typedef {object} StockMediaLibrary
 * @property {StockAssetProviderName[]} [providers] Enabled stock photo/video providers. The stock
 * photo/video section in the asset browser is hidden if an empty array is given. Default: all
 * supported providers.
 */

/**
 * Supported cloud media storage options.
 * @typedef {CloudinaryMediaLibrary | UploadcareMediaLibrary | S3MediaLibrary | AzureMediaLibrary}
 * CloudMediaLibrary
 */

/**
 * Supported [media storage](https://sveltiacms.app/en/docs/media).
 * @typedef {DefaultMediaLibrary | CloudMediaLibrary | StockMediaLibrary} MediaLibrary
 */

/**
 * Unified media storage option that supports multiple storage providers. See the
 * [documentation](https://sveltiacms.app/en/docs/media#configuration) for details.
 * @typedef {object} MediaLibraries
 * @property {SharedMediaLibraryOptions} [all] Default options that apply to the default media
 * storage and to files uploaded to the cloud storage services, except for Cloudinary, which uses
 * its own widget. For the default media storage, these options can be overridden by the options in
 * `default.config` at the same level. Field-level `all` options take precedence over global
 * `default.config` options.
 * @property {DefaultMediaLibrary | false} [default] Options for the default media storage. Set to
 * `false` to explicitly disable the default (internal) storage.
 * @property {CloudinaryMediaLibrary | false} [cloudinary] Options for the Cloudinary media storage.
 * Set to `false` to explicitly disable.
 * @property {UploadcareMediaLibrary | false} [uploadcare] Options for the Uploadcare media storage.
 * Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [aws_s3] Options for the Amazon S3 media storage. Set to
 * `false` to explicitly disable.
 * @property {AzureMediaLibrary | false} [azure_blob_storage] Options for the Azure Blob Storage
 * media storage. Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [cloudflare_r2] Options for the Cloudflare R2 media storage.
 * Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [digitalocean_spaces] Options for the DigitalOcean Spaces
 * media storage. Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [backblaze_b2] Options for the Backblaze B2 media storage. Set
 * to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [bunny_storage] Options for the Bunny Storage media storage.
 * Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [scaleway_object_storage] Options for the Scaleway Object
 * Storage media storage. Set to `false` to explicitly disable.
 * @property {S3MediaLibrary | false} [supabase_storage] Options for the Supabase Storage media
 * storage. Set to `false` to explicitly disable.
 * @property {StockMediaLibrary | false} [stock_assets] Options for the unified stock photo/video
 * media library. Set to `false` to explicitly disable.
 */

/**
 * Parsed, localized entry content.
 * @typedef {Record<string, any>} RawEntryContent
 */

/**
 * Common field properties that are shared among all field types, except for the `i18n` option,
 * whose accepted values depend on the field type.
 * @typedef {object} BaseFieldProps
 * @property {string} name Unique identifier for the field among its sibling fields. It cannot
 * contain spaces, periods, asterisks, colons or angle brackets.
 * @property {string} [label] Label of the field to be displayed in the editor UI. Default: `name`
 * field value.
 * @property {string} [comment] Comment to be written before the field in a YAML file or YAML front
 * matter, for developers reading the file. It’s not displayed in the editor UI; use `hint` for
 * that. A line break can be given as `\n`. The comment on a subfield of an Object field is written
 * before the subfield, while the one on a subfield of a List field or a variable-type Object field
 * is ignored. TOML and JSON files don’t support comments.
 */

/**
 * Field-level i18n option shared among most field types.
 * @typedef {object} FieldI18nProps
 * @property {boolean | 'duplicate' | 'translate' | 'none'} [i18n] Whether to enable the editor UI
 * in locales other than the default locale. Default: `false`, or `duplicate` for a subfield of a
 * field using `duplicate`. `duplicate` makes the field read-only in non-default locales and
 * automatically copies the default locale’s value to them. `translate` and `none` are aliases of
 * `true` and `false`, respectively. This option only works
 * when i18n is set up with the global and collection-level `i18n` option. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/options#field-level-configuration) for
 * details.
 */

/**
 * Field-level i18n option for the KeyValue field, which supports the `duplicate_keys` strategy in
 * addition to the common ones.
 * @typedef {object} KeyValueFieldI18nProps
 * @property {boolean | 'duplicate' | 'duplicate_keys' | 'translate' | 'none'} [i18n] Whether to
 * enable the editor UI in locales other than the default locale. Default: `false`, or `duplicate`
 * for a subfield of a field using `duplicate`. `duplicate` makes the field read-only in non-default
 * locales and automatically copies the default locale’s key-value pairs to them. `duplicate_keys`
 * copies the keys only: the keys are read-only in non-default locales and kept in sync with the
 * default locale, while the values can be edited in each locale. `translate` and `none` are aliases
 * of `true` and `false`, respectively. This option only works when i18n is set up with the global
 * and collection-level `i18n` option. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/options#field-level-configuration) for
 * details.
 */

/**
 * Common field properties that are shared among all field types.
 * @typedef {BaseFieldProps & FieldI18nProps} CommonFieldProps
 */

/**
 * Properties for a field that is visible in the editor UI.
 * @typedef {object} VisibleFieldProps
 * @property {string} [hint] Help message to be displayed below the input UI. Limited Markdown
 * formatting is supported: bold, italic, strikethrough, inline code and links. A line break can be
 * given as a literal backslash followed by `n`, e.g. `\n` in a plain or single-quoted YAML string;
 * in JSON or a double-quoted string, the backslash itself has to be escaped. The hint is not
 * displayed while the field is read-only.
 * @property {boolean} [preview] Whether to show the preview of the field. Default: `true`.
 * @property {boolean | LocaleCode[]} [required] Whether to make data input on the field required.
 * Default: `true`. This option also affects data output if the `omit_empty_optional_fields` global
 * output option is `true`. If i18n is enabled and the field doesn’t require input in all locales,
 * required locale codes can be passed as an array like `[en, fr]` instead of a boolean.
 * @property {boolean} [readonly] Whether to make the field read-only. Default: `false`, or `true`
 * for the UUID field type. This is useful when a `default` value is provided and the field should
 * not be editable by users.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets/
 * @see https://sveltiacms.app/en/docs/fields
 */

/**
 * Field validation properties.
 * @typedef {object} FieldValidationProps
 * @property {[string | RegExp, string]} [pattern] Validation format. The first argument is a
 * regular expression matching pattern for a valid input value, and the second argument is an error
 * message to be displayed when the input value does not match the pattern.
 */

/**
 * Field-level media storage options.
 * @typedef {object} FieldMediaLibraryOptions
 * @property {MediaLibraryName} [name] Library name.
 */

/**
 * Media field properties.
 * @typedef {object} MediaFieldProps
 * @property {string | string[]} [default] Default value. Accepts a file path or complete URL. If
 * the `multiple` option is set to `true`, it accepts an array of file paths or URLs.
 * @property {boolean} [multiple] Whether to allow multiple file selection for the field. Default:
 * `false`, unless the `multiple` option is enabled in a media library’s `config`.
 * @property {number} [min] Minimum number of files that can be selected. Ignored unless the
 * `multiple` option is set to `true`. Default: `0`.
 * @property {number} [max] Maximum number of files that can be selected. Ignored unless the
 * `multiple` option is set to `true`. Default: `Infinity`.
 * @property {string} [accept] File types that the field should accept. The value would be a
 * comma-separated list of unique file type specifiers, the format used for the HTML
 * [`accept`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept)
 * attribute. Default: any file for a File field; the supported image formats for an Image field,
 * including HEIC if a `heic` or `raster_image` transformation is defined.
 * @property {boolean} [choose_url] Whether to show the URL input UI. Default: `true`.
 * @property {string} [media_folder] Internal media folder path for the field. Default: global or
 * collection-level `media_folder` value.
 * @property {string} [public_folder] Public media folder path for the field. Default:
 * `media_folder` option value.
 * @property {MediaLibrary & FieldMediaLibraryOptions} [media_library] Legacy media storage option
 * that allows only one library. It overrides the global options of the same library in the same way
 * as `media_libraries`; without a `name`, it applies to the library named in the global
 * `media_library` option. Use `media_libraries` instead to support multiple libraries.
 * @property {MediaLibraries} [media_libraries] Unified media storage option that supports multiple
 * libraries. Each library’s options, including `all`, are merged over the same library’s global
 * options, one level deep, so a field only needs to set what it overrides: nested objects such as
 * `config` are merged key by key, while other values, including arrays, are replaced. `false`
 * disables the library for the field. Libraries not defined here fall back to the global
 * configuration.
 * @see https://decapcms.org/docs/widgets/#File
 * @see https://decapcms.org/docs/widgets/#Image
 * @see https://sveltiacms.app/en/docs/fields/file
 * @see https://sveltiacms.app/en/docs/fields/image
 */

/**
 * Options for a field accepting multiple values.
 * @typedef {object} MultiValueFieldProps
 * @property {number} [min] Minimum number of items that can be added. Default: `0`.
 * @property {number} [max] Maximum number of items that can be added. Default: `Infinity`.
 */

/**
 * Options for a field showing multiple options.
 * @typedef {object} MultiOptionFieldProps
 * @property {boolean} [multiple] Whether to accept multiple values. Default: `false`.
 * @property {number} [min] Minimum number of items that can be selected. Ignored if `multiple` is
 * `false`. Default: `0`.
 * @property {number} [max] Maximum number of items that can be selected. Ignored if `multiple` is
 * `false`. Default: `Infinity`.
 * @property {number} [dropdown_threshold] Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: `5`.
 */

/**
 * Validation options for a field that can take multiple values.
 * @typedef {object} MultiValueFieldValidationProps
 * @property {[string | RegExp, string]} [pattern] Validation format. The first argument is a
 * regular expression matching pattern for a valid input value, and the second argument is an error
 * message to be displayed when the input value does not match the pattern. If the field takes
 * multiple values, like Decap CMS, the pattern is tested against all the values joined with commas,
 * e.g. `foo,bar,baz`, rather than against each value, and not at all while the field is empty.
 * Numbers are tested as strings, and a file just uploaded is tested by its name.
 */

/**
 * Variable type for List/Object fields.
 * @typedef {object} VariableFieldType
 * @property {string} name Unique identifier for the type.
 * @property {string} [label] Label of the type to be displayed in the editor UI. Default: `name`
 * field value.
 * @property {'object'} [widget] Field type. Only `object` is supported: another value is a
 * configuration error.
 * @property {string} [summary] Template of a label to be displayed on a collapsed object.
 * @property {Field[]} [fields] Set of subfields. This option can be omitted; in that case, only the
 * `type` property will be saved.
 * @see https://decapcms.org/docs/variable-type-widgets/
 * @see https://sveltiacms.app/en/docs/fields/list#variable-type
 */

/**
 * Variable field properties.
 * @typedef {object} VariableFieldProps
 * @property {VariableFieldType[]} types Set of nested Object fields to be selected or added.
 * @property {string} [typeKey] Property name to store the type name in nested objects. Default:
 * `type`.
 * @see https://decapcms.org/docs/variable-type-widgets/
 * @see https://sveltiacms.app/en/docs/fields/list#variable-type
 */

/**
 * Options for a field with a simple input UI that allows for extra labels.
 * @typedef {object} AdjacentLabelProps
 * @property {string} [before_input] An extra label to be displayed before the input UI. Markdown is
 * supported. Default: empty string.
 * @property {string} [after_input] An extra label to be displayed after the input UI. Markdown is
 * supported. Default: empty string.
 * @see https://github.com/sveltia/sveltia-cms/issues/110
 */

/**
 * Options for a field with a string-type input UI that counts the number of characters.
 * @typedef {object} CharCountProps
 * @property {number} [minlength] Minimum number of characters that can be entered in the input.
 * Default: `0`.
 * @property {number} [maxlength] Maximum number of characters that can be entered in the input.
 * Default: `Infinity`.
 * @see https://github.com/sveltia/sveltia-cms/issues/141
 */

/**
 * Boolean field properties.
 * @typedef {object} BooleanFieldProps
 * @property {'boolean'} widget Field type.
 * @property {boolean} [default] Default value. Accepts `true` or `false`. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#Boolean
 * @see https://sveltiacms.app/en/docs/fields/boolean
 */

/**
 * Boolean field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & BooleanFieldProps & AdjacentLabelProps}
 * BooleanField
 */

/**
 * Code field properties.
 * @typedef {object} CodeFieldProps
 * @property {'code'} widget Field type.
 * @property {string | Record<string, string>} [default] Default value. It must be a string if
 * `output_code_only` is `true`. Otherwise it should be an object that matches the `keys` option,
 * like `{ code: 'let x = 1;', lang: 'js' }`; a string is used as the code.
 * @property {string} [default_language] Default language to be selected, like `js`. See the [Shiki
 * documentation](https://shiki.style/languages) for a list of supported languages. Default: empty
 * string, which is plaintext.
 * @property {boolean} [allow_language_selection] Whether to show a language switcher so that users
 * can change the language mode. Default: `true` (the Decap CMS document is wrong).
 * @property {boolean} [output_code_only] Whether to save the code only, as a string, instead of an
 * object containing the code and the language. Default: `false`.
 * @property {{ code: string, lang: string }} [keys] Output property names. It has no effect if
 * `output_code_only` is `true`. Default: `{ code: 'code', lang: 'lang' }`.
 * @see https://decapcms.org/docs/widgets/#Code
 * @see https://sveltiacms.app/en/docs/fields/code
 */

/**
 * Code field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & CodeFieldProps} CodeField
 */

/**
 * Color field properties.
 * @typedef {object} ColorFieldProps
 * @property {'color'} widget Field type.
 * @property {string} [default] Default value. Accepts a Hex color code in the six-value (`#RRGGBB`)
 * or eight-value (`#RRGGBBAA`) syntax.
 * @property {boolean} [allowInput] Whether to show a textbox that allows users to manually edit the
 * value. Default: `false`.
 * @property {boolean} [enableAlpha] Whether to edit/save the alpha channel value. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#color
 * @see https://sveltiacms.app/en/docs/fields/color
 */

/**
 * Color field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & ColorFieldProps}
 * ColorField
 */

/**
 * Compute field properties.
 * @typedef {object} ComputeFieldProps
 * @property {'compute'} widget Field type.
 * @property {string} value Value template, like `posts-{{fields.slug}}`. Besides the `fields.*`
 * tags, which support transformations like `{{fields.title | upper}}`, `{{index}}` is the position
 * of the item in a list, which is saved as a number when used alone, and `{{uuid}}`,
 * `{{uuid_short}}` and `{{uuid_shorter}}` generate a UUID, which is kept once the value is saved.
 * The field is always hidden in the editor, and its value can’t be edited.
 * @see https://github.com/sveltia/sveltia-cms/issues/111
 * @see https://github.com/sveltia/sveltia-cms/issues/122
 */

/**
 * Compute field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & ComputeFieldProps} ComputeField
 */

/**
 * DateTime input type. It’s based on the supported date/time input types defined in the HTML spec.
 * @typedef {'datetime-local' | 'date' | 'time'} DateTimeInputType
 */

/**
 * DateTime field properties.
 * @typedef {object} DateTimeFieldProps
 * @property {'datetime'} widget Field type.
 * @property {string} [default] Default value. Accepts a date/time string that matches the `format`,
 * or `{{now}}` to populate the current date/time. Default: empty string.
 * @property {DateTimeInputType} [type] The
 * [`type`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input#input_types)
 * HTML attribute value for the date/time input. If `type` is set to `date`, the input will only
 * accept date values and the time part will be disabled. If `type` is set to `time`, the input will
 * only accept time values and the date part will be disabled. Default: `datetime-local`, which
 * accepts both date and time values.
 * @property {string} [min] The
 * [`min`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/min) HTML
 * attribute value for the date/time input. The expected format depends on the `type` option:
 * `YYYY-MM-DDTHH:mm` for `datetime-local`, `YYYY-MM-DD` for `date`, and `HH:mm` for `time`.
 * @property {string} [max] The
 * [`max`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/max) HTML
 * attribute value for the date/time input. The expected format depends on the `type` option:
 * `YYYY-MM-DDTHH:mm` for `datetime-local`, `YYYY-MM-DD` for `date`, and `HH:mm` for `time`.
 * Default: `9999-12-31T23:59` for `datetime-local`, `9999-12-31` for `date`, and none for `time`.
 * @property {number | 'any'} [step] The
 * [`step`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/step) HTML
 * attribute value for the date/time input. Accepts a positive integer or `'any'`. For
 * `datetime-local` and `time` inputs, the integer represents the step in seconds (e.g. `300` for
 * 5-minute steps). For `date` inputs, the integer represents the step in days (e.g. `7` for weekly
 * steps). Default: `60` seconds for `datetime-local` and `time`; `1` day for `date`.
 * @property {string} [format] Storage format written in [Day.js
 * tokens](https://day.js.org/docs/en/display/format). Default: ISO 8601 format.
 * @property {string | boolean} [date_format] Date storage format written in [Day.js
 * tokens](https://day.js.org/docs/en/display/format) if the value is a string and the `format`
 * option is not defined. If `true`, ISO 8601 format is used unless the `format` option is defined.
 * If `false`, date input/output is disabled. This option is available for backward compatibility
 * with Netlify CMS; use the `format` or `type` option instead.
 * @property {string | boolean} [time_format] Time storage format written in [Day.js
 * tokens](https://day.js.org/docs/en/display/format) if the value is a string and the `format`
 * option is not defined. If `true`, ISO 8601 format is used unless the `format` option is defined.
 * If `false`, time input/output is disabled. This option is available for backward compatibility
 * with Netlify CMS; use the `format` or `type` option instead.
 * @property {boolean} [picker_utc] Whether to make the date input/output UTC. Default: `false`.
 * This option is available for backward compatibility with Netlify/Decap CMS. The newer
 * `input_timezone` and `output_utc` options provide more flexibility and supersede this option when
 * explicitly set. `picker_utc: true` is equivalent to `input_timezone: 'utc'`.
 * @property {'local' | 'utc' | string} [input_timezone] Timezone used by the date/time input. This
 * option supersedes `picker_utc`. If set to `local`, the browser’s local timezone is used. If set
 * to `utc`, UTC is used. A custom IANA timezone name such as `America/New_York` or `Asia/Tokyo` may
 * also be provided as a string. Default: `local`.
 * @property {boolean} [output_utc] Whether to convert stored values to UTC. This option supersedes
 * `picker_utc`. If `false`, output values preserve the timezone semantics of `input_timezone`:
 * `local` omits timezone information, `utc` appends a `Z` suffix, and custom timezones preserve
 * their offset (e.g., `-05:00`). If `true`, the input value is converted to UTC for storage. When
 * no custom `format` is specified, a `Z` suffix is appended to the ISO 8601 output. When a custom
 * `format` is used, the value is stored in UTC but formatted according to that pattern — which
 * won’t include an explicit timezone indicator unless the format itself contains `Z`. Note that
 * `input_timezone: 'utc'` already implies UTC semantics, so `output_utc` has no additional effect
 * in that case. Default: `false`.
 * @property {boolean | DateTimeAutoNowStage[]} [auto_now] Whether to set the field to the current
 * date/time automatically when an entry is saved. `true` means both when an entry is created and
 * whenever it’s updated, `false` means neither, and an array like `[create]` or `[update]` picks
 * the stages. `create` also covers a value that hasn’t been set yet, such as one in a List item
 * added to an existing entry. `[create]` suits a creation date, and `true` a last modified date.
 * The value is formatted like the `{{now}}` default value, with seconds, but set at save time
 * rather than when a draft is created. The field is shown as text, isn’t validated, and is hidden
 * while an entry is being created. The value is shared by all locales. The option is ignored in a
 * rich text editor component. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#Datetime
 * @see https://sveltiacms.app/en/docs/fields/datetime
 */

/**
 * Stage of an entry’s life at which a DateTime field is set to the current date/time: when the
 * entry is first saved, or whenever it’s saved after that.
 * @typedef {'create' | 'update'} DateTimeAutoNowStage
 */

/**
 * DateTime field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & DateTimeFieldProps}
 * DateTimeField
 */

/**
 * File field properties.
 * @typedef {object} FileFieldProps
 * @property {'file'} widget Field type.
 * @property {boolean} [select_folder] Whether to select a folder instead of a file. The public
 * path of the selected folder, e.g. `/images/gallery`, is saved as the field value. Only an asset
 * folder with a fixed path can be browsed, so entry-relative folders and folders with template tags
 * are not available, nor are external media storage providers. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#File
 * @see https://sveltiacms.app/en/docs/fields/file
 */

/**
 * File field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & MultiValueFieldValidationProps &
 * MediaFieldProps & FileFieldProps} FileField
 */

/**
 * Hidden field properties.
 * @typedef {object} HiddenFieldProps
 * @property {'hidden'} widget Field type.
 * @property {any} [default] Default value. Accepts any data type that can be stored with the
 * configured file format. A string can contain the `{{locale}}`, `{{datetime}}`, `{{uuid}}`,
 * `{{uuid_short}}`, `{{uuid_shorter}}`, `{{author-email}}`, `{{author-login}}` and
 * `{{author-name}}` tags, which are filled when a new entry draft is created.
 * @see https://decapcms.org/docs/widgets/#Hidden
 * @see https://sveltiacms.app/en/docs/fields/hidden
 */

/**
 * Hidden field definition.
 * @typedef {CommonFieldProps & HiddenFieldProps} HiddenField
 */

/**
 * Image field properties.
 * @typedef {object} ImageFieldProps
 * @property {'image'} widget Field type.
 * @see https://decapcms.org/docs/widgets/#Image
 * @see https://sveltiacms.app/en/docs/fields/image
 */

/**
 * Image field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & MultiValueFieldValidationProps &
 * MediaFieldProps & ImageFieldProps} ImageField
 */

/**
 * KeyValue field properties compatible with Static CMS.
 * @typedef {object} KeyValueFieldProps
 * @property {'keyvalue'} widget Field type.
 * @property {Record<string, string>} [default] Default key-value pairs.
 * @property {string} [key_label] Label for the key column. Default: Key or its localized version.
 * @property {string} [value_label] Label for the value column. Default: Value or its localized
 * version.
 * @property {string} [label_singular] Label to be displayed on the Add button. Default: `label`
 * field value.
 * @property {boolean} [root] Whether to save the field value at the top-level of the data file
 * without the field name. It only works if the field is the only field in the collection or file.
 * If the `single_file` i18n structure is enabled, the key-value pairs will still be saved under
 * locale keys. Default: `false`. See the
 * [documentation](https://sveltiacms.app/en/docs/fields/keyvalue#top-level-key-value-pairs) for
 * details.
 * @see https://staticjscms.netlify.app/docs/widget-keyvalue
 * @see https://sveltiacms.app/en/docs/fields/keyvalue
 */

/**
 * KeyValue field definition.
 * @typedef {BaseFieldProps & KeyValueFieldI18nProps & VisibleFieldProps & KeyValueFieldProps &
 * MultiValueFieldProps} KeyValueField
 */

/**
 * List field properties.
 * @typedef {object} ListFieldProps
 * @property {'list'} widget Field type.
 * @property {string[] | Record<string, any>[]} [default] Default value. The format depends on how
 * the field is configured, with or without `field`, `fields` or `types`. See the
 * [documentation](https://sveltiacms.app/en/docs/fields/list) for details.
 * @property {string} [label_singular] Label to be displayed on the Add button. Default: `label`
 * field value.
 * @see https://decapcms.org/docs/widgets/#List
 * @see https://sveltiacms.app/en/docs/fields/list
 */

/**
 * Base properties for a List field.
 * @typedef {CommonFieldProps & VisibleFieldProps & ListFieldProps & MultiValueFieldProps}
 * ListFieldBaseProps
 */

/**
 * Simple List field properties.
 * @typedef {object} SimpleListFieldProps
 * @property {[string | RegExp, string]} [pattern] Validation format. The first argument is a
 * regular expression matching pattern for a valid input value, and the second argument is an error
 * message to be displayed when the input value does not match the pattern. Like Decap CMS, the
 * pattern is tested against all the list items joined with commas, e.g. `foo,bar,baz`, rather than
 * against each item, and not at all while the list is empty.
 * @property {boolean} [root] Whether to save the field value at the top-level of the data file
 * without the field name. It only works if the field is the only field in the collection or file,
 * and the file format is not TOML. If the `single_file` i18n structure is enabled, the lists will
 * still be saved under locale keys. Default: `false`. See the
 * [documentation](https://sveltiacms.app/en/docs/fields/list#top-level-list) for details.
 */

/**
 * Simple List field definition with primitive item types.
 * @typedef {ListFieldBaseProps & SimpleListFieldProps} SimpleListField
 */

/**
 * Base properties for a complex List field with subfields or variable types.
 * @typedef {object} ComplexListFieldBaseProps
 * @property {boolean} [allow_add] Whether to allow users to add new items to the list. Default:
 * `true`.
 * @property {boolean} [allow_remove] Whether to allow users to remove items from the list. Default:
 * `true`.
 * @property {boolean} [allow_duplicate] Whether to allow users to duplicate items in the list.
 * Default: `true`.
 * @property {boolean} [allow_reorder] Whether to allow users to reorder items in the list. Default:
 * `true`.
 * @property {boolean} [add_to_top] Whether to add new items to the top of the list instead of the
 * bottom. Default: `false`.
 * @property {string} [summary] Template of a label to be displayed on a collapsed list item.
 * @property {string} [thumbnail] Subfield name to be used as a thumbnail image for a list item. It
 * will be displayed along with the summary label when the item is collapsed. The subfield must be
 * an Image or File field. Default: none.
 * @property {boolean | 'auto'} [collapsed] Whether to collapse the list items by default. Default:
 * `false`. If set to `auto`, the UI is collapsed if the item has any filled subfields and expanded
 * if all the subfields are empty.
 * @property {boolean | 'auto'} [minimize_collapsed] Whether to collapse the entire list. Default:
 * `false`. If set to `auto`, the UI is collapsed if the list has any items and expanded if it’s
 * empty.
 * @property {boolean} [root] Whether to save the field value at the top-level of the data file
 * without the field name. It only works if the field is the only field in the collection or file,
 * and the file format is not TOML. If the `single_file` i18n structure is enabled, the lists will
 * still be saved under locale keys. Default: `false`. See the
 * [documentation](https://sveltiacms.app/en/docs/fields/list#top-level-list) for details.
 */

/**
 * Properties for a complex List field with subfields or variable types.
 * @typedef {ListFieldBaseProps & ComplexListFieldBaseProps} ComplexListFieldProps
 */

/**
 * Properties for a List field with a single subfield.
 * @typedef {object} ListFieldSubFieldProps
 * @property {Field} field Single field to be included in a list item.
 */

/**
 * List field definition with a single subfield.
 * @typedef {ComplexListFieldProps & ListFieldSubFieldProps} ListFieldWithSubField
 */

/**
 * Properties for a List field with multiple subfields.
 * @typedef {object} ListFieldSubFieldsProps
 * @property {Field[]} fields Set of fields to be included in a list item.
 */

/**
 * List field definition with multiple subfields.
 * @typedef {ComplexListFieldProps & ListFieldSubFieldsProps} ListFieldWithSubFields
 */

/**
 * List field definition with variable types.
 * @typedef {ComplexListFieldProps & VariableFieldProps} ListFieldWithTypes
 */

/**
 * List field definition with complex items.
 * @typedef {ListFieldWithSubField | ListFieldWithSubFields | ListFieldWithTypes} ComplexListField
 */

/**
 * List field definition.
 * @typedef {SimpleListField | ListFieldWithSubField | ListFieldWithSubFields | ListFieldWithTypes}
 * ListField
 */

// Note: the `typedef` above cannot be `SimpleListField | ComplexListField` because it’s not
// recognized by the YAML extension in VS Code due to the mixed properties of union types.

/**
 * Map field properties.
 * @typedef {object} MapFieldProps
 * @property {'map'} widget Field type.
 * @property {string} [default] Default value. Accepts a stringified single
 * [GeoJSON](https://geojson.org/) geometry object that contains `type` and `coordinates`
 * properties.
 * @property {number} [decimals] Precision of coordinates to be saved. Default: `7`.
 * @property {'Point' | 'LineString' | 'Polygon'} [type] Geometry type. Default: `Point`.
 * @property {[number, number]} [center] Default center coordinates as `[longitude, latitude]`.
 * Default: `[0, 0]`.
 * @property {number} [zoom] Default zoom level. Default: `2`.
 * @see https://decapcms.org/docs/widgets/#Map
 * @see https://sveltiacms.app/en/docs/fields/map
 */

/**
 * Map field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & MapFieldProps} MapField
 */

/**
 * Supported button name for the rich text editor.
 * @typedef {'bold' | 'italic' | 'strikethrough' | 'code' | 'link' | 'heading-one' | 'heading-two' |
 * 'heading-three' | 'heading-four' | 'heading-five' | 'heading-six' | 'quote' | 'bulleted-list' |
 * 'numbered-list'} RichTextEditorButtonName
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */

/**
 * Built-in editor component name for the rich text editor.
 * @typedef {'code-block' | 'image'} RichTextEditorComponentName
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */

/**
 * Supported mode name for the rich text editor.
 * @typedef {'rich_text' | 'raw'} RichTextEditorMode
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */

/**
 * RichText field base properties.
 * @typedef {object} RichTextFieldBaseProps
 * @property {string} [default] Default value.
 * @property {boolean} [minimal] Whether to limit the editor height to 240 pixels, making the
 * content scrollable. Default: `false`.
 * @property {RichTextEditorButtonName[]} [buttons] Names of formatting buttons and menu items to be
 * enabled in the editor UI. Default: all the supported button names.
 * @property {(RichTextEditorComponentName | string)[]} [editor_components] Names of components to
 * be enabled in the editor UI. This may include custom component names. Default: all the built-in
 * and registered custom component names.
 * @property {boolean | 'exclude_self'} [allow_nested_components] Whether to allow nested rich text
 * editor components in the editor UI. If set to `'exclude_self'`, nested components are disabled if
 * the parent components include the current component; this is useful to prevent unexpected
 * behavior due to regex matching limitations. Default: `true`.
 * @property {RichTextEditorMode[]} [modes] Editor modes to be enabled. The first one is selected
 * initially, so with `[raw, rich_text]`, the editor opens in raw mode. Default: `[rich_text, raw]`.
 * @property {boolean} [sanitize_preview] Whether to sanitize the preview HTML. Default: `true`.
 * Note that Sveltia CMS has changed the default value from `false` to `true` to enhance security,
 * whereas Netlify/Decap CMS keeps it as `false`. We recommend keeping this option enabled unless
 * disabling it fixes a broken preview and you fully trust all users of your CMS.
 * @property {boolean} [linked_images] Whether to enable the linked images feature for the built-in
 * `image` component. Default: `true`. When enabled, the image component provides an additional text
 * field for specifying a URL to wrap the image as a link. The resulting Markdown output will be in
 * the format `[![alt](src)](link)`, where clicking the image navigates to the provided link. This
 * feature can be disabled if it causes conflicts with certain frameworks.
 * @property {boolean} [use_emoji_autocomplete] Whether to enable emoji autocomplete in the rich
 * text editor. Default: `true`. When enabled, typing `:` followed by a few letters will show a list
 * of matching emojis that can be selected to insert into the text.
 * @property {boolean} [use_markdown_shortcuts] Whether to enable Markdown shortcuts in the rich
 * text editor. Default: `true`. When enabled, typing `-` or `*` at the start of a line creates a
 * bulleted list, `1.` creates a numbered list, `>` creates a blockquote, and `#`, `##`, `###`
 * create headings. Note that standard keyboard shortcuts like `Ctrl+B` for bold and `Ctrl+I` for
 * italic are always enabled regardless of this option.
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */

/**
 * RichText field properties.
 * @typedef {object} RichTextFieldProps
 * @property {'richtext'} widget Field type.
 * @todo Add the `format` option for HTML output.
 */

/**
 * RichText field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & RichTextFieldBaseProps &
 * RichTextFieldProps} RichTextField
 */

/**
 * Markdown field properties.
 * @typedef {object} MarkdownFieldProps
 * @property {'markdown'} widget Field type.
 */

/**
 * Markdown field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & RichTextFieldBaseProps &
 * MarkdownFieldProps} MarkdownField
 */

/**
 * Number field properties.
 * @typedef {object} NumberFieldProps
 * @property {'number'} widget Field type.
 * @property {number | string} [default] Default value.
 * @property {'int' | 'float' | 'int/string' | 'float/string'} [value_type] Type of the value. `int`
 * makes the input accept only an integer value and saves it as a number. `float` makes the input
 * accept only a floating-point value and saves it as a number. `int/string` and `float/string` make
 * the input accept only an integer or floating-point value, respectively, but save it as a string.
 * Default: `int`.
 * @property {number} [min] Minimum value that can be entered in the input. Default: `-Infinity`.
 * @property {number} [max] Maximum value that can be entered in the input. Default: `Infinity`.
 * @property {number} [step] Number to increase/decrease with the arrow key/button. Default: `1`.
 * @see https://decapcms.org/docs/widgets/#Number
 * @see https://sveltiacms.app/en/docs/fields/number
 */

/**
 * Number field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & NumberFieldProps &
 * AdjacentLabelProps} NumberField
 */

/**
 * Object field properties.
 * @typedef {object} ObjectFieldProps
 * @property {'object'} widget Field type.
 * @property {Record<string, any>} [default] Default values.
 * @property {boolean | 'auto'} [collapsed] Whether to collapse the object by default. Default:
 * `false`. If set to `auto`, the UI is collapsed if the object has any filled subfields and
 * expanded if all the subfields are empty.
 * @property {string} [summary] Template of a label to be displayed on a collapsed object.
 * @property {string} [thumbnail] Subfield name to be used as a thumbnail image for the object. It
 * will be displayed along with the summary label when the object is collapsed. The subfield must be
 * an Image or File field. Default: none.
 * @see https://decapcms.org/docs/widgets/#Object
 * @see https://sveltiacms.app/en/docs/fields/object
 */

/**
 * Base properties for a complex Object field with subfields or variable types.
 * @typedef {CommonFieldProps & VisibleFieldProps & ObjectFieldProps} ComplexObjectFieldProps
 */

/**
 * Properties for an Object field with multiple subfields.
 * @typedef {object} ObjectFieldSubFieldsProps
 * @property {Field[]} fields Set of fields to be included.
 */

/**
 * Object field definition with multiple subfields.
 * @typedef {ComplexObjectFieldProps & ObjectFieldSubFieldsProps} ObjectFieldWithSubFields
 */

/**
 * Object field definition with variable types.
 * @typedef {ComplexObjectFieldProps & VariableFieldProps} ObjectFieldWithTypes
 */

/**
 * Object field definition.
 * @typedef {ObjectFieldWithSubFields | ObjectFieldWithTypes} ObjectField
 */

/**
 * Entry filter options for a Relation field.
 * @typedef {object} RelationFieldFilterOptions
 * @property {FieldKeyPath} field Field name.
 * @property {any[]} values One or more values to be matched. A value can be a template tag, either
 * `{{fields.fieldName}}` or `{{slug}}`, which is replaced with the field value or the slug of the
 * entry being edited; a List field value is expanded into its items. A tag has to be the whole
 * value, not part of a longer string. Unresolvable tags (e.g. `{{slug}}` for a new, unsaved entry)
 * are ignored.
 * @property {boolean} [exclude] If `true`, entries matching this filter are excluded instead of
 * included. Default: `false`.
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {'relation'} widget Field type.
 * @property {any | any[]} [default] Default value(s), which should match the options. When
 * `multiple` is `false`, it should be a single value that matches the `value_field` option.
 * @property {string} collection Referenced collection name. Use `_singletons` for the singleton
 * collection.
 * @property {string} [file] Referenced file identifier for a file/singleton collection. Required if
 * the referenced collection is a file/singleton collection.
 * @property {FieldKeyPath | string} [value_field] Field name to be stored as the value, or
 * `{{slug}}` (entry slug). Note that `slug` without braces refers to a field named `slug`. It can
 * contain a locale prefix like `{{locale}}/{{slug}}` if i18n is enabled. A wildcard can be used for
 * a List subfield, like `cities.*.name`. Default: `{{slug}}`. For a collection with the `file`
 * option, whose entry slug is the position in the array, it must refer to a field instead.
 * @property {(FieldKeyPath | string)[]} [display_fields] Name of fields to be displayed. It can
 * contain string templates. Default: `value_field` field value or the referenced collection’s
 * `identifier_field`, which is `title` by default.
 * @property {(FieldKeyPath | string)[]} [search_fields] Name of fields to be searched. It can
 * contain string templates. Default: `display_fields` field value.
 * @property {RelationFieldFilterOptions[]} [filters] Entry filter options.
 * @see https://decapcms.org/docs/widgets/#Relation
 * @see https://sveltiacms.app/en/docs/fields/relation
 */

/**
 * Relation field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & MultiValueFieldValidationProps &
 * RelationFieldProps & MultiOptionFieldProps} RelationField
 */

/**
 * Select field option value.
 * @typedef {string | number | boolean | null} SelectFieldValue
 */

/**
 * Select field option with a label.
 * @typedef {object} SelectFieldOption
 * @property {string} label Label shown in the UI.
 * @property {SelectFieldValue} value Value saved in the entry.
 */

/**
 * Select field properties.
 * @typedef {object} SelectFieldProps
 * @property {'select'} widget Field type.
 * @property {SelectFieldValue | SelectFieldOption | (SelectFieldValue | SelectFieldOption)[]}
 * [default] Default value that matches one of the options. An option object with the `label` and
 * `value` properties can also be given, in which case its `value` is used. When `multiple` is
 * `true`, it should be an array of valid values.
 * @property {SelectFieldValue[] | SelectFieldOption[]} options Options to choose from, given as a
 * list of values, or a list of objects with the `label` and `value` properties. The list cannot be
 * empty or contain duplicate values.
 * @see https://decapcms.org/docs/widgets/#Select
 * @see https://sveltiacms.app/en/docs/fields/select
 */

/**
 * Select field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & MultiValueFieldValidationProps &
 * SelectFieldProps & MultiOptionFieldProps} SelectField
 */

/**
 * String field properties.
 * @typedef {object} StringFieldProps
 * @property {'string'} [widget] Field type.
 * @property {string} [default] Default value.
 * @property {'text' | 'url' | 'email'} [type] Data type. It’s useful when the input value needs a
 * validation. Default: `text`.
 * @property {string} [prefix] A string to be prepended to the value unless it’s empty. Default:
 * empty string.
 * @property {string} [suffix] A string to be appended to the value unless it’s empty. Default:
 * empty string.
 * @property {boolean} [use_emoji_autocomplete] Whether to enable emoji autocomplete in the text
 * input. Default: `true` if the type is `text`. When enabled, typing `:` followed by a few letters
 * will show a list of matching emojis that can be selected to insert into the text.
 * @see https://decapcms.org/docs/widgets/#String
 * @see https://sveltiacms.app/en/docs/fields/string
 */

/**
 * String field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & StringFieldProps &
 * AdjacentLabelProps & CharCountProps} StringField
 */

/**
 * Text field properties.
 * @typedef {object} TextFieldProps
 * @property {'text'} widget Field type.
 * @property {string} [default] Default value.
 * @property {boolean} [use_emoji_autocomplete] Whether to enable emoji autocomplete in the text
 * area. Default: `true`. When enabled, typing `:` followed by a few letters will show a list of
 * matching emojis that can be selected to insert into the text.
 * @see https://decapcms.org/docs/widgets/#Text
 * @see https://sveltiacms.app/en/docs/fields/text
 */

/**
 * Text field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & FieldValidationProps & TextFieldProps &
 * CharCountProps} TextField
 */

/**
 * UUID field properties.
 * @typedef {object} UuidFieldProps
 * @property {'uuid'} widget Field type.
 * @property {string} [default] Default value.
 * @property {string} [prefix] A string to be prepended to the value. Default: empty string.
 * @property {boolean} [use_b32_encoding] Whether to encode the value with Base32, which makes a
 * 26-character lowercase ID instead of a 36-character UUID. Default: `false`.
 * @property {boolean} [read_only] Whether to make the field read-only. Default: `true`.
 * DEPRECATED: Use the `readonly` common field option instead, which defaults to `true` for the UUID
 * field type.
 * @see https://github.com/decaporg/decap-cms/pull/6675
 */

/**
 * UUID field definition.
 * @typedef {CommonFieldProps & VisibleFieldProps & UuidFieldProps} UuidField
 */

/**
 * Visible field types.
 * @typedef {BooleanField | CodeField | ColorField | ComputeField | DateTimeField | FileField |
 * ImageField | KeyValueField | ListField | MapField | MarkdownField | NumberField | ObjectField |
 * RelationField | RichTextField | SelectField | StringField | TextField | UuidField} VisibleField
 */

/**
 * Entry field using a built-in field type.
 * @typedef {VisibleField | HiddenField} StandardField
 * @see https://decapcms.org/docs/widgets/
 * @see https://sveltiacms.app/en/docs/fields
 */

/**
 * Media field types.
 * @typedef {FileField | ImageField} MediaField
 */

/**
 * Field types that have the `multiple` option.
 * @typedef {MediaField | RelationField | SelectField} MultiValueField
 */

/**
 * Field types that have the `min` and `max` options.
 * @typedef {MultiValueField | DateTimeField | KeyValueField | ListField | NumberField}
 * MinMaxValueField
 */

/**
 * Field types that have subfields.
 * @typedef {ListFieldWithSubFields | ObjectFieldWithSubFields} FieldWithSubFields
 */

/**
 * Field types that support variable types.
 * @typedef {ListFieldWithTypes | ObjectFieldWithTypes} FieldWithTypes
 */

/**
 * Built-in field type name. Sveltia CMS supports all the built-in field types provided by Decap CMS
 * as well as some new field types.
 * @typedef {'boolean' | 'code' | 'color' | 'compute' | 'datetime' | 'file' | 'hidden' | 'image' |
 * 'keyvalue' | 'list' | 'map' | 'markdown' | 'number' | 'object' | 'relation' | 'richtext' |
 * 'select' | 'string' | 'text' | 'uuid'} BuiltInFieldType
 * @see https://decapcms.org/docs/widgets/
 * @see https://sveltiacms.app/en/docs/fields
 */

/**
 * Custom field properties.
 * @typedef {object} CustomFieldProps
 * @property {Exclude<string, BuiltInFieldType | ''>} widget Field type.
 * @see https://decapcms.org/docs/custom-widgets/
 * @see https://sveltiacms.app/en/docs/api/field-types
 */

/**
 * Entry field using a custom field type.
 * @typedef {CommonFieldProps & VisibleFieldProps & CustomFieldProps & Record<string, any>}
 * CustomField
 */

/**
 * Entry field.
 * @typedef {StandardField | CustomField} Field
 */

/**
 * Internationalization (i18n) file structure type.
 * @typedef {'single_file' | 'single_file_default_root' | 'multiple_files' | 'multiple_folders' |
 * 'multiple_folders_i18n_root' | 'multiple_root_folders'} I18nFileStructure
 * @see https://decapcms.org/docs/i18n/
 * @see https://sveltiacms.app/en/docs/i18n
 * @see https://github.com/decaporg/decap-cms/pull/7400
 * @see https://github.com/sveltia/sveltia-cms/issues/730
 */

/**
 * Global, collection-level or collection file-level i18n options. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n) for details.
 * @typedef {object} I18nOptions
 * @property {I18nFileStructure} [structure] File structure for entry collections. Default:
 * `single_file`. An entry collection can instead say where the locale folder goes with
 * the `{{locale}}` placeholder in the `folder` option, like `content/{{locale}}/posts`, which is
 * useful when the locale folders sit between the site’s content folder and the collection folders.
 * File/singleton collection must define the structure using `{{locale}}` in the `file` option.
 * `multiple_folders_i18n_root` has been deprecated in favor of `multiple_root_folders`. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/structures) for details.
 * @property {LocaleCode[]} [locales] List of all available locales. **Required for the global i18n
 * options**.
 * @property {LocaleCode} [default_locale] Default locale. Default: first locale in the `locales`
 * option.
 * @property {LocaleCode[] | 'all' | 'default'} [initial_locales] Locales to be enabled when
 * creating a new entry draft. If this option is used, users will be able to disable the output of
 * non-default locales through the UI. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/options#disabling-non-default-locale-content)
 * for details.
 * @property {boolean} [save_all_locales] Whether to save collection entries in all the locales.
 * Default: `true`.
 * DEPRECATED: Use the `initial_locales` option instead, which provides more flexibility.
 * `save_all_locales: false` is equivalent to `initial_locales: 'all'`. See the documentation
 * https://sveltiacms.app/en/docs/i18n/options#disabling-non-default-locale-content for details.
 * @property {{ key?: string, value?: string }} [canonical_slug] Property name and value template
 * used to add a canonical slug to entry files, which helps Sveltia CMS and some frameworks to link
 * localized files when entry slugs are localized. The default property name is `translationKey`
 * used in Hugo’s multilingual support, and the default value is the default locale’s slug. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/slugs#localizing-entry-slugs) for details.
 * @property {boolean} [omit_default_locale_from_filename] Whether to exclude the default locale
 * from entry filenames. Default: `false`. It’s an alias of the `omit_default_locale_from_file_path`
 * option, which is used instead if both are defined.
 * DEPRECATED: Use the `omit_default_locale_from_file_path` option instead.
 * @property {boolean} [omit_default_locale_from_file_path] Whether to exclude the default locale
 * from entry file paths. Default: `false`. This option applies to both entry collections and file
 * collections, where the path includes a `{{locale}}.` or `{{locale}}/` placeholder. It aims to
 * support [Zola’s multilingual sites](https://www.getzola.org/documentation/content/multilingual/).
 * @property {boolean} [omit_default_locale_from_preview_path] Whether to exclude the default locale
 * from preview URL paths. Default: `false`. This option helps to create cleaner URLs for the
 * default locale when generating preview links for multilingual content.
 * @see https://decapcms.org/docs/i18n/
 * @see https://sveltiacms.app/en/docs/i18n
 * @see https://github.com/decaporg/decap-cms/issues/6932
 */

/**
 * Body field options for front matter formats.
 * @typedef {object} BodyFieldOptions
 * @property {string} [key] Field name to store the body content when using a front matter format.
 * Default: `body`.
 * @property {boolean} [inline] Whether to store the body content in the front matter as a field
 * along with other fields. If `false`, the body content is stored as the main content of the file,
 * after the front matter block. Default: `false`.
 */

/**
 * Single file in a file/singleton collection.
 * @typedef {object} CollectionFile
 * @property {string} name Unique identifier for the file.
 * @property {string} [label] Label to be displayed in the editor UI. Default: `name` option value.
 * @property {string} [icon] Name of a [Material Symbols
 * icon](https://fonts.google.com/icons?icon.set=Material+Symbols) to be displayed in the collection
 * file list and other places. See the
 * [documentation](https://sveltiacms.app/en/docs/collections#icons) for details.
 * @property {string} file File path relative to the project root.
 * @property {Field[]} fields Set of fields to be included in the file.
 * @property {string} [media_folder] Internal media folder path for the collection. This overrides
 * the global or collection-level `media_folder` option.
 * @property {string} [public_folder] Public media folder path for the file. This overrides the
 * global or collection-level `public_folder` option. Default: `media_folder` option value.
 * @property {FileFormat} [format] File format. This overrides the collection-level `format` option.
 * Default: detected from the file extension, e.g. `yaml` for `.yml` and `frontmatter` for `.md`.
 * @property {string | string[]} [frontmatter_delimiter] Delimiters to be used for the front matter
 * format. This overrides the collection-level `frontmatter_delimiter` option. Default: depends on
 * the front matter type.
 * @property {BodyFieldOptions} [body_field] Body field options for front matter formats.
 * @property {I18nOptions | boolean} [i18n] I18n options. Default: `false`. It has no effect unless
 * i18n is also set up with the global option and, for a file collection, the collection-level
 * option.
 * @property {string} [preview_path] Preview URL path template, appended to the site URL or the
 * deploy preview URL to link to the entry. Without it, a published entry has no link, while an
 * unpublished Editorial Workflow entry links to the root of its deploy preview. See the
 * [documentation](https://sveltiacms.app/en/docs/workflows/deploy-previews) for details.
 * @property {string} [preview_path_date_field] Name of a top-level DateTime field used to fill the
 * date and time tags in `preview_path`. Default: the first DateTime field.
 * @property {EditorOptions} [editor] Editor view options.
 * @property {boolean} [readonly] Whether to make the file read-only. Default: `false`. The file can
 * be viewed but not edited, and its assets stored in a file-level media folder can’t be changed.
 * It’s also read-only if the collection-level or global `readonly` option is `true`.
 * @see https://decapcms.org/docs/collection-file/
 * @see https://decapcms.org/docs/deploy-preview-links/
 * @see https://sveltiacms.app/en/docs/collections/files
 */

/**
 * Supported file extension. Actually it can be any string.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'md' | 'markdown' | 'html' | 'txt' | string}
 * FileExtension
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */

/**
 * Supported Markdown front matter format.
 * @typedef {'yaml-frontmatter' | 'toml-frontmatter' | 'json-frontmatter'} FrontMatterFormat
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */

/**
 * Supported file format. Actually it can be any string because of custom formats.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'frontmatter' | FrontMatterFormat | 'raw' | string}
 * FileFormat
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */

/**
 * Collection filter options.
 * @typedef {object} CollectionFilter
 * @property {FieldKeyPath} field Field name.
 * @property {any | any[]} [value] Field value. `null` can be used to match an undefined field.
 * Multiple values can be defined with an array. This option or `pattern` is required.
 * @property {string | RegExp} [pattern] Regular expression matching pattern.
 * @see https://decapcms.org/docs/collection-folder/#filtered-folder-collections
 * @see https://sveltiacms.app/en/docs/collections/entries/listings#filtering-entries
 * @see https://github.com/decaporg/decap-cms/issues/7347
 */

/**
 * The default options for the sortable fields.
 * @typedef {object} SortableFieldsDefaultOptions
 * @property {FieldKeyPath} field A field name to be sorted by default.
 * @property {'ascending' | 'descending' | 'Ascending' | 'Descending' | 'None'} [direction] Default
 * sort direction. Title case values are supported for Static CMS compatibility. However, `None` is
 * the same as `ascending`. Default: `ascending`.
 */

/**
 * A collection’s advanced sortable fields definition, which is compatible with Static CMS.
 * @typedef {object} SortableFields
 * @property {FieldKeyPath[]} fields A list of sortable field names.
 * @property {SortableFieldsDefaultOptions} [default] Default sort settings. See the
 * [documentation](https://sveltiacms.app/en/docs/collections/entries/views#sorting) for details.
 * @see https://staticjscms.netlify.app/docs/collection-overview#sortable-fields
 */

/**
 * A value that a view filter or group compares the field value with. A string can contain the
 * `{{now}}` tag for the current date and time, the `{{today}}` tag for the current date in the
 * `YYYY-MM-DD` format, or the `{{year}}`, `{{month}}`, `{{day}}`, `{{hour}}`, `{{minute}}` and
 * `{{second}}` tags for the parts of the current date and time, all in the user’s local time zone.
 * The tags are resolved whenever the entry list is updated, and every minute while such a filter or
 * group is applied, so a filter like “Upcoming events” keeps working without a change to the
 * configuration.
 * @typedef {string | number | boolean} ViewComparisonValue
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */

/**
 * Comparison options for a view filter or group, which can be combined with each other and with
 * `pattern`. An entry has to satisfy all of them. The field value is compared as a date if the
 * field is a DateTime field, as a number if both the value and the given value are numeric, or as a
 * string otherwise. For a DateTime field, a given date should be in the same format as the field
 * value, or be the `{{now}}` or `{{today}}` tag; `{{today}}` is the one to use with a date-only
 * field, so that an entry dated today is included in a `gte` comparison.
 * @typedef {object} ViewComparisonOptions
 * @property {ViewComparisonValue} [eq] Value the field value has to be equal to.
 * @property {ViewComparisonValue} [ne] Value the field value has to be different from. An entry
 * without a value for the field also matches.
 * @property {ViewComparisonValue} [lt] Value the field value has to be less than, e.g. `{{now}}`
 * for past events.
 * @property {ViewComparisonValue} [lte] Value the field value has to be less than or equal to.
 * @property {ViewComparisonValue} [gt] Value the field value has to be greater than.
 * @property {ViewComparisonValue} [gte] Value the field value has to be greater than or equal to,
 * e.g. `{{today}}` for upcoming events.
 * @property {ViewComparisonValue[]} [in] Values one of which the field value has to be equal to.
 * @property {ViewComparisonValue[]} [not_in] Values the field value has to be different from. An
 * entry without a value for the field also matches.
 * @property {boolean} [empty] Whether the field value has to be empty (`true`) or not (`false`). A
 * value is empty if the field is missing from the entry, e.g. because it was added to the
 * configuration after the entry was created, or if it’s `null`, an empty string, an empty list, or
 * an Object field whose subfields are all empty. This works in every configuration format,
 * including TOML, which has no `null`.
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 * @see https://github.com/sveltia/sveltia-cms/issues/1004
 */

/**
 * View filter properties.
 * @typedef {object} ViewFilterProps
 * @property {string} [name] Unique identifier for the filter. Required when filters are defined
 * with the `filters` option, so that the `default` option can refer to it.
 * @property {string} label Label of the filter to be displayed in the entry list UI.
 * @property {FieldKeyPath} field Field name.
 * @property {string | RegExp | boolean} [pattern] Regular expression matching pattern or exact
 * value. Required unless one of the comparison options is defined.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */

/**
 * View filter.
 * @typedef {ViewFilterProps & ViewComparisonOptions} ViewFilter
 */

/**
 * A collection’s advanced filter definition, which is compatible with Static CMS.
 * @typedef {object} ViewFilters
 * @property {ViewFilter[]} filters A list of view filters.
 * @property {string} [default] Default filter name.
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-filters
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */

/**
 * View group properties.
 * @typedef {object} ViewGroupProps
 * @property {string} [name] Unique identifier for the group. Required when groups are defined with
 * the `groups` option, so that the `default` option and the `reorder.group` option can refer to it.
 * @property {string} label Label of the group to be displayed in the entry list UI. With a
 * comparison option, the entries satisfying the condition are grouped under this label, and the
 * other entries under “Other”.
 * @property {FieldKeyPath} field Field name.
 * @property {string | RegExp | boolean} [pattern] Regular expression matching pattern or exact
 * value. Entries are grouped by the matched part of the field value. Without a `pattern` or a
 * comparison option, entries are grouped by the field value itself.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 * @see https://sveltiacms.app/en/docs/collections/entries/views#grouping
 */

/**
 * View group.
 * @typedef {ViewGroupProps & ViewComparisonOptions} ViewGroup
 */

/**
 * A collection’s advanced group definition, which is compatible with Static CMS.
 * @typedef {object} ViewGroups
 * @property {ViewGroup[]} groups A list of view groups.
 * @property {string} [default] Default group name.
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-groups
 * @see https://sveltiacms.app/en/docs/collections/entries/views#grouping
 */

/**
 * A collection’s advanced entry reordering options.
 * @typedef {object} ReorderOptions
 * @property {string} [key] Property name used to save the numeric order of each entry. Default:
 * `order`.
 * @property {string} [group] The `name` of one of the collection’s `view_groups`, e.g.
 * `categories`. Entries are grouped by it in reorder mode and can only be reordered within their
 * own group, with the order field numbered group by group. Default: no grouping, so the entry list
 * becomes a single flat sequence while reordering.
 * @see https://sveltiacms.app/en/docs/collections/entries/operations#reordering-entries
 */

/**
 * Editor options.
 * @typedef {object} EditorOptions
 * @property {boolean} [preview] Whether to show the preview pane. Default: `true`.
 * @see https://decapcms.org/docs/configuration-options/#editor
 * @see https://sveltiacms.app/en/docs/ui/content-editor#disabling-previews
 */

/**
 * Nested collection options.
 * @typedef {object} NestedCollectionOptions
 * @property {number} [depth] Maximum number of path segments below the collection folder, which is
 * both the depth of the collection tree and the depth at which entry files are looked up. Default:
 * `Infinity`.
 * @property {string} [summary] Summary template for a tree item, which overrides the collection’s
 * `summary` option. Default: the collection’s `summary` option value.
 * @property {boolean} [subfolders] Whether each entry is stored as an index file in its own
 * subfolder. If `false`, entries are regular files placed directly in the folders. Default: `true`.
 * @see https://decapcms.org/docs/collection-nested/
 * @see https://sveltiacms.app/en/docs/collections/entries/nested#nested-collection-options
 */

/**
 * Collection meta data’s path options.
 * @typedef {object} CollectionMetaDataPath
 * @property {string} [widget] Field type for editing the path name. Accepted for compatibility with
 * Netlify/Decap CMS but ignored: the editor is always a folder picker.
 * @property {string} [label] Label for the path editor. Accepted for compatibility with
 * Netlify/Decap CMS but ignored: the picker has a built-in, localized label.
 * @property {string} [index_file] File name, without an extension, shared by every entry in the
 * collection, e.g. `_index`. If omitted, each entry keeps its own file name.
 * @see https://decapcms.org/docs/collection-nested/
 * @see https://sveltiacms.app/en/docs/collections/entries/nested#choosing-a-parent-folder
 */

/**
 * Collection meta data.
 * @typedef {object} CollectionMetaData
 * @property {CollectionMetaDataPath} [path] Entry path options.
 * @see https://decapcms.org/docs/collection-nested/
 * @see https://sveltiacms.app/en/docs/collections/entries/nested#choosing-a-parent-folder
 */

/**
 * Index file inclusion options. See the
 * [documentation](https://sveltiacms.app/en/docs/collections/entries/listings#managing-hugo-s-special-index-file)
 * for details.
 * @typedef {object} CollectionIndexFile
 * @property {string} [name] Index file name without a locale or file extension. Default: `_index`,
 * which is used for Hugo’s special index file.
 * @property {FileExtension} [extension] File extension of the index file, if it differs from the
 * entries’. Default: the collection’s `extension`, or the one that goes with `format` if given.
 * This allows an Eleventy [directory data file](https://www.11ty.dev/docs/data-template-dir/) like
 * `posts/posts.json` to be managed beside the Markdown entries in the same folder.
 * @property {FileFormat} [format] File format of the index file, if it differs from the entries’.
 * Default: detected from `extension` if given, or the collection’s `format`.
 * @property {string} [label] Label to be displayed in the editor UI. Default: Index File or its
 * localized version.
 * @property {string} [icon] Name of a [Material Symbols
 * icon](https://fonts.google.com/icons?icon.set=Material+Symbols) to be displayed in the editor UI.
 * Default: `home`.
 * @property {Field[]} [fields] Set of fields for the index file. If omitted, the regular entry
 * collection `fields` will be used instead.
 * @property {EditorOptions} [editor] Editor view options.
 * @see https://github.com/decaporg/decap-cms/issues/7381
 */

/**
 * A divider in the collection list and singleton list. See the
 * [documentation](https://sveltiacms.app/en/docs/collections#dividers) for details.
 * @typedef {object} CollectionDivider
 * @property {string} [name] Unique identifier for the divider. Can be omitted. This property is
 * included here because in the previous version of Sveltia CMS, a divider was defined as a
 * collection with the `divider` option set to `true`, and the `name` option was required.
 * @property {boolean} divider Whether to make this collection a divider UI in the collection list.
 * It must be `true` to be used as a divider.
 */

/**
 * Base collection properties.
 * @typedef {object} BaseCollectionProps
 * @property {string} name Unique identifier for the collection.
 * @property {string} [label] Label of the collection to be displayed in the editor UI. Default:
 * `name` option value.
 * @property {string} [icon] Name of a [Material Symbols
 * icon](https://fonts.google.com/icons?icon.set=Material+Symbols) to be displayed in the collection
 * list.
 * @property {boolean} [readonly] Whether to make the collection read-only. Default: `false`. Its
 * entries or files can be viewed but not created, edited, duplicated, reordered, deleted or moved
 * through the Editorial Workflow stages, and assets can’t be uploaded to, changed or deleted from
 * its media folders. For an asset collection, assets can’t be uploaded to, changed or deleted
 * from the folder. It’s also read-only if the global `readonly` option is `true`. For a file
 * collection, each file can also be made read-only with its own `readonly` option.
 */

/**
 * Common collection properties.
 * @typedef {object} CommonCollectionProps
 * @property {string} [label_singular] Singular UI label. It will be Blog Post if the `label` is
 * Blog Posts, for example. Default: `label` option value.
 * @property {string} [description] Short description of the collection to be displayed in the
 * editor UI.
 * @property {string} [media_folder] Internal media folder path for the collection. This overrides
 * the global `media_folder` option. It can be a relative path from the project root if it starts
 * with a slash. Otherwise it’s a path relative to the entry, or to the file for a file collection.
 * If this option is omitted, the global `media_folder` option value is used, except for an entry
 * collection with the `path` option, where the entry’s own folder is used.
 * See the
 * [documentation](https://sveltiacms.app/en/docs/media/internal#collection-level-configuration) for
 * details.
 * @property {string} [public_folder] Public media folder path for the collection. This overrides
 * the global `public_folder` option. Default: `media_folder` option value.
 * @property {boolean} [hide] Whether to hide the collection in the UI. Default: `false`.
 * @property {'simple' | 'editorial_workflow'} [publish_mode] Publish mode for the collection. This
 * overrides the global `publish_mode` option, so Editorial Workflow can be enabled for some
 * collections only, or turned off for a collection when it’s enabled globally. Default: global
 * `publish_mode` option value. Note that a contributor working on a fork with Open Authoring always
 * goes through Editorial Workflow, regardless of this option.
 * @property {boolean} [publish] Whether to show the publishing control UI for Editorial Workflow.
 * Default: `true`. Set this to `false` to let editors move an entry through the review stages
 * without being able to publish it themselves. It has no effect unless the `editorial_workflow`
 * publish mode is enabled.
 * @property {FileFormat} [format] File format. It should match the file extension. Default:
 * detected from the file extension: `frontmatter` for Markdown files like `.md`, which reads
 * YAML, TOML or JSON front matter and writes YAML front matter, `yaml` for `.yml`/`.yaml`, `toml`
 * for `.toml`, `json` for `.json`, `raw` for `.astro`, and `yaml-frontmatter` otherwise.
 * @property {string | string[]} [frontmatter_delimiter] Delimiters to be used for the front matter
 * format. Default: depends on the front matter type.
 * @property {BodyFieldOptions} [body_field] Body field options for front matter formats.
 * @property {I18nOptions | boolean} [i18n] I18n options. Default: `false`.
 * @property {string} [preview_path] Preview URL path template, appended to the site URL or the
 * deploy preview URL to link to the entry. Without it, a published entry has no link, while an
 * unpublished Editorial Workflow entry links to the root of its deploy preview. For a file
 * collection, define it on each file instead. See the
 * [documentation](https://sveltiacms.app/en/docs/workflows/deploy-previews) for details.
 * @property {string} [preview_path_date_field] Name of a top-level DateTime field used to fill the
 * date and time tags in `preview_path`. Default: the first DateTime field. For a file collection,
 * define it on each file instead.
 * @property {EditorOptions} [editor] Editor view options.
 * @property {boolean} [yaml_quote] Whether to double-quote all the strings values if the YAML
 * format is used for file output. Default: `false`. DEPRECATED: Use the global YAML format options.
 * `yaml_quote: true` is equivalent to `output.yaml.quote: double`. See the documentation
 * https://sveltiacms.app/en/docs/data-output#controlling-data-output for details.
 * @see https://github.com/decaporg/decap-cms/issues/1571
 * @see https://decapcms.org/docs/configuration-options/#collections
 * @see https://sveltiacms.app/en/docs/collections/entries
 * @see https://sveltiacms.app/en/docs/collections/files
 */

/**
 * Entry collection properties.
 * @typedef {object} EntryCollectionProps
 * @property {string} [folder] Base folder path relative to the project root. It can contain
 * slashes to create subfolders. With i18n enabled, it can also contain the `{{locale}}` placeholder
 * as a whole folder name, like `content/{{locale}}/posts`, to say where each locale’s folder goes.
 * The placeholder takes precedence over the `structure` i18n option: the collection then has one
 * folder per locale wherever the placeholder is, and the `omit_default_locale_from_file_path`
 * option leaves the default locale’s folder out. See the
 * [documentation](https://sveltiacms.app/en/docs/i18n/structures) for details. Either this or the
 * `file` option is required.
 * @property {string} [file] Path to a JSON file, relative to the project root, that stores all the
 * entries of the collection as an array of objects, instead of one file per entry in a `folder`.
 * Each object in the array is an entry, and the entries can be reordered with a drag-and-drop UI,
 * which changes the order of the objects in the array. Saving an entry rewrites the whole file.
 * Options that assume one file per entry, like `path`, `slug`, `extension`, `nested` and
 * `index_file`, are not available, and Editorial Workflow is not supported, including a Relation
 * field referring to a collection with Editorial Workflow. With i18n enabled,
 * each object holds all the translations with the `single_file` structure, or the
 * `single_file_default_root` structure if it’s configured; the `{{locale}}` placeholder is not
 * supported. The slug of an entry is its position in the array, so a Relation field referring to
 * the collection must store a field value with the `value_field` option, and the `preview_path`
 * and `thumbnail` options can’t contain the `{{slug}}` tag. Either this or the `folder` option is
 * required.
 * @property {Field[]} fields Set of fields to be included in entries.
 * @property {string} [path] File path relative to `folder`, without a file extension. It can
 * contain slashes to create subfolders. Default: `{{slug}}`. To use Hugo’s page bundle, set this to
 * `{{slug}}/index`.
 * @property {CollectionFilter} [filter] Entry filter.
 * @property {boolean} [create] Whether to allow users to create entries in the collection. Default:
 * `true`. Note that the default value is `false` in Netlify/Decap CMS, whereas Sveltia CMS sets it
 * to `true` to provide a better out-of-the-box experience.
 * @property {boolean} [delete] Whether to allow users to delete entries in the collection. Default:
 * `true`.
 * @property {boolean} [duplicate] Whether to allow users to duplicate entries in the collection.
 * Default: `true`.
 * @property {boolean | ReorderOptions} [reorder] Whether to allow users to reorder entries in the
 * collection. Default: `false`. If set to `true`, entries can be reordered with a drag-and-drop UI,
 * and the numeric order starting from 1 is saved in an automatically generated `order` field. An
 * object can be provided instead to customize the behavior, e.g. `{ key: 'weight', group:
 * 'categories' }`.
 * @property {FileExtension} [extension] File extension. Default: derived from the `format` option
 * value, e.g. `yml` for `yaml` and `txt` for `raw`, or `md` otherwise.
 * @property {FieldKeyPath} [identifier_field] Field name to be used as the title and slug of an
 * entry. Default: `title`.
 * @property {string | CollectionSlugOptions} [slug] Item slug template, or an object with the
 * template and the options to let users edit the slug. Default: `identifier_field` option value.
 * The template cannot contain slashes; to organize entries in subfolders, use the `path` option
 * instead. It’s possible to [localize the
 * slug](https://sveltiacms.app/en/docs/i18n/slugs#localizing-entry-slugs) or [use a random
 * ID](https://sveltiacms.app/en/docs/collections/entries/slugs#slug-template-tags). The
 * `{{fields._slug}}` and `{{fields._slug | localize}}` tags, which show a slug editor in new entry
 * drafts, are deprecated; use the object form with the `editable` and `i18n` options instead.
 * @property {number} [slug_length] The maximum number of characters allowed for an entry slug.
 * Default: `Infinity`.
 * DEPRECATED: Use the global `slug.maxlength` option instead.
 * @property {string} [summary] Entry summary template displayed in the entry list, e.g.
 * `{{title}} ({{date | date('YYYY-MM-DD')}})`. Default: the value of the `identifier_field`,
 * `title`, `name` or `label` field, or the first heading in the `body` field.
 * @property {FieldKeyPath[] | SortableFields} [sortable_fields] Custom sortable fields. Default:
 * `title`, `name`, `date`, `author` and `description`, or the `identifier_field` in place of
 * `title`, as long as the fields exist. For a Git backend, `commit_author` and `commit_date` are
 * also available, and added to the list if `author` and `date` are not included. See the
 * [documentation](https://sveltiacms.app/en/docs/collections/entries/views#sorting) for details.
 * @property {ViewFilter[] | ViewFilters} [view_filters] View filters to be used in the entry list.
 * @property {ViewGroup[] | ViewGroups} [view_groups] View groups to be used in the entry list.
 * @property {NestedCollectionOptions} [nested] Options for a nested collection, which shows the
 * entries in a folder tree and lets the user organize them in subfolders.
 * @property {CollectionMetaData} [meta] Meta data for a nested collection, which enables the entry
 * path editor. It has no effect without the `nested` option.
 * @property {CollectionIndexFile | boolean} [index_file] Index file inclusion options. If `true`,
 * the default index file name is `_index`, which is used for Hugo’s special index file. See the
 * [documentation](https://sveltiacms.app/en/docs/collections/entries/listings#managing-hugo-s-special-index-file)
 * for details.
 * @property {boolean | FieldKeyPath | FieldKeyPath[]} [thumbnail] Whether to show entry thumbnails
 * in the entry list. Default: `true` (auto-detect image/file fields). Set to `false` to disable, or
 * provide a field key path (e.g., `heroImage.src`) or an array of paths for fallbacks. Supports
 * nested fields with dot notation and wildcards (e.g., `images.*.src`). A value starting with a
 * slash is a file path instead, resolved like an Image field value, which can contain template tags
 * like the `preview_path` option, e.g. `/images/thumbnails/{{slug}}.webp`. Date and time tags are
 * filled from the field named with the `preview_path_date_field` option, or the first DateTime
 * field. An empty array equals `false`.
 * @property {number} [limit] The maximum number of entries that can be created in the collection.
 * Default: `Infinity`.
 * @property {FieldKeyPath | boolean} [aliases_field] Property name used to store URL aliases
 * (redirects) from an entry’s previous paths to its current path. Default: `aliases`, which is what
 * Hugo and Zola support out of the box. When an editor changes an entry’s slug, the entry’s
 * previous path is appended to this property. Set this to `false` to skip the processing. It has no
 * effect unless the `preview_path` option is also defined, because that option is what tells the
 * CMS an entry’s path on the live site. It also has no effect if a field with the same name is
 * defined in the `fields` option, in which case the property is left to the editor to manage.
 * @see https://decapcms.org/docs/collection-folder/
 * @see https://sveltiacms.app/en/docs/collections/entries
 */

/**
 * Stage of an entry’s life at which its slug can be edited: when the entry is created, or once it
 * has been saved.
 * @typedef {'create' | 'update'} SlugEditableStage
 */

/**
 * Entry slug options for an entry collection. Not to be confused with the global `slug` option,
 * which defines how slugs are formatted across the site.
 * @typedef {object} CollectionSlugOptions
 * @property {string} [template] Slug template. Default: `identifier_field` option value. It cannot
 * contain slashes; to organize entries in subfolders, use the `path` option instead.
 * @property {boolean | SlugEditableStage[]} [editable] Whether users can edit the slug. `true`
 * means both when an entry is created and once it has been saved, `false` means neither, and an
 * array like `[create]` or `[update]` picks the stages. Default: `true`. When the slug is editable
 * on creation, a new entry draft shows a slug field, prefilled with the slug the template fills,
 * whose value takes over from the template once it’s typed in. If the option is set to allow it
 * without a `template`, the slug has to be typed in.
 * @property {boolean | 'duplicate'} [i18n] Whether each locale has a slug of its own. `true` lets
 * users edit the slug for each locale, and fills every field tag in the template with the locale’s
 * own value. `duplicate` (default) and `false` share the default locale’s slug with the other
 * locales. It only has an effect with the `multiple_files`, `multiple_folders` or
 * `multiple_root_folders` i18n structure, or the `{{locale}}` placeholder in the `folder` option.
 * @property {string} [hint] Short description shown at the top of the entry sidebar’s Slug panel.
 * @property {[string | RegExp, string]} [pattern] Validation format of the slug. The first argument
 * is a regular expression matching pattern for a valid slug, and the second argument is an error
 * message to be displayed when the slug does not match the pattern.
 * @see https://github.com/sveltia/sveltia-cms/issues/999
 */

/**
 * Entry collection definition. In Netlify/Decap CMS, an entry collection is called a folder
 * collection.
 * @typedef {BaseCollectionProps & CommonCollectionProps & EntryCollectionProps} EntryCollection
 */

/**
 * File collection properties.
 * @typedef {object} FileCollectionProps
 * @property {CollectionFile[]} files A set of files.
 * @see https://decapcms.org/docs/collection-file/
 * @see https://sveltiacms.app/en/docs/collections/files
 */

/**
 * File collection definition.
 * @typedef {BaseCollectionProps & CommonCollectionProps & FileCollectionProps} FileCollection
 */

/**
 * Collection definition.
 * @typedef {EntryCollection | FileCollection} Collection
 */

/**
 * Properties for an asset collection.
 * @typedef {object} AssetCollectionProps
 * @property {string} media_folder Internal media folder path for the collection, relative to the
 * project root.
 * @property {string} [public_folder] Public media folder path for the asset collection. Default:
 * `media_folder` option value.
 */

/**
 * Asset collection definition.
 * @typedef {BaseCollectionProps & AssetCollectionProps} AssetCollection
 */

/**
 * Supported Git backend name.
 * @typedef {'github' | 'gitlab' | 'gitea'} GitBackendName
 */

/**
 * Supported backend name.
 * @typedef {GitBackendName | 'test-repo'} BackendName
 */

/**
 * Custom commit messages.
 * @typedef {object} CommitMessages
 * @property {string} [create] Message to be used when a new entry is created.
 * @property {string} [update] Message to be used when existing entries are updated.
 * @property {string} [delete] Message to be used when existing entries are deleted.
 * @property {string} [uploadMedia] Message to be used when new files are uploaded/updated.
 * @property {string} [deleteMedia] Message to be used when existing files are deleted.
 * @property {string} [openAuthoring] Message to be used when committed via a forked repository.
 * @see https://decapcms.org/docs/configuration-options/#commit-message-templates
 * @see https://sveltiacms.app/en/docs/backends#commit-messages
 */

/**
 * Authentication method name for Git backends.
 * @typedef {'oauth' | 'token'} AuthMethodName
 */

/**
 * Git backend properties.
 * @typedef {object} GitBackendProps
 * @property {string} [branch] Git branch name. If omitted, the default branch, usually `main` or
 * `master`, will be automatically detected and used.
 * @property {string} [site_domain] Site domain used for OAuth, which will be included in the
 * `site_id` param to be sent to the API endpoint. Default: [current
 * hostname](https://developer.mozilla.org/en-US/docs/Web/API/Location/hostname) (or
 * `cms.netlify.com` on `localhost`).
 * @property {CommitMessages} [commit_messages] Custom commit messages.
 * @property {boolean} [automatic_deployments] Whether to enable or disable automatic deployments
 * with any connected CI/CD provider. Default: `undefined`.
 * DEPRECATED: Use the new `skip_ci` option instead, which is more intuitive.
 * `automatic_deployments: false` is equivalent to `skip_ci: true`, and `automatic_deployments:
 * true` is equivalent to `skip_ci: false`. See the documentation
 * https://sveltiacms.app/en/docs/deployments#disabling-automatic-deployments for details.
 * @property {boolean} [skip_ci] Whether to enable or disable automatic deployments with any
 * connected CI/CD provider, such as GitHub Actions or Cloudflare Pages. If `true`, the `[skip ci]`
 * prefix will be added to commit messages, except for deletions. Setting it to either `true` or
 * `false` also lets users trigger a deployment manually and toggle the prefix for each save.
 * Default: `undefined`. See the
 * [documentation](https://sveltiacms.app/en/docs/deployments#disabling-automatic-deployments) for
 * details.
 * @property {AuthMethodName[]} [auth_methods] Allowed authentication methods. Default: both `oauth`
 * and `token` are allowed. To restrict sign-in options, specify only the methods you want to
 * enable, e.g. `[oauth]` to disable access token sign-in, or `[token]` to disable OAuth sign-in. An
 * empty array is invalid and will result in a configuration error.
 * @property {boolean} [include_credentials] Whether to include credentials in API requests.
 * Default: `false`. If set to `true`, credentials such as cookies will be included in API requests.
 * This is only necessary when using cookie-based authentication with a self-hosted Git backend.
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://sveltiacms.app/en/docs/backends
 */

/**
 * GitHub backend properties.
 * @typedef {object} GitHubBackendProps
 * @property {'github'} name Backend name.
 * @property {string} repo Repository identifier: organization/user name and repository name joined
 * by a slash, e.g. `owner/repo`.
 * @property {string} [api_root] REST API endpoint for the backend. Required when using GitHub
 * Enterprise Server, for which `https://HOSTNAME/api/v3` or just `https://HOSTNAME` can be given.
 * Default: `https://api.github.com`.
 * @property {string} [graphql_api_root] GraphQL API endpoint for the backend. Default: inferred
 * from the `api_root` option value: `https://api.github.com/graphql` for GitHub.com, and
 * `https://HOSTNAME/api/graphql` for GitHub Enterprise Server.
 * @property {string} [base_url] OAuth base URL origin. Required when using an OAuth client other
 * than Netlify, including [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth).
 * Default: `https://api.netlify.com`.
 * @property {''} [auth_type] OAuth grant type. The default is an empty string, which is
 * authorization code grant. `pkce` is not yet supported due to GitHub’s limitations.
 * @property {string} [auth_endpoint] OAuth base URL path. Default: `auth`.
 * @property {string} [app_id] OAuth application ID. Not used at this time; reserved for PKCE
 * authorization, which is not yet supported with GitHub.
 * @property {string} [cms_label_prefix] Pull request label prefix used when writing Editorial
 * Workflow labels. Default: `sveltia-cms/`. When reading labels, the `sveltia-cms/`, `netlify-cms/`
 * and `decap-cms/` prefixes are also recognized, so unpublished entries created with a different
 * prefix or with Netlify/Decap CMS remain editable.
 * @property {boolean} [squash_merges] Whether to use squash merge for Editorial Workflow. Default:
 * `false`.
 * @property {string} [preview_context] Name of the commit status context or deployment environment
 * that carries the deploy preview URL, matched as a case-insensitive substring. Default: any
 * context or environment that looks like a deploy preview. See the
 * [documentation](https://sveltiacms.app/en/docs/workflows/deploy-previews) for details.
 * @property {boolean} [open_authoring] Whether to enable Open Authoring, which lets a contributor
 * without write access to the repository propose changes from a fork. It requires the
 * `editorial_workflow` publish mode. Default: `false`. See the
 * [documentation](https://sveltiacms.app/en/docs/workflows/open) for details.
 * @property {'repo' | 'public_repo'} [auth_scope] OAuth scope to request when signing in. Default:
 * `repo`. With Open Authoring on a public repository, `public_repo` is enough and asks the
 * contributor for a narrower grant. A private repository always needs `repo`.
 * @see https://decapcms.org/docs/github-backend/
 * @see https://decapcms.org/docs/editorial-workflows/
 * @see https://decapcms.org/docs/open-authoring/
 * @see https://sveltiacms.app/en/docs/backends/github
 * @see https://sveltiacms.app/en/docs/workflows/editorial
 * @see https://sveltiacms.app/en/docs/workflows/open
 */

/**
 * GitHub backend.
 * @typedef {GitBackendProps & GitHubBackendProps} GitHubBackend
 */

/**
 * GitLab backend properties.
 * @typedef {object} GitLabBackendProps
 * @property {'gitlab'} name Backend name.
 * @property {string} repo Repository identifier: namespace and project name joined by a slash, e.g.
 * `group/project` or `group/subgroup/project`.
 * @property {string} [api_root] REST API endpoint for the backend. Required when using a
 * self-hosted GitLab instance. Default: `https://gitlab.com/api/v4`.
 * @property {string} [graphql_api_root] GraphQL API endpoint for the backend. Default: inferred
 * from the `api_root` option value by replacing the path after `/api/` with `graphql`, e.g.
 * `https://gitlab.com/api/graphql`.
 * @property {string} [base_url] OAuth base URL origin. With authorization code grant, it’s required
 * when using an OAuth client other than Netlify, including [Sveltia CMS
 * Authenticator](https://github.com/sveltia/sveltia-cms-auth). With PKCE authorization, it’s the
 * URL of the GitLab instance, including the subpath if it’s served under one, which is not inferred
 * from `api_root`, so it’s required for a self-hosted instance. Default: `https://api.netlify.com`,
 * or `https://gitlab.com` when `auth_type` is `pkce`.
 * @property {'' | 'pkce'} [auth_type] OAuth grant type. The default is an empty string, which is
 * authorization code grant. `pkce` is recommended for better security and easier setup. `implicit`
 * is not supported in Sveltia CMS.
 * @property {string} [auth_endpoint] OAuth base URL path. Default: `auth`, or `oauth/authorize`
 * when `auth_type` is `pkce`.
 * @property {string} [app_id] OAuth application ID. Required when using PKCE authorization.
 * @property {string} [cms_label_prefix] Merge request label prefix used when writing Editorial
 * Workflow labels. Default: `sveltia-cms/`. When reading labels, the `sveltia-cms/`, `netlify-cms/`
 * and `decap-cms/` prefixes are also recognized, so unpublished entries created with a different
 * prefix or with Netlify/Decap CMS remain editable.
 * @property {boolean} [squash_merges] Whether to use squash merge for Editorial Workflow. Default:
 * `false`.
 * @property {string} [preview_context] Name of the commit status context or deployment environment
 * that carries the deploy preview URL, matched as a case-insensitive substring. Default: any
 * context or environment that looks like a deploy preview. See the
 * [documentation](https://sveltiacms.app/en/docs/workflows/deploy-previews) for details.
 * @see https://decapcms.org/docs/gitlab-backend/
 * @see https://decapcms.org/docs/editorial-workflows/
 * @see https://sveltiacms.app/en/docs/backends/gitlab
 * @see https://sveltiacms.app/en/docs/workflows/editorial
 */

/**
 * GitLab backend.
 * @typedef {GitBackendProps & GitLabBackendProps} GitLabBackend
 */

/**
 * Gitea/Forgejo backend properties.
 * @typedef {object} GiteaBackendProps
 * @property {'gitea'} name Backend name.
 * @property {string} repo Repository identifier: organization/user name and repository name joined
 * by a slash, e.g. `owner/repo`.
 * @property {string} [api_root] REST API endpoint for the backend. Required when using a
 * self-hosted Gitea/Forgejo instance. Default: `https://gitea.com/api/v1`.
 * @property {string} [base_url] OAuth base URL, which is the URL of the Gitea/Forgejo instance,
 * including the subpath if it’s served under one, as OAuth sign-in always uses PKCE authorization
 * without an OAuth client. It’s not inferred from `api_root`, so it’s required when using a
 * self-hosted instance or Codeberg.
 * Default: `https://gitea.com`.
 * @property {string} [auth_endpoint] OAuth base URL path. Default: `login/oauth/authorize`.
 * @property {string} [app_id] OAuth application ID. Required for OAuth sign-in; without one, users
 * can still sign in with a personal access token.
 * @see https://decapcms.org/docs/gitea-backend/
 * @see https://sveltiacms.app/en/docs/backends/gitea-forgejo
 */

/**
 * Gitea/Forgejo backend.
 * @typedef {GitBackendProps & GiteaBackendProps} GiteaBackend
 */

/**
 * Git-based backend.
 * @typedef {GitHubBackend | GitLabBackend | GiteaBackend} GitBackend
 */

/**
 * Test backend.
 * @typedef {object} TestBackend
 * @property {'test-repo'} name Backend name.
 * @see https://decapcms.org/docs/test-backend/
 * @see https://sveltiacms.app/en/docs/backends/test
 */

/**
 * Backend options.
 * @typedef {GitBackend | TestBackend} Backend
 */

/**
 * Global media storage options.
 * @typedef {object} GlobalMediaLibraryOptions
 * @property {MediaLibraryName} [name] Library name. Default: `default`, the internal media storage.
 */

/**
 * Custom logo options.
 * @typedef {object} LogoOptions
 * @property {string} [src] Absolute URL or absolute path to the site logo that will be displayed on
 * the entrance page and the browser’s tab (favicon). A square image works best. Falls back to the
 * deprecated `logo_url` option.
 * @property {boolean} [show_in_header] Whether to show the logo in the header. It has no effect
 * unless a custom logo is set with `src`. Default: `true`.
 */

/**
 * Entry slug options.
 * @typedef {object} SlugOptions
 * @property {'unicode' | 'ascii'} [encoding] Encoding option. Default: `unicode`.
 * @property {boolean} [clean_accents] Whether to remove accents. Default: `false`.
 * @property {string} [sanitize_replacement] String to replace sanitized characters. Default: `-`.
 * @property {number} [maxlength] The maximum number of characters allowed for an entry slug.
 * Default: `Infinity`.
 * @property {boolean} [trim] Whether to trim leading and trailing replacement characters. Default:
 * `true`.
 * @property {boolean} [lowercase] Whether to convert the slug to lowercase. Default: `true`.
 * @property {'utc' | 'local'} [timezone] Timezone to be used for date-based slug template tags,
 * such as `{{day}}` and `{{hour}}`. Default is `utc` for backward compatibility with Netlify/Decap
 * CMS. Use `local` to generate slugs based on the local time of the user’s browser, which is more
 * intuitive in most cases.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://sveltiacms.app/en/docs/collections/entries/slugs#global-slug-options
 */

/**
 * JSON format options.
 * @typedef {object} JsonFormatOptions
 * @property {'space' | 'tab'} [indent_style] Indent style. Default: `space`.
 * @property {number} [indent_size] Number of spaces or tabs per indent level. Default: `2` for
 * spaces, `1` for tabs.
 * @see https://sveltiacms.app/en/docs/data-output#controlling-data-output
 */

/**
 * YAML format options.
 * @typedef {object} YamlFormatOptions
 * @property {number} [indent_size] Indent size. Default: `2`.
 * @property {boolean} [indent_sequences] Whether to indent block sequences. Default: `true`.
 * @property {'none' | 'single' | 'double'} [quote] Default quote type for string values. `none`
 * leaves strings unquoted unless quotes are required. Default: `none`.
 * @see https://sveltiacms.app/en/docs/data-output#controlling-data-output
 * @see https://eemeli.org/yaml/#tostring-options
 */

/**
 * Data output options. See the
 * [documentation](https://sveltiacms.app/en/docs/data-output#controlling-data-output) for details.
 * @typedef {object} OutputOptions
 * @property {boolean} [omit_empty_optional_fields] Whether to prevent fields with `required: false`
 * and an empty value from being included in entry data output. Default: `false`.
 * @property {boolean} [encode_file_path] Whether to encode the file path in File/Image fields.
 * Default: `false`. This is useful when a file path contains special characters that need to be
 * URL-encoded, such as spaces and parentheses. For example, `Hello World (1).webp` would be
 * `Hello%20World%20%281%29.webp`. In general, File/Image fields should contain the original file
 * path, and web-specific encoding should be done in the front-end code.
 * @property {JsonFormatOptions} [json] JSON format options.
 * @property {YamlFormatOptions} [yaml] YAML format options.
 * @see https://sveltiacms.app/en/docs/data-output#controlling-data-output
 */

/**
 * Issue reporting options. Accepted for compatibility with Decap CMS but ignored: the Report Issue
 * link in the Help menu always points to the Sveltia CMS issue tracker.
 * @typedef {object} IssueReports
 * @property {string} [url] URL of the issue reporting endpoint.
 * @see https://github.com/decaporg/decap-cms/pull/7734
 */

/**
 * Default options for fields. These options will be applied to all fields of the specified type
 * unless they are overridden by field-specific options.
 * @typedef {object} FieldDefaults
 * @property {RichTextFieldBaseProps} [richtext] Default options for the RichText and Markdown
 * field types.
 */

/**
 * CMS configuration.
 * @typedef {object} CmsConfig
 * @property {boolean} [load_config_file] Whether to load YAML/JSON CMS configuration file(s) when
 * [manually initializing the CMS](https://sveltiacms.app/en/docs/api/initialization). This works
 * only in the `CMS.init()` method’s `config` option. Default: `true`.
 * @property {Backend} backend Backend options.
 * @property {'' | 'simple' | 'editorial_workflow'} [publish_mode] Publish mode. An empty string is
 * the same as `simple`. Default: `simple`. It can be overridden for each collection with the
 * collection-level `publish_mode` option. Note that Editorial Workflow is currently supported with
 * the GitHub and GitLab backends only.
 * @property {string} [media_folder] Global internal media folder path, relative to the project’s
 * root directory. Required unless a cloud media storage is configured.
 * @property {string} [public_folder] Global public media folder path, relative to the project’s
 * public URL, e.g. `/images/uploads`. A leading slash is added if missing, while a relative path
 * starting with `./` or `../` and a full URL are not allowed. Default: `/` followed by the
 * `media_folder` option value.
 * @property {MediaLibrary & GlobalMediaLibraryOptions} [media_library] Legacy media storage option
 * that allows only one library. Use `media_libraries` instead to support multiple storage
 * providers. If both options define the same library, `media_libraries` takes precedence.
 * @property {MediaLibraries} [media_libraries] Unified media storage option that supports multiple
 * libraries. See the [documentation](https://sveltiacms.app/en/docs/media#configuration) for
 * details.
 * @property {string} [app_title] Custom title for the CMS, which will be displayed on the login
 * page and the browser’s tab. Default: `Sveltia CMS`.
 * @property {string} [site_url] Site URL. Default: current site’s origin
 * ([`location.origin`](https://developer.mozilla.org/en-US/docs/Web/API/Location/origin)).
 * @property {string} [display_url] Site URL linked from the UI. Default: `site_url` option value.
 * @property {string} [logo_url] Absolute URL or absolute path to the site logo that will be
 * displayed on the entrance page and the browser’s tab (favicon). A square image works best.
 * Default: Sveltia logo.
 * DEPRECATED: This option is superseded by the new `logo.src` option. See the documentation
 * https://sveltiacms.app/en/docs/customization#custom-logo for details.
 * @property {LogoOptions} [logo] Site logo options.
 * @property {string} [logout_redirect_url] URL to redirect users to after logging out. Default:
 * none, so users stay on the CMS sign-in page.
 * @property {IssueReports} [issue_reports] Issue reporting options. Accepted for compatibility with
 * Decap CMS but ignored.
 * @property {boolean} [show_preview_links] Whether to show links to entries on the live site and
 * on deploy previews. Default: `true`.
 * @property {SlugOptions} [slug] Slug options, which apply to entry slugs and to the names of entry
 * folders created or renamed in a nested collection. They also apply to uploaded asset file names
 * and new asset folder names if the `slugify_filename` media library option is enabled.
 * @property {(Collection | CollectionDivider)[]} [collections] Set of collections. The list can
 * also contain dividers, which are used to group collections in the collection list. Either
 * `collections` or `singletons` option must be defined.
 * @property {(CollectionFile | CollectionDivider)[]} [singletons] Set of singleton files, such as
 * the CMS configuration file or the homepage file. They are not part of any collection and can be
 * accessed directly through the collection list. The list can also contain dividers. See the
 * [documentation](https://sveltiacms.app/en/docs/collections/singletons) for details.
 * @property {AssetCollection[]} [asset_collections] Set of asset collections.
 * @property {I18nOptions} [i18n] Global i18n options.
 * @property {EditorOptions} [editor] Editor view options.
 * @property {OutputOptions} [output] Data output options. See the
 * [documentation](https://sveltiacms.app/en/docs/data-output#controlling-data-output) for details.
 * @property {FieldDefaults} [field_defaults] Default options for fields.
 * @property {boolean} [readonly] Whether to make the whole CMS read-only, e.g. while the site is
 * under maintenance. Default: `false`. All the collections, files and asset folders can be viewed
 * but not changed, as if they all had the `readonly` option set to `true`. Collections and files
 * can also be made read-only individually with their own `readonly` option.
 * @see https://decapcms.org/docs/configuration-options/
 * @see https://decapcms.org/docs/i18n/
 * @see https://sveltiacms.app/en/docs/i18n
 */

/**
 * Entry file parser for a custom file format. It receives the file content, trimmed and with line
 * breaks normalized to `\n`, and returns the entry content as an object.
 * @typedef {(text: string) => any | Promise<any>} FileParser
 * @see https://decapcms.org/docs/custom-formatters/
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */

/**
 * Entry file formatter for a custom file format. It receives the entry content as an object and
 * returns the file content. The output is trimmed and a trailing line break is added.
 * @typedef {(value: any) => string | Promise<string>} FileFormatter
 * @see https://decapcms.org/docs/custom-formatters/
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */

/**
 * Custom editor component mode.
 * @typedef {'block' | 'dialog'} EditorComponentMode
 */

/**
 * Custom rich text editor component options.
 * @typedef {object} EditorComponentDefinition
 * @property {string} id Unique identifier for the component.
 * @property {string} [label] Label of the component to be displayed in the editor UI. Default: the
 * `id` value.
 * @property {string} [icon] Name of a [Material Symbols
 * icon](https://fonts.google.com/icons?icon.set=Material+Symbols) to be displayed in the editor UI.
 * @property {'menuitem' | 'button'} [trigger] Trigger UI of the component. Default: `menuitem`. A
 * menu item is placed under the Insert menu, while a button is placed directly on the toolbar.
 * @property {boolean} [collapsed] Whether to collapse the object by default (`block` mode only).
 * Default: `false`.
 * @property {EditorComponentMode} [mode] Editing mode for the component. `block` (default) renders
 * the component within the rich text editor with an expandable field list. `dialog` renders a
 * compact placeholder that opens a dialog when clicked.
 * @property {string} [summary] Template for the placeholder text when `mode` is `dialog`, e.g.
 * `{{title}} - {{videoId}}`. Like the Object field’s `summary` option, it supports nested field
 * names and transformations. Falls back to the first String/Text field value, then to the label.
 * @property {Field[]} fields Set of fields to be displayed in the component.
 * @property {RegExp} pattern Regular expression to search a block from Markdown document. The
 * component is treated as a block if the pattern has the `m` or `s` flag, or contains `[\s\S]`;
 * otherwise it’s an inline component that matches text within a paragraph. The `g` flag is
 * ignored.
 * @property {(match: RegExpMatchArray) => Record<string, any>} [fromBlock] Function to convert the
 * matching result to field values. This can be omitted if the `pattern` regex contains named
 * capturing groups, which are then used as the field values.
 * @property {(props: Record<string, any>) => string} toBlock Function to convert field values to
 * Markdown content. It’s also called once with an empty object when the component is first used in
 * a rich text editor or preview, so it must handle missing values.
 * @property {(props: Record<string, any>) => string | HTMLElement | ReactElement} [toPreview]
 * Function to convert field values to the component preview. Like `toBlock`, it’s also called once
 * with an empty object when the component is first used in a rich text editor or preview. A string
 * is parsed as Markdown/HTML and sanitized unless the `sanitize_preview` field option is disabled,
 * while an `HTMLElement` (e.g. an element with a Svelte or Vue component mounted on it) or a React
 * element is inserted as is without sanitization, so the developer is responsible for escaping any
 * user-provided content. An `HTMLElement` preview receives an `Unmount` event once it’s removed
 * from the preview pane or the preview is closed, which can be used to destroy the mounted
 * component. A preview is reused while the component’s Markdown is unchanged. If the function is
 * omitted or returns another type of value, nothing is shown in the preview. The value of a nested
 * RichText or Markdown field is passed verbatim, including any nested component syntax; use
 * `CMS.renderRichText()` to render it within an `HTMLElement` preview.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */

/**
 * Options for the `CMS.renderRichText()` API.
 * @typedef {object} RenderRichTextOptions
 * @property {Partial<Omit<RichTextField, 'widget'>>} [fieldConfig] RichText field options to be
 * applied to the preview, such as `editor_components` and `sanitize_preview`. Options not given
 * here fall back to the `field_defaults.richtext` option, except for `sanitize_preview`: the output
 * is sanitized unless it’s explicitly set to `false` here.
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */

/**
 * Supported event type. The `preSave` and `postSave` events are fired when an entry is saved. The
 * `prePublish` and `postPublish` events are fired when an Editorial Workflow entry is published,
 * while the `preUnpublish` and `postUnpublish` events are fired when an Editorial Workflow entry
 * marked for deletion is published, which deletes the entry.
 * @typedef {'prePublish' | 'postPublish' | 'preUnpublish' | 'postUnpublish' | 'preSave' |
 * 'postSave'} AppEventType
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
 */

/**
 * Author information for an event.
 * @typedef {object} AppEventAuthor
 * @property {string} login Author login name. An empty string if unavailable.
 * @property {string} name Author display name. An empty string if unavailable.
 */

/**
 * Event entry media file data.
 * @typedef {object} ApiEntryMedia
 * @property {string} id Media file ID, which is the Git object SHA-1 hash.
 * @property {string} path Media file path relative to the project root.
 * @property {string} name Media file name.
 * @property {string | undefined} url Blob URL of the media file, if it’s been retrieved.
 * @property {string | undefined} displayURL Same as `url`.
 * @property {number} size Media file size in bytes.
 * @property {File | undefined} file Media file object, if the file has not been saved yet.
 */

/**
 * Entry data passed to event handlers, preview templates and custom field types, which is wrapped
 * in an Immutable Map, along with the nested objects and arrays.
 * @typedef {object} ApiEntry
 * @property {Record<string, any>} data Entry content. For event handlers and `getCollection`, it’s
 * the default locale’s content; for preview templates and custom field types, it’s the content of
 * the locale being previewed or edited.
 * @property {Record<string, { data: Record<string, any> }>} i18n Content of the other locales,
 * keyed by locale code, e.g. `entry.getIn(['i18n', 'fr', 'data', 'title'])`.
 * @property {string} slug Entry slug. An empty string for a new entry in a preview.
 * @property {string} path Entry file path. An empty string for a new entry in a preview.
 * @property {boolean} newRecord Whether the entry is newly created. Always `false` outside event
 * handlers.
 * @property {string} collection Name of the collection.
 * @property {ApiEntryMedia[]} mediaFiles Media files associated with the entry. For event
 * handlers, the files used in the entry’s File/Image fields that are stored in a collection-level
 * or field-level media folder, excluding those in the global media folder; elsewhere, all the
 * files in the collection’s media folder.
 * @property {{ path: string }} meta Entry meta data.
 * @property {null} isModification Unknown. Always `null`.
 * @property {null} label Unknown. Always `null`.
 * @property {boolean} partial Unknown. Always `false`.
 * @property {string} author Unknown. Always an empty string.
 * @property {string} raw Unknown. Always an empty string.
 * @property {string} status Unknown. Always an empty string.
 * @property {string} updatedOn Unknown. Always an empty string.
 */

/**
 * Event listener properties.
 * @typedef {object} AppEventListener
 * @property {AppEventType} name Event type.
 * @property {(args: { author: AppEventAuthor, entry: MapOf<ApiEntry> }) => void | MapOf<ApiEntry> |
 * MapOf<Record<string, any>> | Promise<void | MapOf<ApiEntry> | MapOf<Record<string, any>>>}
 * handler Event handler. Handlers are called one after another, each receiving the changes made by
 * the previous one. For the `preSave` event, the handler can return a modified entry Map, or a
 * modified `data` Map like `entry.get('data').set('title', 'New Title')`, to change the content
 * before it’s saved; only `data` and `i18n.*.data` are applied. For other events, the return value
 * is ignored.
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
 */

/**
 * Asset data returned by the API.
 * @typedef {object} ApiAsset
 * @property {string} url Asset URL. It’s initially the public path unless the asset’s blob URL is
 * available, and replaced with the blob URL once the file has been retrieved.
 * @property {string} path Public path of the asset, e.g. `/images/photo.jpg`.
 * @property {any} field Unknown. Always `undefined`.
 * @property {File | undefined} fileObj Asset file object, if the file has not been saved yet.
 * @property {() => string} toString Function that returns `url`.
 * @property {() => Promise<string>} toBase64 Function that resolves to the Base64-encoded content
 * of the asset. It rejects with an error if the file cannot be retrieved.
 */

/**
 * Widget preview data returned by `widgetsFor`.
 * @typedef {object} WidgetsForData
 * @property {unknown} data Raw values for the list item or object, as an Immutable collection or a
 * primitive value.
 * @property {MapOf<Record<string, ReactElement>>} widgets Immutable Map of field preview elements
 * keyed by subfield name. Empty for a list item that is a primitive value.
 */

/**
 * Return value of the `widgetsFor` callback.
 * @typedef {Array<MapOf<WidgetsForData>> | MapOf<WidgetsForData> | string | number | boolean | null
 * | undefined} WidgetsForResult
 */

/**
 * Shared component props for {@link CustomPreviewTemplate} and {@link CustomFieldPreview}.
 * @typedef {object} CustomPreviewBaseProps
 * @property {MapOf<ApiEntry>} entry Entry data for the preview, wrapped in an Immutable Map. Read
 * the entry content from `entry.getIn(['data', 'fieldName'])`.
 * @property {(path: string) => ApiAsset | undefined} getAsset Function that returns the asset item
 * for a given path. Returns `undefined` if the asset is not found.
 * @property {MapOf<Record<string, any>>} fieldsMetaData Immutable Map of metadata from all fields
 * in the entry, keyed by field key path, e.g. `author` or `details.author`. For a Relation field,
 * it contains the referenced entry content in the `{ [collectionName]: { [value]: content } }`
 * structure, where `content` is a flattened object with key paths like `address.city` as keys.
 */

/**
 * Base props for custom preview template React components.
 * @typedef {object} CustomPreviewTemplateBaseProps
 * @property {(keyPath: FieldKeyPath) => ReactElement} widgetFor Function that returns a React
 * element mounting a Svelte field preview for the given field key path.
 * @property {(name: string) => WidgetsForResult} widgetsFor Function that returns widget data for a
 * given top-level field name. For a List field, it returns an array of Immutable Maps; for an
 * Object field, a single Immutable Map; and for other fields, the raw value. Each Map has `data`
 * (raw values) and `widgets` (React preview elements) entries.
 * @property {(collectionName: string, slug?: string) => Promise<(MapOf<ApiEntry>[] |
 * MapOf<ApiEntry>)>} getCollection Async function that returns entries from a specified collection.
 * Each entry is an Immutable Map with a `data` property containing the default locale’s content.
 * When `slug` is provided, it returns the matching entry, or an entry with empty `data` and `slug`
 * if there is no match; otherwise it returns the full list of entries. It rejects with an error if
 * the collection is not found.
 * @property {Document} document The preview iframe’s Document object, allowing access to the
 * preview DOM. React components should use this instead of the global `document`.
 * @property {Window} window The preview iframe’s Window object, allowing access to the preview
 * window context. React components should use this instead of the global `window`.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */

/**
 * Props for custom preview template React components.
 * @typedef {CustomPreviewBaseProps & CustomPreviewTemplateBaseProps} CustomPreviewTemplateProps
 */

/**
 * Custom preview template React component: a function or class component, or a component wrapped
 * with `memo()` or `forwardRef()`.
 * Hooks such as `useState` work when taken from the React instance bundled with the CMS, which is
 * available as `CMS.React` or the `React` export of the npm package, not from another copy of
 * React.
 * @typedef {ComponentType<CustomPreviewTemplateProps>} CustomPreviewTemplate
 */

/**
 * Options for the `addFile` prop of a custom field control.
 * @typedef {object} CustomFieldAddFileOptions
 * @property {string} [name] File name, including the extension. Required when a `Blob` is given
 * instead of a `File`; otherwise it overrides the file’s own name. The name is sanitized and, if
 * another asset in the target folder already has it, made unique when the entry is saved.
 */

/**
 * Options for the `pickFile` prop of a custom field control.
 * @typedef {object} CustomFieldPickFileOptions
 * @property {'image' | 'file'} [kind] Kind of asset to pick. `image` limits the dialog to images,
 * the way a built-in Image field does. If omitted, the dialog is limited to images when `accept`
 * only lists image types, and offers any file otherwise.
 * @property {string} [accept] Comma-separated list of accepted file types, such as `image/*` or
 * `.pdf,.docx`, applied to files uploaded through the dialog. Same as the `accept` option of a
 * built-in File/Image field.
 * @property {boolean} [multiple] Whether to let the user pick several files at once. Default:
 * `false`.
 * @property {boolean} [allowURL] Whether to let the user enter a URL instead of picking a file.
 * Same as the `choose_url` option of a built-in File/Image field. Default: `true`.
 */

/**
 * A file picked with the `pickFile` prop of a custom field control.
 * @typedef {object} CustomFieldPickedFile
 * @property {string} value Value to be stored in the field, exactly what a built-in File/Image
 * field would store for the same pick: the public path of an existing asset, a temporary blob URL
 * for a file to be uploaded along with the entry, which is replaced with the public path of the
 * file when the entry is saved, or an external URL entered by the user or given by a stock photo
 * service.
 * @property {Blob | undefined} file Contents of the file, for a control that needs the bytes, such
 * as one deriving a thumbnail. It’s `undefined` for an external URL.
 * @property {string | undefined} credit Attribution HTML for a stock photo, including the
 * photographer and service links, if the pick comes from a stock photo service.
 */

/**
 * Props for custom field control React components.
 * @typedef {object} CustomFieldControlProps
 * @property {any} value Current field value. The widget should display this value and call
 * `onChange` when the user modifies it.
 * @property {MapOf<CustomField>} field Immutable Map of current field configuration from the CMS
 * config, containing all field properties including `name`, `label`, `widget`, and custom
 * properties. Use `field.get('name')` or similar methods to access individual properties.
 * @property {string} forID HTML `id` attribute that should be used for the main input element to
 * enable proper label association and accessibility.
 * @property {string} classNameWrapper CSS class name that can be applied to the input element for
 * consistent styling with built-in widgets.
 * @property {MapOf<ApiEntry> | undefined} entry Data of the entry being edited, wrapped in an
 * Immutable Map. Read the entry content from `entry.getIn(['data', 'fieldName'])`. This is useful
 * for a control that shows values derived from other fields in the same entry, such as dynamically
 * generated select options. The prop is updated whenever any field in the entry is updated. It’s
 * `undefined` if the control is rendered outside an entry draft.
 * @property {((path: string) => ApiAsset | undefined) | undefined} getAsset Function that returns
 * the asset item for a given path, e.g. a file path stored in the value, or `undefined` if not
 * found. Use its `url` property to display the file in the control. It’s the same as the `getAsset`
 * prop of a preview. It’s `undefined` if the control is rendered outside an entry draft.
 * @property {(value: any) => void} onChange Callback function that must be called with the new
 * value whenever the user changes the field. This updates the entry draft.
 * @property {(file: File | Blob, options?: CustomFieldAddFileOptions) => Promise<string>} addFile
 * Function to add a file to the entry draft, so that the file is committed along with the entry
 * when the entry is saved, in the same way as a file picked in a built-in File/Image field. It
 * resolves to a temporary blob URL, which should be stored in the field value with `onChange`,
 * either as the value itself or anywhere within an object or array value. When the entry is saved,
 * the blob URL is replaced with the public path of the uploaded file. The file goes to the field’s
 * own `media_folder` if the option is defined, otherwise to the collection’s or the global one, and
 * the field’s or the global `media_library` options, such as `max_file_size` and `transformations`,
 * are applied. It rejects with an error if the file cannot be used. Files that are added but no
 * longer referenced in the value when the entry is saved are discarded.
 * @property {(options?: CustomFieldPickFileOptions) => Promise<CustomFieldPickedFile |
 * CustomFieldPickedFile[] | null>} pickFile Function to open the same Select Assets dialog as a
 * built-in File/Image field, so that the user can pick an existing asset, upload a new file, enter
 * a URL or choose a stock photo. It resolves to the picked file, or to an array of files when the
 * `multiple` option is enabled, once the dialog is closed with the Insert button, and to `null`
 * when the dialog is dismissed or none of the picked files can be used. The `value` of a picked
 * file is what should be stored in the field value with `onChange`, either as the value itself or
 * anywhere within an object or array value. The dialog lists the asset folders a File/Image field
 * in the same place would offer, and files uploaded through it are handled exactly like files given
 * to `addFile`, including the `media_library` options. Files that are oversized or cannot be
 * decoded are reported to the user in a dialog. It rejects with an error if the contents of a
 * picked asset cannot be retrieved.
 * @property {(instance: any) => void} [ref] Ref callback the CMS reads an `isValid` method from. A
 * function component can expose the method by passing this prop to the `useImperativeHandle` hook.
 * A class component, or one wrapped with `forwardRef()`, receives the ref the usual way instead.
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 * @see https://sveltiacms.app/en/docs/api/field-types
 */

/**
 * Custom field control React component: a function or class component, or a component wrapped
 * with `memo()` or `forwardRef()`.
 * Hooks such as `useState` work when taken from the React instance bundled with the CMS, which is
 * available as `CMS.React` or the `React` export of the npm package, not from another copy of
 * React.
 *
 * The control may optionally implement an `isValid` method for custom validation: as an instance
 * method of a class component, or, in a function component, on the handle it exposes with the
 * `useImperativeHandle` hook, given the `ref` prop or the ref of `forwardRef()`. It’s called with
 * the field value and the field configuration as an Immutable Map, and should return:
 * - `true` when valid.
 * - `false` or `{ error: { message: "text" } }` when invalid.
 * - A Promise that resolves to any of the above formats.
 *
 * A thrown error also makes the field invalid, with the error message shown to the user.
 * @typedef {ComponentType<CustomFieldControlProps>} CustomFieldControl
 * @see https://decapcms.org/docs/custom-widgets/#advanced-field-validation
 * @see https://sveltiacms.app/en/docs/api/field-types#custom-validation
 */

/**
 * Base props for custom field preview React components.
 * @typedef {object} CustomFieldPreviewBaseProps
 * @property {any} value Current field value to display in the preview.
 * @property {MapOf<CustomField>} field Immutable Map of current field configuration. Use
 * `field.get('name')` to access properties.
 * @property {MapOf<any>} metadata Immutable Map of any available metadata for the current field,
 * extracted from `fieldsMetaData` using the field’s key path as key, e.g. `details.author` for a
 * field nested in an Object field or `authors.0.name` for one in a List item. A trailing index is
 * removed, so the subfield of a List field with a single `field` uses the List field’s key path,
 * e.g. `tags` instead of `tags.0`. For relation fields, contains referenced entry data. It’s an
 * empty Map if there is no metadata.
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 * @see https://sveltiacms.app/en/docs/api/field-types
 */

/**
 * Props for custom field preview React components.
 * @typedef {CustomPreviewBaseProps & CustomFieldPreviewBaseProps} CustomFieldPreviewProps
 */

/**
 * Custom field preview React component: a function or class component, or a component wrapped with
 * `memo()` or `forwardRef()`.
 * Hooks such as `useState` work when taken from the React instance bundled with the CMS, which is
 * available as `CMS.React` or the `React` export of the npm package, not from another copy of
 * React.
 * @typedef {ComponentType<CustomFieldPreviewProps>} CustomFieldPreview
 */

/**
 * Custom field schema definition, which is a [JSON Schema](https://json-schema.org/) (draft-07)
 * object used to validate the field type’s configuration options in the CMS configuration. Other
 * keywords, such as `required`, can also be used. Options not described in the schema are always
 * allowed. An invalid schema is ignored with a warning.
 * @typedef {object} CustomFieldSchema
 * @property {Record<string, any>} properties Map of the field type’s option names to their JSON
 * Schema definitions.
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 * @see https://sveltiacms.app/en/docs/api/field-types
 */

/**
 * Field type definition returned by the `CMS.getFieldType()` API. A custom field type can reuse
 * these components to build a new field type on top of an existing one, such as a Select field with
 * dynamically generated options.
 * @typedef {object} FieldTypeDefinition
 * @property {CustomFieldControl | undefined} control React component for the edit pane. It’s
 * `undefined` if the field type has been registered without a valid control, or if it’s a built-in
 * field type that can’t be reused. The reusable built-in field types are Boolean, Color, DateTime,
 * Map, Number, Select, String, Text and UUID. For a built-in field
 * type, it accepts the same props as a custom field control, where `field` can be either an
 * Immutable Map or a plain object, plus the optional `locale`, `keyPath`, `required`, `readonly`
 * and `invalid` props, which default to the state of the custom field that renders it.
 * @property {CustomFieldPreview | undefined} preview React component for the preview pane. It’s
 * `undefined` if the field type has been registered without a preview. For a built-in field type,
 * it accepts the `value` and `field` props, plus the optional `locale` and `keyPath` props.
 * @property {CustomFieldSchema} [schema] Field schema, if the field type has been registered with
 * one. Built-in field types don’t provide a schema.
 * @see https://sveltiacms.app/en/docs/api/field-types
 */

export {};
