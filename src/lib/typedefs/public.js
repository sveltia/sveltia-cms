/**
 * @import { JSX } from 'react';
 */

/**
 * Type declarations for the configuration file and `CMS` methods. The one for Netlify/Decap CMS can
 * be found below, though their declarations are incomplete.
 * @see https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/index.d.ts
 */

/**
 * Supported backend name.
 * @typedef {'github' | 'gitlab'} BackendName
 */

/**
 * Custom commit messages.
 * @typedef {object} CommitMessages
 * @property {string} create Message for created entries.
 * @property {string} update Message for updated entries.
 * @property {string} delete Message for deleted entries.
 * @property {string} uploadMedia Message for uploaded assets.
 * @property {string} deleteMedia Message for deleted assets.
 * @property {string} openAuthoring Message for open authoring.
 * @see https://decapcms.org/docs/configuration-options/#commit-message-templates
 */

/**
 * Backend options.
 * @typedef {object} BackendOptions
 * @property {BackendName} name Backend name.
 * @property {string} [repo] Git organization and repository name joined with `/`.
 * @property {string} [branch] Git branch name.
 * @property {string} [api_root] Git API endpoint.
 * @property {string} [site_domain] Site domain used for OAuth.
 * @property {string} [base_url] OAuth base URL origin.
 * @property {string} [auth_endpoint] OAuth URL path.
 * @property {'pkce' | 'implicit'} [auth_type] OAuth authentication method. GitLab only.
 * @property {string} [app_id] OAuth application ID. GitLab only.
 * @property {CommitMessages} [commit_messages] Custom commit messages.
 * @property {string} [preview_context] Deploy preview link context. GitHub only.
 * @property {string} [cms_label_prefix] Pull request label prefix for Editorial Workflow.
 * @property {boolean} [squash_merges] Whether to use squash marge for Editorial Workflow.
 * @property {boolean} [open_authoring] Whether to use Open Authoring.
 * @property {'repo' | 'public_repo'} [auth_scope] Authentication scope for Open Authoring.
 * @property {boolean} [automatic_deployments] Whether to enable or disable automatic deployments
 * with any connected CI/CD provider, such as GitHub Actions or Cloudflare Pages. If `false`, the
 * `[skip ci]` prefix will be added to commit messages. Git backends only.
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://decapcms.org/docs/github-backend/
 * @see https://decapcms.org/docs/gitlab-backend/
 * @see https://decapcms.org/docs/editorial-workflows/
 * @see https://decapcms.org/docs/open-authoring/
 */

/**
 * Supported media library name.
 * @typedef {'default' | 'cloudinary' | 'uploadcare'} MediaLibraryName
 */

/**
 * Configuration for the built-in media library.
 * @typedef {object} DefaultMediaLibraryConfig
 * @property {number} [max_file_size] Maximum file size in bytes.
 */

/**
 * Options for the built-in media library.
 * @typedef {object} DefaultMediaLibrary
 * @property {'default'} [name] Library name. Required for the global `media_library` config.
 * @property {DefaultMediaLibraryConfig} [config] Config to be passed to the default media library.
 * @see https://decapcms.org/docs/widgets/#file
 * @see https://decapcms.org/docs/widgets/#image
 */

/**
 * Options for the Cloudinary media library.
 * @typedef {object} CloudinaryMediaLibrary
 * @property {'cloudinary'} [name] Library name. Required for the global `media_library` config.
 * @property {boolean} [output_filename_only] Whether to output a file name instead of a URL.
 * @property {boolean} [use_transformations] Whether to include transformations in an output URL.
 * @property {boolean} [use_secure_url] Whether to use an HTTP URL.
 * @property {Record<string, any>} [config] Config to be passed to Uploadcare, such as `multiple`.
 * The `cloud_name` and `api_key` options are required for the global `media_library` configuration.
 * See https://cloudinary.com/documentation/media_library_widget#2_set_the_configuration_options for
 * a full list of available options.
 * @see https://decapcms.org/docs/cloudinary/
 */

/**
 * Settings for the Uploadcare media library.
 * @typedef {object} UploadcareMediaLibrarySettings
 * @property {boolean} [autoFilename] Whether to append the file name to an output URL.
 * @property {string} [defaultOperations] Transformation operations to be included in an output URL.
 */

