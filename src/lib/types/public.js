/**
 * @import { JSX } from 'react';
 */

/**
 * The following type definitions are used both internally and externally, covering all the CMS
 * configuration options and JavaScript method arguments available on the `CMS` object. This file is
 * automatically converted into a TypeScript type declaration file (`public.d.ts`) during the build
 * process, which is then distributed via npm. The Netlify/Decap CMS equivalent can be found below,
 * although their types are incomplete and somewhat inaccurate.
 * @see https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/index.d.ts
 */

/**
 * Standard IETF locale tag like `en` or `en-US`.
 * @typedef {string} LocaleCode
 * @see https://en.wikipedia.org/wiki/IETF_language_tag
 */

/**
 * An entry field name. It can be written in dot notation like `author.name` if the field is nested
 * with an Object field. For a List subfield, a wildcard can be used like `authors.*.name`. We
 * call this a key path, which is derived from the IndexedDB API terminology, and use it everywhere,
 * as entry data is managed as a flatten object for easier access.
 * @typedef {string} FieldKeyPath
 * @see https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology#key_path
 * @see https://www.npmjs.com/package/flat
 */

/**
 * Supported media library name.
 * @typedef {'default' | 'cloudinary' | 'uploadcare'} MediaLibraryName
 */

/**
 * Configuration for the built-in media library.
 * @typedef {object} DefaultMediaLibraryOptions
 * @property {number} [max_file_size] Maximum file size in bytes that can be accepted for uploading.
 * @see https://decapcms.org/docs/widgets/#file
 * @see https://decapcms.org/docs/widgets/#image
 */

/**
 * Options for the built-in media library.
 * @typedef {object} DefaultMediaLibrary
 * @property {DefaultMediaLibraryOptions} [config] Configuration for the built-in media library.
 */

/**
 * Options for the Cloudinary media library.
 * @typedef {object} CloudinaryMediaLibrary
 * @property {boolean} [output_filename_only] Whether to output a file name instead of a full URL.
 * Default: `false`.
 * @property {boolean} [use_transformations] Whether to include transformation segments in an output
 * URL. Default: `true`.
 * @property {boolean} [use_secure_url] Whether to use an HTTP URL. Default: `true`.
 * @property {Record<string, any>} [config] Options to be passed to Uploadcare, such as `multiple`.
 * The `cloud_name` and `api_key` options are required for the global `media_library` option. See
 * https://cloudinary.com/documentation/media_library_widget#2_set_the_configuration_options for a
 * full list of available options.
 * @see https://decapcms.org/docs/cloudinary/
 */

/**
 * Settings for the Uploadcare media library.
 * @typedef {object} UploadcareMediaLibrarySettings
 * @property {boolean} [autoFilename] Whether to append a file name to an output URL. Default:
 * `false`.
 * @property {string} [defaultOperations] Transformation operations to be included in an output URL.
 * Default: empty string.
 * @see https://decapcms.org/docs/uploadcare/
 */

/**
 * Options for the Uploadcare media library.
 * @typedef {object} UploadcareMediaLibrary
 * @property {Record<string, any>} [config] Options to be passed to Uploadcare, such as `multiple`.
 * The `publicKey` option is required for the global `media_library` option. See
 * https://uploadcare.com/docs/uploads/file-uploader-options/ for a full list of available options.
 * @property {UploadcareMediaLibrarySettings} [settings] Integration settings.
 * @see https://decapcms.org/docs/uploadcare/
 */

/**
 * Supported media library.
 * @typedef {DefaultMediaLibrary | CloudinaryMediaLibrary | UploadcareMediaLibrary} MediaLibrary
 * @see https://decapcms.org/docs/configuration-options/#media-library
 */

/**
 * Common field properties.
 * @typedef {object} CommonFieldProps
 * @property {string} name Unique identifier for the field. It cannot include periods and spaces.
 * @property {string} [label] Label of the field to be displayed in the editor UI. Default: `name`
 * field value.
 * @property {string} [comment] Short description of the field to be displayed in the editor UI.
 * @property {string} [widget] Name of a widget that defines the input UI and data type. Default:
 * `string`.
 * @property {boolean | LocaleCode[]} [required] Whether to make data input on the field required.
 * Default: `true`. This option also affects data output if the `omit_empty_optional_fields` global
 * output option is `true`. If i18n is enabled and the field doesn’t require input in all locales,
 * required locale codes can be passed as an array like `[en, fr]` instead of a boolean.
 * @property {[string, string]} [pattern] Validation format. The first argument is a regular
 * expression pattern for a valid input value, and the second argument is an error message. This
 * option has no effect on a List or Object field with subfields.
 * @property {string} [hint] Help message to be displayed below the input UI. Limited Markdown
 * formatting is supported: bold, italic, strikethrough and links.
 * @property {boolean} [preview] Whether to show the preview of the field. Default: `true`.
 * @property {boolean | 'duplicate' | 'translate' | 'none'} [i18n] Whether to enable the editor UI
 * in locales other than the default locale. Default: `false`. `duplicate` disables the UI in
 * non-default like `false` but automatically copies the default locale’s value to other locales.
 * `translate` and `none` are aliases of `true` and `false`, respectively. This option only works
 * when i18n is set up with the global and collection-level `i18n` option.
 * @see https://decapcms.org/docs/configuration-options/#fields
 * @see https://decapcms.org/docs/widgets/
 */

