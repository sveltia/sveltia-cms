export const strings = {
  // Pages & Navigation
  collections: 'Collections',
  contents: 'Contents',
  entries: 'Entries',
  assets: 'Assets',
  media: 'Media',
  workflow: 'Workflow',
  editorial_workflow: 'Editorial Workflow',

  // Account
  user_name: 'User Name',
  password: 'Password',
  sign_in: 'Sign In',
  signed_in_as_x: 'Signed In as {name}',
  working_with_local_repo: 'Working with Local Repository',
  sign_out: 'Sign Out',

  // Common terms
  create: 'New',
  select: 'Select',
  select_all: 'Select All',
  upload: 'Upload',
  copy: 'Copy',
  download: 'Download',
  duplicate: 'Duplicate',
  delete: 'Delete',
  save: 'Save',
  saving: 'Saving…',
  rename: 'Rename',
  replace: 'Replace',
  remove: 'Remove',
  remove_x: 'Remove {name}',
  clear: 'Clear',
  expand: 'Expand',
  expand_all: 'Expand All',
  collapse: 'Collapse',
  collapse_all: 'Collapse All',
  insert: 'Insert',
  restore: 'Restore',
  discard: 'Discard',
  searching: 'Searching…',
  global: 'Global',
  primary: 'Primary',
  secondary: 'Secondary',
  collection: 'Collection',
  folder: 'Folder',
  api_key: 'API Key',
  details: 'Details',

  // Common errors
  clipboard_error: 'There was an error while copying data.',

  // Entrance
  welcome_to_sveltia_cms: 'Welcome to Sveltia CMS',
  loading_site_config: 'Loading Site Configuration…',
  loading_site_data: 'Loading Site Data…',
  loading_site_data_error: 'There was an error while loading site data.',
  sign_in_with_x: 'Sign In with {service}',
  authorizing: 'Authorizing…',
  signing_in: 'Signing in…',
  work_with_local_repo: 'Work with Local Repository',
  work_with_local_repo_description:
    'Click the button to select the root directory of the “{repo}” repository.',
  work_with_local_repo_description_no_repo:
    'Click the button to select the root directory of your Git repository.',
  sign_in_error: {
    not_project_root:
      'The folder you have selected is not a repository root directory. Please try again.',
    picker_dismissed: 'A repository root directory could not be selected. Please try again.',
    authentication_aborted: 'Authentication aborted. Please try again.',
    // Errors defined in Sveltia CMS Authenticator
    // https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
    UNSUPPORTED_BACKEND: 'Your Git backend is not supported by the authenticator.',
    UNSUPPORTED_DOMAIN: 'Your domain is not allowed to use the authenticator.',
    MISCONFIGURED_CLIENT: 'OAuth app client ID or secret is not configured.',
    AUTH_CODE_REQUEST_FAILED: 'Failed to receive an authorization code. Please try again later.',
    CSRF_DETECTED: 'Potential CSRF attack detected. Authentication flow aborted.',
    TOKEN_REQUEST_FAILED: 'Failed to request an access token. Please try again later.',
    MALFORMED_RESPONSE: 'Server responded with malformed data. Please try again later.',
  },
  repository_no_access: 'You don’t have access to the “{repo}” repository.',
  repository_not_found: 'The “{repo}” repository doesn’t exist.',
  repository_empty: 'The “{repo}” repository has no branches.',
  branch_not_found: 'The “{repo}” repository doesn’t have the “{branch}” branch.',
  unexpected_error: 'Unexpected Error',

  // Parser errors
  entry_parse_error:
    'There was an error while parsing an entry file. Check the browser console for details.',
  entry_parse_errors:
    'There were errors while parsing entry files. Check the browser console for details.',

  // Global toolbar
  visit_live_site: 'Visit Live Site',
  switch_page: 'Switch Page',
  search_placeholder: 'Search for entries and assets…',
  create_entry_or_assets: 'Create Entry or Assets',
  publish_changes: 'Publish Changes',
  publishing_changes: 'Publishing Changes…',
  publishing_changes_failed: 'Changes could not be published. Please try again later.',
  show_notifications: 'Show Notifications',
  notifications: 'Notifications',
  show_account_menu: 'Show Account Menu',
  account: 'Account',
  live_site: 'Live Site',
  git_repository: 'Git Repository',
  settings: 'Settings',
  site_config: 'Site Configuration',
  show_help_menu: 'Show Help Menu',
  help: 'Help',
  keyboard_shortcuts: 'Keyboard Shortcuts',
  documentation: 'Documentation',
  release_notes: 'Release Notes',
  version_x: 'Version {version}',
  report_issue: 'Report Issue',
  share_feedback: 'Share Feedback',
  get_help: 'Get Help',
  join_discord: 'Join Us on Discord',

  // Update notification
  update_available: 'The latest version of Sveltia CMS is available.',
  update_now: 'Update Now',

  // Backend status indicator
  backend_status: {
    minor_incident:
      '{service} is experiencing a minor incident. Your workflow may be potentially affected.',
    major_incident:
      '{service} is experiencing a major incident. You may want to wait until the situation has improved.',
  },

  // Library
  content_library: 'Content Library',
  asset_library: 'Asset Library',
  collection_assets: 'Collection Assets',
  entry_assets: 'Entry Assets',
  entry_list: 'Entry List',
  file_list: 'File List',
  asset_list: 'Asset List',
  x_collection: '“{collection}” Collection',
  x_asset_folder: '“{folder}” Asset Folder',
  viewing_x_collection_many_entries:
    'You’re now viewing the “{collection}” collection, which has {count} entries.',
  viewing_x_collection_one_entry:
    'You’re now viewing the “{collection}” collection, which has one entry.',
  viewing_x_collection_no_entries:
    'You’re now viewing the “{collection}” collection, which has no entries yet.',
  viewing_x_asset_folder_many_assets:
    'You’re now viewing the “{folder}” asset folder, which has {count} assets.',
  viewing_x_asset_folder_one_asset:
    'You’re now viewing the “{folder}” asset folder, which has one asset.',
  viewing_x_asset_folder_no_assets:
    'You’re now viewing the “{folder}” asset folder, which has no assets yet.',
  collection_not_found: 'Collection not found',
  file_not_found: 'File not found.',
  x_of_x_selected: '{selected} of {total} selected',
  switch_view: 'Switch View',
  list_view: 'List View',
  grid_view: 'Grid View',
  sort: 'Sort',
  sorting_options: 'Sorting Options',
  sort_keys: {
    none: 'None',
    name: 'Name',
    commit_author: 'Updated by',
    commit_date: 'Updated on',
  },
  ascending: '{label}, A to Z',
  ascending_date: '{label}, old to new',
  descending: '{label}, Z to A',
  descending_date: '{label}, new to old',
  filter: 'Filter',
  filtering_options: 'Filtering Options',
  group: 'Group', // Verb
  grouping_options: 'Grouping Options',
  type: 'Type',
  all: 'All',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  other: 'Other',
  show_assets: 'Show Assets',
  hide_assets: 'Hide Assets',
  show_info: 'Show Info',
  hide_info: 'Hide Info',
  asset_folders: 'Asset Folders',
  all_assets: 'All Assets',
  uncategorized: 'Uncategorized',
  search_results_for_x: 'Search Results for “{terms}”',
  viewing_search_results:
    'You’re now viewing search results for “{terms}”. We’ve found {entries} and {assets}.',
  many_entries: '{count} entries',
  one_entry: 'one entry',
  no_entries: 'no entries',
  many_assets: '{count} assets',
  one_asset: 'one asset',
  no_assets: 'no assets',
  no_files_found: 'No files found.',
  no_entries_found: 'No entries found.',
  upload_assets: 'Upload New Assets',
  edit_options: 'Edit Options',
  show_edit_options: 'Show Edit Options',
  edit_asset: 'Edit Asset',
  edit_x: 'Edit {name}',
  wrap_long_lines: 'Wrap Long Lines',
  rename_asset: 'Rename Asset',
  rename_x: 'Rename {name}',
  enter_new_name_for_asset: 'Enter a new name below.',
  enter_new_name_for_asset_with_one_entry:
    'Enter a new name below. An entry using the asset will also be updated.',
  enter_new_name_for_asset_with_many_entries:
    'Enter a new name below. {count} entries using the asset will also be updated.',
  enter_new_name_for_asset_error: {
    empty: 'File name cannot be empty.',
    character: 'File name cannot contain special characters.',
    duplicate: 'This file name is used for another asset.',
  },
  replace_asset: 'Replace Asset',
  replace_x: 'Replace {name}',
  browse_file: 'Click to browse',
  drop_or_browse_file: 'Drop a file here or click to browse',
  drop_or_browse_files: 'Drop files here or click to browse',
  drop_or_browse_image_file: 'Drop an image file here or click to browse',
  drop_or_browse_image_files: 'Drop image files here or click to browse',
  drop_file_here: 'Drop a file here',
  drop_files_here: 'Drop files here',
  drop_files_type_mismatch: 'The dropped file is not the “{type}” type. Please try again.',
  choose_file: 'Choose File',
  choose_files: 'Choose Files',
  delete_asset: 'Delete Asset',
  delete_assets: 'Delete Assets',
  delete_selected_asset: 'Delete Selected Asset',
  delete_selected_assets: 'Delete Selected Assets',
  confirm_deleting_this_asset: 'Are you sure to delete this asset?',
  confirm_deleting_selected_asset: 'Are you sure to delete the selected asset?',
  confirm_deleting_selected_assets: 'Are you sure to delete the selected {count} assets?',
  confirm_deleting_all_assets: 'Are you sure to delete all the assets?',
  delete_entry: 'Delete Entry',
  delete_entries: 'Delete Entries',
  delete_selected_entry: 'Delete Selected Entry',
  delete_selected_entries: 'Delete Selected Entries',
  confirm_deleting_this_entry: 'Are you sure to delete this entry?',
  confirm_deleting_this_entry_with_assets:
    'Are you sure to delete this entry and associated assets?',
  confirm_deleting_selected_entry: 'Are you sure to delete the selected entry?',
  confirm_deleting_selected_entry_with_assets:
    'Are you sure to delete the selected entry and associated assets?',
  confirm_deleting_selected_entries: 'Are you sure to delete the selected {count} entries?',
  confirm_deleting_selected_entries_with_assets:
    'Are you sure to delete the selected {count} entries and associated assets?',
  confirm_deleting_all_entries: 'Are you sure to delete all the entries?',
  confirm_deleting_all_entries_with_assets:
    'Are you sure to delete all the entries and associated assets?',
  confirm_replacing_file: 'Are you sure to replace “{name}” with the following file?',
  confirm_uploading_file: 'Are you sure to save the following file to the “{folder}” folder?',
  confirm_uploading_files:
    'Are you sure to save the following {count} files to the “{folder}” folder?',
  no_entries_created: 'This collection has no entries yet.',
  create_new_entry: 'Create New Entry',
  no_files_in_collection: 'No files available in this collection.',
  asset_info: 'Asset Info',
  select_asset_show_info: 'Select an asset to show the info.',
  duplicate_entry: 'Duplicate Entry',
  entry_duplicated: 'Entry has been duplicated. It’s now a new draft.',
  entry_validation_error: 'One field has an error. Please correct it to save the entry.',
  entry_validation_errors: '{count} fields have an error. Please correct them to save the entry.',
  entry_saved: 'Entry has been saved.',
  entry_saved_and_published: 'Entry has been saved and published.',
  entry_deleted: 'Entry has been deleted.',
  entries_deleted: '{count} entries have been deleted.',
  asset_saved: 'Asset has been saved.',
  asset_saved_and_published: 'Asset has been saved and published.',
  assets_saved: '{count} assets have been saved.',
  assets_saved_and_published: '{count} assets have been saved and published.',
  asset_url_copied: 'Asset URL has been copied to clipboard.',
  asset_urls_copied: 'Asset URLs have been copied to clipboard.',
  asset_path_copied: 'Asset file path has been copied to clipboard.',
  asset_paths_copied: 'Asset file paths have been copied to clipboard.',
  asset_data_copied: 'Asset file has been copied to clipboard.',
  asset_downloaded: 'Asset file has been downloaded.',
  assets_downloaded: 'Asset files have been downloaded.',
  asset_moved: 'Asset has been moved.',
  assets_moved: '{count} assets have been moved.',
  asset_renamed: 'Asset has been renamed.',
  assets_renamed: '{count} assets have been renamed.',
  asset_deleted: 'Asset has been deleted.',
  assets_deleted: '{count} assets have been deleted.',

  // Content editor
  content_editor: 'Content Editor',
  restore_backup_title: 'Restore Draft',
  restore_backup_description:
    'This entry has a backup from {datetime}. Do you want to restore the edited draft?',
  draft_backup_saved: 'Draft backup has been saved.',
  draft_backup_restored: 'Draft backup has been restored.',
  draft_backup_deleted: 'Draft backup has been deleted.',
  cancel_editing: 'Cancel Editing',
  creating_x: 'Creating {name}',
  creating_x_collection_entry: 'You’re now creating a new entry in the “{collection}” collection.',
  editing_x_in_x: 'Editing {collection} › {entry}',
  editing_x_collection_entry:
    'You’re now editing the “{entry}” entry in the “{collection}” collection.',
  editing_x_collection_file:
    'You’re now editing the “{file}” file in the “{collection}” collection.',
  save_and_publish: 'Save and Publish',
  save_without_publishing: 'Save without Publishing',
  show_editor_options: 'Show Editor Options',
  editor_options: 'Editor Options',
  show_preview: 'Show Preview',
  sync_scrolling: 'Sync Scrolling',
  switch_locale: 'Switch Locale',
  locale_content_errors: 'One more more fields in this locale content have an error.',
  edit: 'Edit',
  preview: 'Preview',
  edit_x_locale: 'Edit {locale} Content',
  preview_x_locale: 'Preview {locale} Content',
  content_preview: 'Content Preview',
  show_content_options_x_locale: 'Show {locale} Content Options',
  content_options_x_locale: '{locale} Content Options',
  x_field: '“{field}” Field',
  show_field_options: 'Show Field Options',
  field_options: 'Field Options',
  unsupported_widget_x: 'Unsupported widget: {name}',
  enable_x_locale: 'Enable {locale}',
  reenable_x_locale: 'Reenable {locale}',
  disable_x_locale: 'Disable {locale}',
  locale_x_has_been_disabled: 'The {locale} content has been disabled.',
  locale_x_now_disabled:
    'The {locale} content is now disabled. It will be deleted when you save the entry.',
  view_in_repository: 'View in Repository',
  view_on_x: 'View on {service}',
  view_on_live_site: 'View on Live Site',
  copy_from: 'Copy from…',
  copy_from_x: 'Copy from {locale}',
  translation_options: 'Translation Options',
  translate: 'Translate',
  translate_field: 'Translate Field',
  translate_fields: 'Translate Fields',
  translate_from: 'Translate from…',
  translate_from_x: 'Translate from {locale}',
  revert_changes: 'Revert Changes',
  revert_all_changes: 'Revert All Changes',
  required: 'Required',
  editor: {
    translation: {
      none: 'Nothing has been translated.',
      started: 'Translating…',
      error: 'There was an error while translating.',
      complete: {
        one: 'Translated the field from {source}.',
        many: 'Translated {count} fields from {source}.',
      },
    },
    copy: {
      none: 'Nothing has been copied.',
      complete: {
        one: 'Copied the field from {source}.',
        many: 'Copied {count} fields from {source}.',
      },
    },
  },
  validation: {
    value_missing: 'This field is required.',
    range_underflow: {
      select_many: 'You have to select at least {min} items.',
      select_one: 'You have to select at least {min} item.',
      add_many: 'You have to add at least {min} items.',
      add_one: 'You have to add at least {min} item.',
    },
    range_overflow: {
      select_many: 'You cannot select more than {max} items.',
      select_one: 'You cannot select more than {max} item.',
      add_many: 'You cannot add more than {max} items.',
      add_one: 'You cannot add more than {max} item.',
    },
    too_short: {
      one: 'You must enter at least {min} character.',
      many: 'You must enter at least {min} characters.',
    },
    too_long: {
      one: 'You cannot enter more than {max} character.',
      many: 'You cannot enter more than {max} characters.',
    },
    type_mismatch: {
      email: 'Please enter a valid email.',
      url: 'Please enter a valid URL.',
    },
  },
  saving_entry: {
    error: {
      title: 'Error',
      description: 'There was an error while saving the entry. Please try again later.',
    },
  },

  // Media details
  viewing_x_asset_details: 'You’re viewing the details of the “{name}” asset.',
  asset_editor: 'Asset Editor',
  preview_unavailable: 'Preview Unavailable.',
  public_url: 'Public URL',
  public_urls: 'Public URLs',
  file_path: 'File Path',
  file_paths: 'File Paths',
  file_data: 'File Data',
  kind: 'Kind',
  size: 'Size',
  dimensions: 'Dimensions',
  duration: 'Duration',
  used_in: 'Used in',

  // Widgets
  select_file: 'Select File',
  select_image: 'Select Image',
  replace_file: 'Replace File',
  replace_image: 'Replace Image',
  remove_file: 'Remove File',
  remove_image: 'Remove Image',
  remove_this_item: 'Remove This Item',
  move_up: 'Move Up',
  move_down: 'Move Down',
  add_x: 'Add {name}',
  select_list_type: 'Select List Type',
  opacity: 'Opacity',
  unselected_option: '(None)',
  assets_dialog: {
    title: {
      file: 'Select File',
      image: 'Select Image',
    },
    search_for_file: 'Search for Files',
    search_for_image: 'Search for Images',
    locations: 'Locations',
    location: {
      local: 'Your Computer',
      repository: 'This Repository',
      external_locations: 'External Locations',
      stock_photos: 'Stock Photos',
    },
    error: {
      invalid_key: 'Your API Key is invalid or expired. Please double check and try again.',
      search_fetch_failed: 'There was an error while searching assets. Please try again later.',
      image_fetch_failed:
        'There was an error while downloading the selected asset. Please try again later.',
    },
    available_images: 'Available Images',
    enter_url: 'Enter URL',
    enter_file_url: 'Enter URL of the file:',
    enter_image_url: 'Enter URL of the image:',
    large_file: {
      title: 'Large File',
      description: 'This file exceeds the maximum size of {size}. Please choose another.',
    },
    photo_credit: {
      title: 'Photo Credit',
      description: 'Use the following credit if possible:',
    },
  },
  character_counter: {
    min_max: {
      one: '{count} character entered. Minimum: {min}. Maximum: {max}.',
      many: '{count} characters entered. Minimum: {min}. Maximum: {max}.',
    },
    min: {
      one: '{count} character entered. Minimum: {min}.',
      many: '{count} characters entered. Minimum: {min}.',
    },
    max: {
      one: '{count} character entered. Maximum: {max}.',
      many: '{count} characters entered. Maximum: {max}.',
    },
  },
  youtube_video_player: 'YouTube video player',
  today: 'Today',
  now: 'Now',
  editor_components: {
    image: 'Image',
    src: 'Source',
    alt: 'Alt Text',
    title: 'Title',
  },

  // Content preview
  boolean: {
    true: 'Yes',
    false: 'No',
  },

  // Integrations
  cloud_storage: {
    invalid: 'The service is not configured properly.',
    auth: {
      initial: 'Sign into {service} to insert media on the storage to entry fields.',
      requested: 'Signing in…',
      error: 'User name or password is incorrect. Please double check and try again.',
    },
  },

  // Configuration
  config: {
    error: {
      no_secure_context: 'Sveltia CMS only works with HTTPS or localhost URLs.',
      fetch_failed: 'The configuration file could not be retrieved.',
      fetch_failed_not_ok: 'HTTP response returned with status {status}.',
      parse_failed: 'The configuration file could not be parsed.',
      parse_failed_invalid_object: 'The configuration file is not a valid JavaScript object.',
      no_collection: 'Collections are not defined in the configuration file.',
      no_backend: 'The backend is not defined in the configuration file.',
      unsupported_backend: 'The configured “{name}” backend is not supported.',
      no_repository: 'The repository is not defined in the configuration file.',
      oauth_implicit_flow: 'The configured authentication method (implicit flow) is not supported.',
      oauth_no_app_id: 'OAuth application ID is not defined in the configuration file.',
      no_media_folder: 'The media folder is not defined in the configuration file.',
      unexpected: 'There was an unexpected error while validating the configuration file.',
      try_again: 'Please solve the issue and try again.',
    },
  },

  // Backends
  local_backend: {
    unsupported_browser:
      'Local development is not supported in your browser. Please use Chrome or Edge instead.',
    disabled: 'Local development is disabled in your browser. <a>Here’s how to enable it</a>.',
  },

  // Editorial Workflow
  status: {
    drafts: 'Drafts',
    in_review: 'In Review',
    ready: 'Ready',
  },

  // Settings
  categories: 'Categories',
  prefs: {
    changes: {
      api_key_saved: 'API key has been saved.',
      api_key_removed: 'API key has been removed.',
    },
    error: {
      permission_denied:
        'Browser storage (Cookie) access has been denied. Please check the permission and try again.',
    },
    appearance: {
      title: 'Appearance',
      theme: 'Theme',
      select_theme: 'Select Theme',
    },
    theme: {
      auto: 'Auto',
      dark: 'Dark',
      light: 'Light',
    },
    languages: {
      title: 'Languages',
      ui_language: {
        title: 'User Interface Language',
        select_language: 'Select Language',
      },
      translator: {
        title: '{service} Translator',
        field_label: '{service} API Authentication Key',
        description:
          'Sign up for <a {homeHref}>{service} API</a> and enter <a {apiKeyHref}>your Authentication Key</a> here to enable quick translation of text entry fields.',
      },
    },
    contents: {
      title: 'Contents',
      editor: {
        title: 'Editor',
        close_on_save: {
          switch_label: 'Close the editor after saving a draft',
        },
      },
    },
    media: {
      title: 'Media',
      stock_photos: {
        title: '{service} Free Images',
        field_label: '{service} API Key',
        description:
          'Sign up for <a {homeHref}>{service} API</a> and enter <a {apiKeyHref}>your API Key</a> here to insert free stock photos to image entry fields.',
        credit: 'Photos provided by {service}',
      },
    },
    accessibility: {
      title: 'Accessibility',
      underline_links: {
        title: 'Underline Links',
        description: 'Show underline for links in the entry preview and user interface labels.',
        switch_label: 'Always Underline Links',
      },
    },
    advanced: {
      title: 'Advanced',
      deploy_hook: {
        title: 'Deploy Hook',
        description:
          'Enter a webhook URL to be called when you manually trigger a deployment by selecting Publish Changes. This can be left blank if you’re using GitHub Actions.',
        field_label: 'Deploy Hook URL',
        url_saved: 'Webhook URL has been saved.',
        url_removed: 'Webhook URL has been removed.',
      },
      developer_mode: {
        title: 'Developer Mode',
        description:
          'Enable some features, including detailed console logs and native context menus.',
        switch_label: 'Enable Developer Mode',
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts_: {
    view_content_library: 'View Content Library',
    view_asset_library: 'View Asset Library',
    search: 'Search for entries and assets',
    create_entry: 'Create a new entry',
    save_entry: 'Save an entry',
    cancel_editing: 'Cancel entry editing',
  },

  // File types
  file_type_labels: {
    avif: 'AVIF image',
    bmp: 'Bitmap image',
    gif: 'GIF image',
    ico: 'Icon',
    jpeg: 'JPEG image',
    jpg: 'JPEG image',
    png: 'PNG image',
    svg: 'SVG image',
    tif: 'TIFF image',
    tiff: 'TIFF image',
    webp: 'WebP image',
    avi: 'AVI video',
    mp4: 'MP4 video',
    mpeg: 'MPEG video',
    ogv: 'OGG video',
    ts: 'MPEG video',
    webm: 'WebM video',
    '3gp': '3GPP video',
    '3g2': '3GPP2 video',
    aac: 'AAC audio',
    mid: 'MIDI',
    midi: 'MIDI',
    mp3: 'MP3 audio',
    opus: 'OPUS audio',
    wav: 'WAV audio',
    weba: 'WebM audio',
    csv: 'CSV spreadsheet',
    doc: 'Word document',
    docx: 'Word document',
    odp: 'OpenDocument presentation',
    ods: 'OpenDocument spreadsheet',
    odt: 'OpenDocument text',
    pdf: 'PDF document',
    ppt: 'PowerPoint presentation',
    pptx: 'PowerPoint presentation',
    rtf: 'Rich text document',
    xls: 'Excel spreadsheet',
    xlsx: 'Excel spreadsheet',
    html: 'HTML text',
    js: 'JavaScript',
    json: 'JSON text',
    md: 'Markdown text',
    toml: 'TOML text',
    yaml: 'YAML text',
    yml: 'YAML text',
  },

  // file size units
  file_size_units: {
    b: '{size} bytes',
    kb: '{size} KB',
    mb: '{size} MB',
    gb: '{size} GB',
    tb: '{size} TB',
  },
};