/**
 * Options for the Uploadcare media library.
 * @typedef {object} UploadcareMediaLibrary
 * @property {'uploadcare'} [name] Library name. Required for the global `media_library` config.
 * @property {Record<string, any>} [config] Config to be passed to Uploadcare, such as `multiple`.
 * The `publicKey` option is required for the global `media_library` configuration. See
 * https://uploadcare.com/docs/uploads/file-uploader-options/ for a full list of available options.
 * @property {UploadcareMediaLibrarySettings} [settings] Integration settings.
 * @see https://decapcms.org/docs/uploadcare/
 */

/**
 * Media library options.
 * @typedef {DefaultMediaLibrary | CloudinaryMediaLibrary | UploadcareMediaLibrary
 * } MediaLibraryOptions
 * @see https://decapcms.org/docs/configuration-options/#media-library
 */

/**
 * Slug options.
 * @typedef {object} SlugOptions
 * @property {'unicode' | 'ascii'} [encoding] Encoding option.
 * @property {boolean} [clean_accents] Whether to remove accents.
 * @property {string} [sanitize_replacement] String to replace sanitized characters.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */

/**
 * Editor options.
 * @typedef {object} EditorOptions
 * @property {boolean} preview Whether to show the preview pane. Default: `true`.
 * @see https://decapcms.org/docs/configuration-options/#editor
 */

/**
 * Internationalization (i18n) file structure type.
 * @typedef {'single_file' | 'multiple_files' | 'multiple_folders' | 'multiple_folders_i18n_root'
 * } I18nFileStructure
 */

/**
 * ISO 639-1 locale code like `en`.
 * @typedef {string} StandardLocaleCode
 */

/**
 * Global or Collection’s unparsed i18n configuration.
 * @typedef {object} I18nOptions
 * @property {I18nFileStructure} [structure] File structure.
 * @property {StandardLocaleCode[]} locales List of all available locales.
 * @property {StandardLocaleCode[] | 'all' | 'default'} [initial_locales] Locales to be enabled when
 * creating a new entry draft.
 * @property {StandardLocaleCode} [default_locale] Default locale.
 * @property {boolean} [save_all_locales] Whether to save collection entries in all the locales. If
 * `false`, editors will be able to disable the output of non-default locales through the UI. An
 * option suggested in https://github.com/decaporg/decap-cms/issues/6932.
 * @property {{ key: string, value: string }} [canonical_slug] Property name and value template used
 * to add a canonical slug to entry files, which helps Sveltia CMS and some frameworks to link
 * localized files when entry slugs are localized. The default property name is `translationKey`
 * used in Hugo’s multilingual support, and the default value is the default locale’s slug.
 * @see https://decapcms.org/docs/i18n/
 * @see https://github.com/sveltia/sveltia-cms#localizing-entry-slugs
 */

/**
 * JSON format options.
 * @typedef {object} JsonFormatOptions
 * @property {'space' | 'tab'} [indent_style] Indent style. Default: 'space'.
 * @property {number} [indent_size] Indent size. Default: 2.
 */

/**
 * YAML format options.
 * @typedef {object} YamlFormatOptions
 * @property {number} [indent_size] Indent size. Default: 2.
 * @property {'none' | 'double' | 'single'} [quote] String value’s default quote type. Default:
 * 'none'.
 */

/**
 * Data output options.
 * @typedef {object} OutputOptions
 * @property {boolean} [omit_empty_optional_fields] Whether to prevent fields with `required: false`
 * and an empty value from being included in the data output. Default: false.
 * @property {JsonFormatOptions} [json] JSON format options.
 * @property {YamlFormatOptions} [yaml] YAML format options.
 * @see https://github.com/sveltia/sveltia-cms#controlling-data-output
 */

/**
 * A field name. It can be written in dot notation if the field is nested, e.g. `author.name`. We
 * call it `keyPath`, which is derived from the IndexedDB API’s `keyPath` property, and use it
 * everywhere, as entry data is managed as a flatten object for easier access.
 * @typedef {string} FieldKeyPath
 */