/**
 * Field-level media library options.
 * @typedef {object} FieldMediaLibraryOptions
 * @property {MediaLibraryName} [name] Library name.
 */

/**
 * Media field properties.
 * @typedef {object} MediaFieldProps
 * @property {string} [default] Default value. A file path or complete URL.
 * @property {boolean} [choose_url] Whether to show the URL input UI. Default: `true`.
 * @property {string} [media_folder] Internal media folder path for the field. Default: global or
 * collection-level `media_folder` value.
 * @property {string} [public_folder] Public media folder path for the field. Default:
 * `media_folder` option value.
 * @property {MediaLibrary & FieldMediaLibraryOptions} [media_library] Media library options for the
 * field. Default: global `media_library` value.
 * @property {boolean} [allow_multiple] Whether to enable multiple item selection in an external
 * media library. Default: `true`.
 * @see https://decapcms.org/docs/widgets/#file
 * @see https://decapcms.org/docs/widgets/#image
 */

/**
 * Options for a field accepting multiple values.
 * @typedef {object} MultiValueFieldProps
 * @property {number} [min] Minimum number of items that can be added. Default: 0.
 * @property {number} [max] Maximum number of items that can be added. Default: infinity.
 */

/**
 * Options for a field showing multiple options.
 * @typedef {object} MultiOptionFieldProps
 * @property {boolean} [multiple] Whether to accept multiple values. Default: `false`.
 * @property {number} [min] Minimum number of items that can be selected. Default: 0. Ignored if
 * `multiple` is `false`.
 * @property {number} [max] Maximum number of items that can be selected. Default: infinity. Ignored
 * if `multiple` is `false`.
 * @property {number} [dropdown_threshold] Maximum number of options to be displayed as radio
 * buttons (single-select) or checkboxes (multi-select) rather than a dropdown list. Default: 5.
 */

/**
 * Variable type for List/Object fields.
 * @typedef {object} VariableFieldType
 * @property {string} name Unique identifier for the type.
 * @property {string} [label] Label of the type to be displayed in the editor UI. Default: `name`
 * field value.
 * @property {'object'} [widget] Widget name. Values other than `object` are ignored.
 * @property {string} [summary] Template of a label to be displayed on a collapsed object.
 * @property {Field[]} [fields] Set of subfields. This option can be omitted; in that case, only
 * the `type` property will be saved.
 * @see https://decapcms.org/docs/variable-type-widgets/
 */

/**
 * Variable field properties.
 * @typedef {object} VariableFieldProps
 * @property {VariableFieldType[]} [types] Set of nested Object widgets to be selected or added.
 * @property {string} [typeKey] Property name to store the type name in nested objects. Default:
 * `type`.
 * @see https://decapcms.org/docs/variable-type-widgets/
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
 * Default: 0.
 * @property {number} [maxlength] Maximum number of characters that can be entered in the input.
 * Default: infinity.
 * @see https://github.com/sveltia/sveltia-cms/issues/141
 */

/**
 * Boolean field properties.
 * @typedef {object} BooleanFieldProps
 * @property {'boolean'} widget Widget name.
 * @property {boolean} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#boolean
 */

/**
 * Boolean field definition.
 * @typedef {CommonFieldProps & BooleanFieldProps & AdjacentLabelProps} BooleanField
 */

/**
 * Code field properties.
 * @typedef {object} CodeFieldProps
 * @property {'code'} widget Widget name.
 * @property {string | Record<string, string>} [default] Default value. It must be a string if
 * `output_code_only` is `false`. Otherwise it must be an object that match the `keys` option.
 * @property {string} [default_language] Default language to be selected, like `js`. See
 * https://prismjs.com/#supported-languages for a list of supported languages.
 * @property {boolean} [allow_language_selection] Whether to show a language switcher so that users
 * can change the language mode. Default: `true` (the Decap CMS document is wrong).
 * @property {boolean} [output_code_only] Whether to output code snippet only. Default: `false`.
 * @property {{ code: string, lang: string }} [keys] Output property names. It has no effect if
 * `output_code_only` is `true`.
 * @see https://decapcms.org/docs/widgets/#code
 */

/**
 * Code field definition.
 * @typedef {CommonFieldProps & CodeFieldProps} CodeField
 */

/**
 * Color field properties.
 * @typedef {object} ColorFieldProps
 * @property {'color'} widget Widget name.
 * @property {string} [default] Default value. Accepts a Hex color code.
 * @property {boolean} [allowInput] Whether to show a textbox that allows users to manually edit the
 * value. Default: `false`.
 * @property {boolean} [enableAlpha] Whether to edit/save the alpha channel value.
 * @see https://decapcms.org/docs/widgets/#color
 */

/**
 * Color field definition.
 * @typedef {CommonFieldProps & ColorFieldProps} ColorField
 */

/**
 * Compute field properties.
 * @typedef {object} ComputeFieldProps
 * @property {'compute'} widget Widget name.
 * @property {string} value Value template, like `posts-{{fields.slug}}`.
 * @see https://github.com/sveltia/sveltia-cms/issues/111
 */

/**
 * Compute field definition.
 * @typedef {CommonFieldProps & ComputeFieldProps} ComputeField
 */

/**
 * DateTime field properties.
 * @typedef {object} DateTimeFieldProps
 * @property {'datetime'} widget Widget name.
 * @property {string} [default] Default value. Accepts a date/time string that matches the `format`,
 * or `{{now}}` to populate the current date/time. Default: empty string.
 * @property {string} [format] Storage format written in Moment.js tokens. See
 * https://momentjs.com/docs/#/displaying/format/ for supported tokens. Default: ISO 8601 format.
 * @property {string | boolean} [date_format] Date storage format written in Moment.js tokens if the
 * value is a string and the `format` option is not defined. If `true`, ISO 8601 format is used
 * unless the `format` option is defined. If `false`, date input/output is disabled.
 * @property {string | boolean} [time_format] Time storage format written in Moment.js tokens if the
 * value is a string and the `format` option is not defined. If `true`, ISO 8601 format is used
 * unless the `format` option is defined. If `false`, time input/output is disabled.
 * @property {boolean} [picker_utc] Whether to make the date input/output UTC. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#datetime
 */

/**
 * DateTime field definition.
 * @typedef {CommonFieldProps & DateTimeFieldProps} DateTimeField
 */

/**
 * File field properties.
 * @typedef {object} FileFieldProps
 * @property {'file'} widget Widget name.
 * @see https://decapcms.org/docs/widgets/#file
 */

/**
 * File field definition.
 * @typedef {CommonFieldProps & MediaFieldProps & FileFieldProps} FileField
 */

/**
 * Hidden field properties.
 * @typedef {object} HiddenFieldProps
 * @property {'hidden'} widget Widget name.
 * @property {any} [default] Default value. Accepts any data type that can be stored with the
 * configured file format.
 * @see https://decapcms.org/docs/widgets/#hidden
 */

/**
 * Hidden field definition.
 * @typedef {CommonFieldProps & HiddenFieldProps} HiddenField
 */

/**
 * Image field properties.
 * @typedef {object} ImageFieldProps
 * @property {'image'} widget Widget name.
 * @see https://decapcms.org/docs/widgets/#image
 */

/**
 * Image field definition.
 * @typedef {CommonFieldProps & MediaFieldProps & ImageFieldProps} ImageField
 */

/**
 * KeyValue field properties.
 * @typedef {object} KeyValueFieldProps
 * @property {'keyvalue'} widget Widget name.
 * @property {Record<string, string>} [default] Default key-value pairs.
 * @property {string} [key_label] Label for the key column. Default: Key.
 * @property {string} [value_label] Label for the value column. Default: Value.
 * @see https://staticjscms.netlify.app/docs/widget-keyvalue
 */

/**
 * KeyValue field definition.
 * @typedef {CommonFieldProps & KeyValueFieldProps & MultiValueFieldProps} KeyValueField
 */

/**
 * List field properties.
 * @typedef {object} ListFieldProps
 * @property {'list'} widget Widget name.
 * @property {string[] | Record<string, any>[] | Record<string, any>} [default] Default value.
 * @property {boolean} [allow_add] Whether to allow users to add new values. Default: `true`.
 * @property {boolean} [add_to_top] Whether to add new items to the top of the list instead of the
 * bottom. Default: `false`.
 * @property {string} [label_singular] Label to be displayed on the Add button. Default: `label`
 * field value.
 * @property {string} [summary] Template of a label to be displayed on a collapsed list item.
 * @property {boolean} [collapsed] Whether to collapse the UI by default. Default: `false`.
 * @property {boolean} [minimize_collapsed] Whether to collapse the entire UI. Default: `false`.
 * @property {Field} [field] Single field to be included in a list item.
 * @property {Field[]} [fields] Set of fields to be included in a list item.
 * @property {boolean} [root] Whether to save the field value at the top-level of the data file
 * without the field name. If the `single_file` i18n structure is enabled, the lists will still be
 * saved under locale keys. Default: `false`. See
 * https://github.com/sveltia/sveltia-cms#editing-data-files-with-a-top-level-list for details.
 * @see https://decapcms.org/docs/widgets/#list
 */

/**
 * List field definition.
 * @typedef {CommonFieldProps & ListFieldProps & MultiValueFieldProps & VariableFieldProps
 * } ListField
 */