/**
 * Supported button name for the rich text editor.
 * @typedef {'bold' | 'italic' | 'code' | 'link' | 'heading-one' | 'heading-two' | 'heading-three' |
 * 'heading-four' | 'heading-five' | 'heading-six' | 'quote' | 'bulleted-list' | 'numbered-list'
 * } RichTextEditorButtonName
 */

/**
 * Built-in editor component name for the rich text editor.
 * @typedef {'code-block' | 'image'} RichTextEditorComponentName
 */

/**
 * Supported mode names for the rich text editor.
 * @typedef {'rich_text' | 'raw'} RichTextEditorMode
 */

/**
 * Common field properties.
 * @typedef {object} CommonFieldProps
 * @property {string} name Field name.
 * @property {string} [label] Field label.
 * @property {string} [comment] Field description.
 * @property {string} [widget] Widget name. Default: `string`.
 * @property {boolean | StandardLocaleCode[]} [required] Whether to require data input (and data
 * output if the `omit_empty_optional_fields` option is `true`) for the field. If i18n is enabled
 * and the field doesn’t require input for every locale, a subset of locales can be passed as an
 * array.
 * @property {string[]} [pattern] Validation format.
 * @property {string} [hint] Value hint to be displayed below the input.
 * @property {boolean} [preview] Whether to show the preview of the field. Default: `true`.
 * @property {boolean | 'translate' | 'none' | 'duplicate'} [i18n] I18n configuration. `translate`
 * is an alias of `true`. `none` is an alias of `false`.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets/
 */

/**
 * Variable type for List/Object fields.
 * @typedef {object} VariableFieldType
 * @property {string} label Label to distinguish the different types.
 * @property {string} name Type name.
 * @property {'object'} [widget] Widget type. `object` only.
 * @property {string} [summary] Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} [fields] Nested fields.
 * @see https://decapcms.org/docs/variable-type-widgets/
 */

/**
 * Variable field properties.
 * @typedef {object} VariableFieldProps
 * @property {VariableFieldType[]} [types] Multiple Object widgets (variable types) to be selected.
 * @property {string} [typeKey] Property name to store the type.
 */

/**
 * Boolean field properties.
 * @typedef {object} BooleanFieldProps
 * @property {boolean} [default] Default value.
 * @property {string} [before_input] An extra label to be displayed before the input UI. Default: an
 * empty string.
 * @property {string} [after_input] An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#boolean
 */

/**
 * Boolean field definition.
 * @typedef {CommonFieldProps & BooleanFieldProps & { widget: 'boolean' }} BooleanField
 */

/**
 * Code field properties.
 * @typedef {object} CodeFieldProps
 * @property {string | { code: string, lang: string }} [default] Default value.
 * @property {string} [default_language] Default language to be selected.
 * @property {boolean} [allow_language_selection] Whether to show the language switcher. Note: The
 * Decap CMS document says it defaults to `false` but it’s actually `true`.
 * @property {boolean} [output_code_only] Whether to output code snippet only.
 * @property {{ code: string, lang: string }} [keys] Output property names.
 */

/**
 * Code field definition.
 * @typedef {CommonFieldProps & CodeFieldProps & { widget: 'code' }} CodeField
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
 * @typedef {CommonFieldProps & ColorFieldProps & { widget: 'color' }} ColorField
 */

/**
 * Compute field properties.
 * @typedef {object} ComputeFieldProps
 * @property {string} [default] Default value. Unused.
 * @property {string} value Value template, like `posts-{{fields.slug}}`.
 */

/**
 * Compute field definition.
 * @typedef {CommonFieldProps & ComputeFieldProps & { widget: 'compute' }} ComputeField
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
 * @typedef {CommonFieldProps & DateTimeFieldProps & { widget: 'datetime' }} DateTimeField
 */

/**
 * File field properties.
 * @typedef {object} FileFieldProps
 * @property {string} [default] Default value.
 * @property {boolean} [choose_url] Whether to hide the Insert from URL button.
 * @property {string} [media_folder] Internal media folder path for the field.
 * @property {string} [public_folder] Public media folder path for the field.
 * @property {MediaLibraryOptions} [media_library] Media library configuration.
 * @property {boolean} [allow_multiple] Whether to force disabling multiple inputs in the external
 * media library.
 * @see https://decapcms.org/docs/widgets/#file
 */