/**
 * Map field properties.
 * @typedef {object} MapFieldProps
 * @property {'map'} widget Widget name.
 * @property {string} [default] Default value. Accepts a stringified single GeoJSON geometry object.
 * @property {number} [decimals] Precision of coordinates to be saved. Default: 7.
 * @property {'Point' | 'LineString' | 'Polygon'} [type] Geometry type. Default: Point.
 * @see https://decapcms.org/docs/widgets/#map
 */

/**
 * Map field definition.
 * @typedef {CommonFieldProps & MapFieldProps} MapField
 */

/**
 * Supported button name for the rich text editor.
 * @typedef {'bold' | 'italic' | 'code' | 'link' | 'heading-one' | 'heading-two' | 'heading-three' |
 * 'heading-four' | 'heading-five' | 'heading-six' | 'quote' | 'bulleted-list' | 'numbered-list'
 * } RichTextEditorButtonName
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Built-in editor component name for the rich text editor.
 * @typedef {'code-block' | 'image'} RichTextEditorComponentName
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Supported mode name for the rich text editor.
 * @typedef {'rich_text' | 'raw'} RichTextEditorMode
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Markdown field properties.
 * @typedef {object} MarkdownFieldProps
 * @property {'markdown'} widget Widget name.
 * @property {string} [default] Default value.
 * @property {boolean} [minimal] Whether to minimize the toolbar height.
 * @property {RichTextEditorButtonName[]} [buttons] Names of formatting buttons and menu items to be
 * enabled in the editor UI. Default: all the supported button names.
 * @property {(RichTextEditorComponentName | string)[]} [editor_components] Names of components to
 * be enabled in the editor UI. This may include custom component names. Default: all the built-in
 * component names.
 * @property {RichTextEditorMode[]} [modes] Editor modes to be enabled. If it’s `[raw, rich_text]`,
 * rich text mode is disabled by default. Default: `[rich_text, raw]`.
 * @property {boolean} [sanitize_preview] Whether to sanitize the preview HTML. Default: `false`.
 * @see https://decapcms.org/docs/widgets/#markdown
 */

/**
 * Markdown field definition.
 * @typedef {CommonFieldProps & MarkdownFieldProps} MarkdownField
 */

/**
 * Number field properties.
 * @typedef {object} NumberFieldProps
 * @property {'number'} widget Widget name.
 * @property {number | string} [default] Default value.
 * @property {'int' | 'float' | string} [value_type] Type of value to be saved. Default: `int`.
 * @property {number} [min] Minimum value that can be entered in the input. Default: undefined.
 * @property {number} [max] Maximum value that can be entered in the input. Default: undefined.
 * @property {number} [step] Number to increase/decrease with the arrow key/button. Default: 1.
 * @see https://decapcms.org/docs/widgets/#number
 */

/**
 * Number field definition.
 * @typedef {CommonFieldProps & NumberFieldProps & AdjacentLabelProps} NumberField
 */

/**
 * Object field properties.
 * @typedef {object} ObjectFieldProps
 * @property {'object'} widget Widget name.
 * @property {Record<string, any>} [default] Default values.
 * @property {boolean} [collapsed] Whether to collapse the UI by default. Default: `false`.
 * @property {string} [summary] Template of a label to be displayed on a collapsed object.
 * @property {Field[]} fields Set of fields to be included.
 * @see https://decapcms.org/docs/widgets/#object
 */

/**
 * Object field definition.
 * @typedef {CommonFieldProps & ObjectFieldProps & VariableFieldProps} ObjectField
 */

/**
 * Entry filter options for a Relation field.
 * @typedef {object} RelationFieldFilterOptions
 * @property {FieldKeyPath} field Field name.
 * @property {any[]} values One or more values to be matched.
 */

/**
 * Relation field properties.
 * @typedef {object} RelationFieldProps
 * @property {'relation'} widget Widget name.
 * @property {any} [default] Default value.
 * @property {string} collection Referenced collection name.
 * @property {string} [file] Referenced file identifier for a file collection. Required if the
 * `collection` is a file collection.
 * @property {FieldKeyPath | string} value_field Field name to be stored as the value, or
 * `{{slug}}`. It can contain a locale prefix like `{{locale}}/{{slug}}` if i18n is enabled.
 * @property {(FieldKeyPath | string)[]} [display_fields] Name of fields to be displayed. It can
 * contain string templates. Default: `value_field` field value.
 * @property {FieldKeyPath[]} [search_fields] Name of fields to be searched. Default:
 * `display_fields` field value.
 * @property {RelationFieldFilterOptions[]} [filters] Entry filter options.
 * @see https://decapcms.org/docs/widgets/#relation
 */

/**
 * Relation field definition.
 * @typedef {CommonFieldProps & RelationFieldProps & MultiOptionFieldProps} RelationField
 */

/**
 * Select field properties.
 * @typedef {object} SelectFieldProps
 * @property {'select'} widget Widget name.
 * @property {string[]} [default] Default values, which should math the options.
 * @property {string[] | { label: string, value: string }[]} options Options.
 * @see https://decapcms.org/docs/widgets/#select
 */

/**
 * Select field definition.
 * @typedef {CommonFieldProps & SelectFieldProps & MultiOptionFieldProps} SelectField
 */

/**
 * String field properties.
 * @typedef {object} StringFieldProps
 * @property {'string'} widget Widget name.
 * @property {string} [default] Default value.
 * @property {'email' | 'url' | 'text'} [type] Input type. Default: text.
 * @property {string} [prefix] A string to be prepended to the value. Default: empty string.
 * @property {string} [suffix] A string to be appended to the value. Default: empty string.
 * @see https://decapcms.org/docs/widgets/#string
 */

/**
 * String field definition.
 * @typedef {CommonFieldProps & StringFieldProps & AdjacentLabelProps & CharCountProps} StringField
 */

/**
 * Text field properties.
 * @typedef {object} TextFieldProps
 * @property {'text'} widget Widget name.
 * @property {string} [default] Default value.
 * @see https://decapcms.org/docs/widgets/#text
 */

/**
 * Text field definition.
 * @typedef {CommonFieldProps & TextFieldProps & CharCountProps} TextField
 */

/**
 * UUID field properties.
 * @typedef {object} UuidFieldProps
 * @property {'uuid'} widget Widget name.
 * @property {string} [prefix] A string to be prepended to the value. Default: empty string.
 * @property {boolean} [use_b32_encoding] Whether to encode the value with Base32. Default: `false`.
 * @property {boolean} [read_only] Whether to make the field read-only. Default: `true`.
 * @see https://github.com/decaporg/decap-cms/pull/6675
 */

/**
 * UUID field definition.
 * @typedef {CommonFieldProps & UuidFieldProps} UuidField
 */

/**
 * Custom field definition. It can contain any properties.
 * @typedef {CommonFieldProps & Record<string, any>} CustomField
 * @see https://decapcms.org/docs/custom-widgets/
 */

/**
 * Entry field.
 * @typedef {BooleanField | CodeField | ColorField | ComputeField | DateTimeField | FileField |
 * HiddenField | ImageField | KeyValueField | ListField | MapField | MarkdownField | NumberField |
 * ObjectField | RelationField | SelectField | StringField | TextField | UuidField | CustomField
 * } Field
 */

/**
 * Internationalization (i18n) file structure type.
 * @typedef {'single_file' | 'multiple_files' | 'multiple_folders' | 'multiple_folders_i18n_root'
 * } I18nFileStructure
 * @see https://decapcms.org/docs/i18n/
 * @see https://github.com/decaporg/decap-cms/pull/7400
 */

/**
 * Global, collection-level or collection file-level i18n options.
 * @typedef {object} I18nOptions
 * @property {I18nFileStructure} structure File structure for entry collections. File collections
 * must define the structure using `{{locale}}` in the `file` option.
 * @property {LocaleCode[]} locales List of all available locales.
 * @property {LocaleCode} [default_locale] Default locale. Default: first locale in the `locales`
 * option.
 * @property {LocaleCode[] | 'all' | 'default'} [initial_locales] Locales to be enabled when
 * creating a new entry draft. If this option is used, users will be able to disable the output of
 * non-default locales through the UI. See
 * https://github.com/sveltia/sveltia-cms#disabling-non-default-locale-content for details.
 * @property {boolean} [save_all_locales] Whether to save collection entries in all the locales. If
 * `false`, users will be able to disable the output of non-default locales through the UI. See
 * https://github.com/sveltia/sveltia-cms#disabling-non-default-locale-content for details.
 * @property {{ key: string, value: string }} [canonical_slug] Property name and value template used
 * to add a canonical slug to entry files, which helps Sveltia CMS and some frameworks to link
 * localized files when entry slugs are localized. The default property name is `translationKey`
 * used in Hugo’s multilingual support, and the default value is the default locale’s slug. See
 * https://github.com/sveltia/sveltia-cms#localizing-entry-slugs for details.
 * @see https://decapcms.org/docs/i18n/
 * @see https://github.com/decaporg/decap-cms/issues/6932
 */

/**
 * Single file in a file collection.
 * @typedef {object} CollectionFile
 * @property {string} name Unique identifier for the file.
 * @property {string} [label] Label to be displayed in the editor UI. Default: `name` option value.
 * @property {string} file File path relative to the project root.
 * @property {Field[]} fields Set of fields to be included in the file.
 * @property {I18nOptions | boolean} [i18n] I18n options. Default: `false`.
 * @property {string} [preview_path] Preview URL path template.
 * @property {FieldKeyPath} [preview_path_date_field] Date field name used for `preview_path`.
 * @see https://decapcms.org/docs/collection-file/
 * @see https://decapcms.org/docs/deploy-preview-links/
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
 * Collection filter options.
 * @typedef {object} CollectionFilter
 * @property {FieldKeyPath} field Field name.
 * @property {any | any[]} [value] Field value. `null` can be used to match an undefined field.
 * Multiple values can be defined with an array. This option or `pattern` is required.
 * @property {string} [pattern] Regex matching pattern.
 * @see https://decapcms.org/docs/collection-folder/#filtered-folder-collections
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
 * @property {SortableFieldsDefaultOptions} [default] Default sort settings. See
 * https://github.com/sveltia/sveltia-cms#specifying-default-sort-field-and-direction for details.
 * @see https://staticjscms.netlify.app/docs/collection-overview#sortable-fields
 */