/**
 * File field definition.
 * @typedef {CommonFieldProps & FileFieldProps & { widget: 'file' }} FileField
 */

/**
 * Hidden field properties.
 * @typedef {object} HiddenFieldProps
 * @property {any} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#hidden
 */

/**
 * Hidden field definition.
 * @typedef {CommonFieldProps & HiddenFieldProps & { widget: 'hidden' }} HiddenField
 */

/**
 * Image field definition. It’s an alias of the File field.
 * @typedef {CommonFieldProps & FileFieldProps & { widget: 'image' }} ImageField
 */

/**
 * KeyValue field properties.
 * @typedef {object} KeyValueFieldProps
 * @property {Record<string, string>} [default] Default key-value pairs.
 * @property {string} [key_label] Label for the key column.
 * @property {string} [value_label] Label for the value column.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @see https://staticjscms.netlify.app/docs/widget-keyvalue
 */

/**
 * KeyValue field definition.
 * @typedef {CommonFieldProps & KeyValueFieldProps & { widget: 'keyvalue' }} KeyValueField
 */

/**
 * List field properties.
 * @typedef {object} ListFieldProps
 * @property {string[] | Record<string, any>[] | Record<string, any>} [default] Default value.
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
 * @property {boolean} [root] Whether to save the field value at the top-level of the data file
 * without the field name. If the `single_file` i18n structure is enabled, the lists will still be
 * saved under locale keys.
 * @see https://decapcms.org/docs/widgets/#list
 * @see https://decapcms.org/docs/variable-type-widgets/
 */

/**
 * List field definition.
 * @typedef {CommonFieldProps & ListFieldProps & VariableFieldProps & { widget: 'list' }} ListField
 */

/**
 * Map field properties.
 * @typedef {object} MapFieldProps
 * @property {string} [default] Default value.
 * @property {number} [decimals] Precision of coordinates.
 * @property {'Point' | 'LineString' | 'Polygon'} [type] Geometry type.
 * @see https://decapcms.org/docs/widgets/#map
 */

/**
 * Map field definition.
 * @typedef {CommonFieldProps & MapFieldProps & { widget: 'map' }} MapField
 */

/**
 * Markdown field properties.
 * @typedef {object} MarkdownFieldProps
 * @property {string} [default] Default value.
 * @property {boolean} [minimal] Whether to minimize the toolbar height.
 * @property {RichTextEditorButtonName[]} [buttons] Formatting button list.
 * @property {(RichTextEditorComponentName | string)[]} [editor_components] Editor button list.
 * @property {RichTextEditorMode[]} [modes] Editor mode(s).
 * @property {boolean} [sanitize_preview] Whether to sanitize the preview HTML.
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Markdown field definition.
 * @typedef {CommonFieldProps & MarkdownFieldProps & { widget: 'markdown' }} MarkdownField
 */

/**
 * Number field properties.
 * @typedef {object} NumberFieldProps
 * @property {string | number} [default] Default value.
 * @property {'int' | 'float'} [value_type] Type of value to be saved.
 * @property {number} [min] Minimum value.
 * @property {number} [max] Maximum value.
 * @property {number} [step] Number to increase/decrease with the arrow key/button.
 * @property {string} [before_input] An extra label to be displayed before the input UI. Default: an
 * empty string.
 * @property {string} [after_input] An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#number
 */

/**
 * Number field definition.
 * @typedef {CommonFieldProps & NumberFieldProps & { widget: 'number' }} NumberField
 */

/**
 * Object field properties.
 * @typedef {object} ObjectFieldProps
 * @property {object} [default] Default values.
 * @property {boolean} [collapsed] Whether to collapse the UI by default.
 * @property {string} [summary] Template of the label to be displayed on the collapsed UI.
 * @property {Field[]} [fields] Nested fields.
 * @see https://decapcms.org/docs/widgets/#object
 */