/**
 * View filter.
 * @typedef {object} ViewFilter
 * @property {string} label Label.
 * @property {FieldKeyPath} field Field name.
 * @property {string | boolean} pattern Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 */

/**
 * View group.
 * @typedef {object} ViewGroup
 * @property {string} label Label.
 * @property {FieldKeyPath} field Field name.
 * @property {string | boolean} pattern Regex matching pattern or exact value.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */

/**
 * Editor options.
 * @typedef {object} EditorOptions
 * @property {boolean} preview Whether to show the preview pane. Default: `true`.
 * @see https://decapcms.org/docs/configuration-options/#editor
 */

/**
 * Nested collection options.
 * @typedef {object} NestedCollectionOptions
 * @property {number} [depth] Maximum depth to show nested items in the collection tree. Default:
 * infinity.
 * @property {string} [summary] Summary template for a tree item. Default: `{{title}}`.
 * @see https://decapcms.org/docs/collection-nested/
 */

/**
 * Collection meta data’s path options.
 * @typedef {object} CollectionMetaDataPath
 * @property {'string'} [widget] Widget for editing the path name.
 * @property {string} [label] Label for the path editor.
 * @property {string} [index_file] Index file name to be used.
 * @see https://decapcms.org/docs/collection-nested/
 */

/**
 * Collection meta data.
 * @typedef {object} CollectionMetaData
 * @property {CollectionMetaDataPath} [path] Entry path options.
 * @see https://decapcms.org/docs/collection-nested/
 */

/**
 * A raw collection defined in the configuration file. Note: In Sveltia CMS, a folder collection is
 * called an entry collection.
 * @typedef {object} Collection
 * @property {string} name Unique identifier for the collection.
 * @property {string} [label] Label of the field to be displayed in the editor UI. Default: `name`
 * option value.
 * @property {string} [label_singular] Singular UI label. It will be Blog Post if the `label` is
 * Blog Posts, for example. Default: `label` option value.
 * @property {string} [description] Short description of the collection to be displayed in the
 * editor UI.
 * @property {string} [icon] Name of a Material Symbols icon to be displayed in the collection list.
 * @property {FieldKeyPath} [identifier_field] Field name to be used as the title and slug of an
 * entry. Entry collection only. Default: `title` or `name`.
 * @property {CollectionFile[]} [files] A set of files. File collection only.
 * @property {string} [folder] Base folder path relative to the project root. Entry collection only.
 * @property {Field[]} [fields] Set of fields to be included in entries. Entry collection only.
 * @property {string} [path] File path relative to `folder`, without a file extension. Entry
 * collection only.
 * @property {string} [media_folder] Internal media folder path for the collection. This overrides
 * the global `media_folder` option.
 * @property {string} [public_folder] Public media folder path for an entry collection. This
 * overrides the global `public_folder` option. Default: `media_folder` option value.
 * @property {CollectionFilter} [filter] Entry filter. Entry collection only.
 * @property {boolean} [hide] Whether to hide the collection in the UI. Default: `false`.
 * @property {boolean} [create] Whether to allow users to create entries in the collection. Entry
 * collection only. Default: `false`.
 * @property {boolean} [delete] Whether to allow users to delete entries in the collection. Entry
 * collection only. Default: `true`.
 * @property {boolean} [publish] Whether to show the publishing control UI for Editorial Workflow.
 * Default: `true`.
 * @property {FileExtension} [extension] File extension. Entry collection only. Default: `md`.
 * @property {FileFormat} [format] File format. Entry collection only. Default: `yaml-frontmatter`.
 * @property {string | string[]} [frontmatter_delimiter] Delimiters to be used for the front matter
 * format. Entry collection only. Default: depends on the front matter type.
 * @property {string} [slug] Item slug template. Entry collection only. Default: `identifier_field`
 * option value.
 * @property {number} [slug_length] The maximum number of characters allowed for an entry slug.
 * Entry collection only. Default: infinity.
 * @property {string} [summary] Entry summary template. Entry collection only. Default:
 * `identifier_field`.
 * @property {FieldKeyPath[] | SortableFields} [sortable_fields] Custom sortable fields. Entry
 * collection only. Default: `title`, `name`, `date`, `author` and `description`. For a Git backend,
 * commit author and commit date are also included by default.
 * @property {ViewFilter[]} [view_filters] View filters to be used in the entry list. Entry
 * collection only.
 * @property {ViewGroup[]} [view_groups] View groups to be used in the entry list. Entry collection
 * only.
 * @property {I18nOptions | boolean} [i18n] I18n options. Default: `false`.
 * @property {string} [preview_path] Preview URL path template.
 * @property {string} [preview_path_date_field] Date field name used for `preview_path`.
 * @property {EditorOptions} [editor] Editor view options.
 * @property {NestedCollectionOptions} [nested] Options for a nested collection. Entry collection
 * only.
 * @property {CollectionMetaData} [meta] Meta data for a nested collection. Entry collection only.
 * @property {boolean} [yaml_quote] Whether to double-quote all the strings values if the YAML
 * format is used for file output. Default: `false`. DEPRECATED in favor of the global YAML format
 * options.
 * @property {boolean} [divider] A special option to make this collection a divider UI in the
 * collection list. Other options will be ignored, but you’ll still need `name`. Default: `false`.
 * @property {FieldKeyPath | FieldKeyPath[]} [thumbnail] A field key path to be used to find an
 * entry thumbnail displayed on the entry list. A nested field can be specified using dot notation,
 * e.g. `heroImage.src`. A wildcard in the key path is also supported, e.g. `images.*.src`. Multiple
 * key paths can be specified as an array for fallbacks. If this option is omitted, the `name` of
 * any non-nested, non-empty field using the Image or File widget is used. Entry collection only.
 * @property {number} [limit] The maximum number of entries that can be created in the collection.
 * Entry collection only. Default: infinity.
 * @see https://decapcms.org/docs/configuration-options/#collections
 * @see https://decapcms.org/docs/collection-folder/
 * @see https://decapcms.org/docs/collection-file/
 * @see https://github.com/decaporg/decap-cms/issues/6987
 * @see https://github.com/decaporg/decap-cms/issues/7417
 * @see https://github.com/sveltia/sveltia-cms/issues/307
 */