/**
 * Object field definition.
 * @typedef {CommonFieldProps & ObjectFieldProps & VariableFieldProps & { widget: 'object' }
 * } ObjectField
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {string} collection Referenced collection name.
 * @property {string} [file] Referenced file identifier for a file collection.
 * @property {string} value_field Name of field to be stored as the value.
 * @property {string[]} [search_fields] Name of fields to be searched. It’s a required field as per
 * the Decap CMS document, but we can fall back if the value is missing.
 * @property {string[]} [display_fields] Name of fields to be displayed.
 * @property {any} [default] Default value.
 * @property {boolean} [multiple] Whether to accept multiple values.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @property {{ field: string, values: any[] }[]} [filters] Entry filters.
 * @property {number} [dropdown_threshold] Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: 5.
 * @see https://decapcms.org/docs/widgets/#relation
 */

/**
 * Relation field definition.
 * @typedef {CommonFieldProps & RelationFieldProps & { widget: 'relation' }} RelationField
 */

/**
 * Select field properties.
 * @typedef {object} SelectFieldProps
 * @property {string[]} [default] Default values.
 * @property {string[] | { label: string, value: string }[]} options Options.
 * @property {boolean} [multiple] Whether to accept multiple values.
 * @property {number} [min] Minimum number of items.
 * @property {number} [max] Maximum number of items.
 * @property {number} [dropdown_threshold] Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: 5.
 * @see https://decapcms.org/docs/widgets/#select
 */

/**
 * Select field definition.
 * @typedef {CommonFieldProps & SelectFieldProps & { widget: 'select' }} SelectField
 */

/**
 * String field properties.
 * @typedef {object} StringFieldProps
 * @property {string} [default] Default value.
 * @property {number} [minlength] Minimum number of characters required for input.
 * @property {number} [maxlength] Maximum number of characters required for input.
 * @property {'email' | 'url' | 'text'} [type] Input type.
 * @property {string} [prefix] A string to be prepended to the value. Default: an empty string.
 * @property {string} [suffix] A string to be appended to the value. Default: an empty string.
 * @property {string} [before_input] An extra label to be displayed before the input UI. Default: an
 * empty string.
 * @property {string} [after_input] An extra label to be displayed after the input UI. Default: an
 * empty string.
 * @see https://decapcms.org/docs/widgets/#string
 */

/**
 * String field definition.
 * @typedef {CommonFieldProps & StringFieldProps & { widget: 'string' }} StringField
 */

/**
 * Text field properties.
 * @typedef {object} TextFieldProps
 * @property {string} [default] Default value.
 * @property {number} [minlength] Minimum number of characters required for input.
 * @property {number} [maxlength] Maximum number of characters required for input.
 * @see https://decapcms.org/docs/widgets/#text
 */

/**
 * Text field definition.
 * @typedef {CommonFieldProps & TextFieldProps & { widget: 'text' }} TextField
 */

/**
 * UUID field properties.
 * @typedef {object} UuidFieldProps
 * @property {string} [default] Default value. Unused.
 * @property {string} [prefix] A string to be prepended to the value. Default: an empty string.
 * @property {boolean} [use_b32_encoding] Whether to encode the value with Base32. Default: `false`.
 * @property {boolean} [read_only] Whether to make the field read-only. Default: `true`.
 * @see https://decapcms.org/docs/widgets/#uuid
 */

/**
 * UUID field definition.
 * @typedef {CommonFieldProps & UuidFieldProps & { widget: 'uuid' }} UuidField
 */

/**
 * Custom field definition.
 * @typedef {CommonFieldProps & Record<string, any>} CustomField
 * @see https://decapcms.org/docs/custom-widgets/
 */

/**
 * Any supported {@link Entry} field.
 * @typedef {BooleanField | CodeField | ColorField | ComputeField | DateTimeField | FileField |
 * ImageField | HiddenField | KeyValueField | ListField | MapField | MarkdownField | NumberField |
 * ObjectField | RelationField | SelectField | StringField | TextField | UuidField | CustomField
 * } Field
 */

/**
 * A raw collection file defined in the configuration file.
 * @typedef {object} CollectionFile
 * @property {string} name File identifier.
 * @property {string} [label] File label.
 * @property {string} file File path.
 * @property {Field[]} fields Fields.
 * @property {I18nOptions | boolean} [i18n] I18n configuration.
 * @property {string} [preview_path] Preview URL template.
 * @property {string} [preview_path_date_field] Date field used for the preview URL template.
 * @property {EditorOptions} [editor] Editor view configuration.
 * @see https://decapcms.org/docs/collection-file/
 */

/**
 * Supported file extension.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'md' | 'markdown' | 'html' | string} FileExtension
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */

/**
 * Supported Markdown front matter format.
 * @typedef {'yaml-frontmatter' | 'toml-frontmatter' | 'json-frontmatter'} FrontMatterFormat
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */

/**
 * Supported file format.
 * @typedef {'yml' | 'yaml' | 'toml' | 'json' | 'frontmatter' | FrontMatterFormat} FileFormat
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */

/**
 * The default options for the sortable fields.
 * @typedef {object} CustomSortableFieldsDefault
 * @property {string} field A field name to be sorted by default.
 * @property {'ascending' | 'descending' | 'Ascending' | 'Descending' | 'None'} [direction] Default
 * sort direction. Title case values are supported for Static CMS compatibility. However,
 * `None` is not supported, considered as `ascending`.
 */

/**
 * A collection’s advanced sortable fields definition, which is compatible with Static CMS.
 * @typedef {object} CustomSortableFields
 * @property {string[]} fields A list of sortable field names.
 * @property {CustomSortableFieldsDefault} [default] Default sort settings.
 * @see https://staticjscms.netlify.app/docs/collection-overview#sortable-fields
 */

/**
 * View filter.
 * @typedef {object} ViewFilter
 * @property {string} label Label.
 * @property {string} field Field name.
 * @property {string | boolean} pattern Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * View group.
 * @typedef {object} ViewGroup
 * @property {string} label Label.
 * @property {string} field Field name.
 * @property {string | boolean} pattern Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */

/**
 * Collection filter options.
 * @typedef {object} CollectionFilter
 * @property {string} field Field name.
 * @property {any | any[]} [value] Field value. `null` can be used to match an undefined field.
 * Multiple values can be defined with an array.
 * @property {string} [pattern] Regex matching pattern.
 */

/**
 * Nested collection options.
 * @typedef {object} NestedCollectionOptions
 * @property {number} [depth] Maximum depth to show nested items in the collection tree.
 * @property {string} [summary] Summary template for a tree item.
 * @see https://decapcms.org/docs/collection-nested/
 */

/**
 * Collection meta data’s path options.
 * @typedef {object} CollectionMetaDataPath
 * @property {'string'} [widget] Widget for editing the path name.
 * @property {string} [label] Label for the path editor.
 * @property {string} [index_file] Index file name to be used.
 */

/**
 * Collection meta data.
 * @typedef {object} CollectionMetaData
 * @property {CollectionMetaDataPath} [path] Entry path options.
 * @see https://decapcms.org/docs/collection-nested/
 */