/**
 * Supported backend name.
 * @typedef {'github' | 'gitlab'} BackendName
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
 */

/**
 * Backend options.
 * @typedef {object} BackendOptions
 * @property {BackendName} name Backend name.
 * @property {string} [repo] Required for the GitHub and GitLab backends. GitHub: organization/user
 * name and repository name joined by a slash, e.g. `owner/repo`. GitLab: namespace and project name
 * joined by a slash, e.g. `group/project` or `group/subgroup/project`.
 * @property {string} [branch] Git branch name. If omitted, the default branch, usually `main` or
 * `master`, will be used.
 * @property {string} [api_root] API endpoint of the backend. Required when using GitHub Enterprise
 * Server or a self-hosted GitLab instance. Default: `https://api.github.com` (GitHub) or
 * `https://gitlab.com/api/v4` (GitLab).
 * @property {string} [site_domain] Site domain used for OAuth, which will be included in the
 * `site_id` param to be sent to the API endpoint. Default: `location.hostname`.
 * @property {string} [base_url] OAuth base URL origin. Required when using an OAuth client other
 * than Netlify, including Sveltia CMS Authenticator. Default: `https://api.netlify.com`.
 * @property {string} [auth_endpoint] OAuth base URL path. Default: `auth` (GitHub) or
 * `oauth/authorize` (GitLab).
 * @property {'pkce' | 'implicit'} [auth_type] OAuth authentication method. GitLab only. Default:
 * `pkce`.
 * @property {string} [app_id] OAuth application ID. GitLab only.
 * @property {CommitMessages} [commit_messages] Custom commit messages.
 * @property {string} [preview_context] Deploy preview link context. GitHub only.
 * @property {string} [cms_label_prefix] Pull request label prefix for Editorial Workflow. Default:
 * `sveltia-cms/`.
 * @property {boolean} [squash_merges] Whether to use squash marge for Editorial Workflow. Default:
 * `false`.
 * @property {boolean} [open_authoring] Whether to use Open Authoring. Default: `false`.
 * @property {'repo' | 'public_repo'} [auth_scope] Authentication scope for Open Authoring.
 * @property {boolean} [automatic_deployments] Whether to enable or disable automatic deployments
 * with any connected CI/CD provider, such as GitHub Actions or Cloudflare Pages. If `false`, the
 * `[skip ci]` prefix will be added to commit messages. Git backends only. Default: undefined. See
 * https://github.com/sveltia/sveltia-cms#disabling-automatic-deployments for details.
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://decapcms.org/docs/github-backend/
 * @see https://decapcms.org/docs/gitlab-backend/
 * @see https://decapcms.org/docs/editorial-workflows/
 * @see https://decapcms.org/docs/open-authoring/
 */

/**
 * Global media library options.
 * @typedef {object} GlobalMediaLibraryOptions
 * @property {MediaLibraryName} name Library name.
 */

/**
 * Entry slug options.
 * @typedef {object} SlugOptions
 * @property {'unicode' | 'ascii'} [encoding] Encoding option. Default: `unicode`.
 * @property {boolean} [clean_accents] Whether to remove accents. Default: `false`.
 * @property {string} [sanitize_replacement] String to replace sanitized characters. Default: `-`.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */

/**
 * JSON format options.
 * @typedef {object} JsonFormatOptions
 * @property {'space' | 'tab'} [indent_style] Indent style. Default: 'space'.
 * @property {number} [indent_size] Indent size. Default: 2.
 * @see https://github.com/sveltia/sveltia-cms#controlling-data-output
 */

/**
 * YAML format options.
 * @typedef {object} YamlFormatOptions
 * @property {number} [indent_size] Indent size. Default: 2.
 * @property {'none' | 'double' | 'single'} [quote] String value’s default quote type. Default:
 * 'none'.
 * @see https://github.com/sveltia/sveltia-cms#controlling-data-output
 */

/**
 * Data output options.
 * @typedef {object} OutputOptions
 * @property {boolean} [omit_empty_optional_fields] Whether to prevent fields with `required: false`
 * and an empty value from being included in entry data output. Default: `false`.
 * @property {JsonFormatOptions} [json] JSON format options.
 * @property {YamlFormatOptions} [yaml] YAML format options.
 * @see https://github.com/sveltia/sveltia-cms#controlling-data-output
 */

/**
 * Site configuration.
 * @typedef {object} SiteConfig
 * @property {boolean} [load_config_file] Whether to load the `config.yml` file when using manual
 * initialization. This works only in the `CMS.init()` method’s `config` option. Default: `true`.
 * @property {BackendOptions} backend Backend options.
 * @property {'simple' | 'editorial_workflow' | ''} [publish_mode] Publish mode. Default: simple.
 * @property {string} media_folder Global internal media folder path, relative to the project’s root
 * directory.
 * @property {string} [public_folder] Global public media folder path, relative to the project’s
 * public URL. It must be an absolute path starting with `/`. Default: `media_folder` option value.
 * @property {MediaLibrary & GlobalMediaLibraryOptions} [media_library] Media library options.
 * @property {string} [site_url] Site URL. Default: `location.origin`.
 * @property {string} [display_url] Site URL linked from the UI. Default: `site_url` option value.
 * @property {string} [logo_url] Absolute URL or absolute path to the site logo that will be
 * displayed on the Sign-In page and the browser’s tab (favicon). A square image works best.
 * Default: Sveltia logo.
 * @property {boolean} [show_preview_links] Whether to show site preview links. Default: `true`.
 * @property {SlugOptions} [slug] Entry slug options.
 * @property {Collection[]} collections Set of collections.
 * @property {I18nOptions} [i18n] Global i18n options.
 * @property {EditorOptions} [editor] Editor view options.
 * @property {OutputOptions} [output] Data output options.
 * @see https://decapcms.org/docs/configuration-options/
 * @see https://decapcms.org/docs/i18n/
 * @see https://decapcms.org/docs/manual-initialization/
 */

/**
 * Entry file Parser.
 * @typedef {(text: string) => any | Promise<any>} FileParser
 * @see https://decapcms.org/docs/custom-formatters/
 */

/**
 * Entry file formatter.
 * @typedef {(value: any) => string | Promise<string>} FileFormatter
 * @see https://decapcms.org/docs/custom-formatters/
 */

/**
 * Custom editor component options.
 * @typedef {object} EditorComponentDefinition
 * @property {string} id Unique identifier for the component.
 * @property {string} label Label of the component to be displayed in the editor UI.
 * @property {string} [icon] Name of a Material Symbols icon to be displayed in the editor UI.
 * @property {Field[]} fields Set of fields to be displayed in the component.
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
 * Supported event type.
 * @typedef {'prePublish' | 'postPublish' | 'preUnpublish' | 'postUnpublish' | 'preSave' |
 * 'postSave'} AppEventType
 * @see https://decapcms.org/docs/registering-events/
 */

/**
 * Event listener properties.
 * @typedef {object} AppEventListener
 * @property {AppEventType} name Event type.
 * @property {(args: { entry: Record<string, any>, author?: { login: string, name: string } }) =>
 * any} handler Event handler.
 * @see https://decapcms.org/docs/registering-events/
 */

// @todo Write descriptions for the options below
/* eslint-disable jsdoc/require-property-description */

/**
 * @typedef {object} CustomPreviewTemplateProps
 * @property {Record<string, any>} entry
 * @property {(name: string) => any} widgetFor
 * @property {(name: string) => any} widgetsFor
 * @property {(name: string) => any} getAsset
 * @property {(collectionName: string, slug?: string) => any} getCollection
 * @property {Document} document
 * @property {Window} window
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 */

/**
 * @typedef {object} CustomWidgetControlProps
 * @property {any} value
 * @property {Record<string, any>} field
 * @property {string} forID
 * @property {string} classNameWrapper
 * @property {(value: any) => void} onChange
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 */

/**
 * @typedef {object} CustomWidgetPreviewProps
 * @property {any} value
 * @property {Record<string, any>} field
 * @property {Record<string, any>} metadata
 * @property {Record<string, any>} entry
 * @property {(name: string) => any} getAsset
 * @property {Record<string, any>} fieldsMetaData
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 */

/**
 * @typedef {object} CustomWidgetSchema
 * @property {Record<string, any>} properties
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 */

export {};