/**
 * A raw collection defined in the configuration file.
 * @typedef {object} Collection
 * @property {string} name Collection name.
 * @property {string} [label] UI label.
 * @property {string} [label_singular] Singular UI label.
 * @property {string} [description] Description.
 * @property {string} [icon] Material Symbols icon name.
 * @property {string} [identifier_field] Field name to be used as the ID of a collection item.
 * @property {CollectionFile[]} [files] File list for a file collection.
 * @property {string} [folder] Folder path for an entry collection.
 * @property {Field[]} [fields] Fields for an entry collection.
 * @property {string} [path] Subfolder path for an entry collection.
 * @property {string} [media_folder] Internal media folder path for an entry collection.
 * @property {string} [public_folder] Public media folder path for an entry collection.
 * @property {CollectionFilter} [filter] Filter for an entry collection.
 * @property {boolean} [hide] Whether to hide the collection in the UI.
 * @property {boolean} [create] Whether to allow creating items in an entry collection.
 * @property {boolean} [delete] Whether to allow deleting items in an entry collection.
 * @property {boolean} [publish] Whether to hide the publishing control UI for Editorial Workflow.
 * @property {FileExtension} [extension] File extension.
 * @property {FileFormat} [format] File format.
 * @property {string | string[]} [frontmatter_delimiter] Delimiters used for the front matter
 * format.
 * @property {boolean} [yaml_quote] Whether to double-quote all the strings values if the YAML
 * format is used for file output. Default: `false`. DEPRECATED in favor of the global YAML format
 * options.
 * @property {string} [slug] Item slug template for an entry collection.
 * @property {number} [slug_length] The maximum number of characters allowed for an entry slug. An
 * option suggested in https://github.com/decaporg/decap-cms/issues/6987.
 * @property {string} [summary] Item summary template for an entry collection.
 * @property {string[] | CustomSortableFields} [sortable_fields] Custom sortable fields.
 * @property {ViewFilter[]} [view_filters] Predefined view filters.
 * @property {ViewGroup[]} [view_groups] Predefined view groups.
 * @property {I18nOptions | boolean} [i18n] I18n configuration.
 * @property {string} [preview_path] Preview URL template.
 * @property {string} [preview_path_date_field] Date field used for the preview URL template.
 * @property {EditorOptions} [editor] Editor view configuration.
 * @property {NestedCollectionOptions} [nested] Options for a Nested Collection.
 * @property {CollectionMetaData} [meta] Meta data for a Nested Collection.
 * @property {boolean} [divider] A special option to make this collection a divider UI in the
 * primary sidebar’s collection list. Other options will be ignored, but you may still need a random
 * `name` and an empty `files` list to avoid a config file validation error in VS Code.
 * @property {FieldKeyPath | FieldKeyPath[]} [thumbnail] A field key path to be used to find an
 * entry thumbnail displayed on the entry list. A nested field can be specified using dot notation,
 * e.g. `heroImage.src`. A wildcard in the key path is also supported, e.g. `images.*.src`. Multiple
 * key paths can be specified as an array for fallback purpose. If this option is omitted, the
 * `name` of any non-nested, non-empty field using the Image or File widget is used.
 * @property {number} [limit] The maximum number of entries that can be created in the entry
 * collection.
 * @see https://decapcms.org/docs/configuration-options/#collections
 */

/**
 * Site configuration.
 * @typedef {object} SiteConfig
 * @property {boolean} [load_config_file] Whether to load the `config.yml` file when using manual
 * initialization.
 * @property {BackendOptions} backend Backend options.
 * @property {string} [site_url] Site URL.
 * @property {string} [display_url] Site URL linked from the UI.
 * @property {string} [logo_url] Site logo URL.
 * @property {string} media_folder Global internal media folder path.
 * @property {string} [public_folder] Global public media folder path.
 * @property {MediaLibraryOptions} [media_library] Media library configuration.
 * @property {SlugOptions} [slug] Slug options.
 * @property {Collection[]} collections Collections.
 * @property {I18nOptions} [i18n] Global i18n configuration.
 * @property {EditorOptions} [editor] Editor view configuration.
 * @property {'simple' | 'editorial_workflow'} [publish_mode] Enable Editorial Workflow.
 * @property {boolean} [show_preview_links] Whether to show site preview links.
 * @property {OutputOptions} [output] Data output options.
 * @see https://decapcms.org/docs/configuration-options/
 */

/**
 * Custom editor component configuration.
 * @typedef {object} EditorComponentDefinition
 * @property {string} id Component name.
 * @property {string} label UI label.
 * @property {string} [icon] Material Symbols icon name.
 * @property {Field[]} fields Fields to be displayed on the component.
 * @property {RegExp} pattern Regular expression to search a block from Markdown document.
 * @property {(match: RegExpMatchArray) => { [key: string]: any }} [fromBlock] Function to convert
 * the matching result to field properties. This can be omitted if the `pattern` regex contains
 * named capturing group(s) that will be passed directly to the internal `createNode` method.
 * @property {(props: { [key: string]: any }) => string} toBlock Function to convert field
 * properties to Markdown content.
 * @property {(props: { [key: string]: any }) => string | JSX.Element} toPreview Function to convert
 * field properties to field preview.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 */

/**
 * Entry file Parser.
 * @typedef {(text: string) => any | Promise<any>} FileParser
 */

/**
 * Entry file formatter.
 * @typedef {(value: any) => string | Promise<string>} FileFormatter
 */

export {};
