/**
 * IMPORTANT: These strings are not ready for localization. DO NOT TRANSLATE THIS FILE.
 * @see https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md
 */
export const strings = {
  // Pages & Navigation
  collections: 'Коллекции',
  contents: 'контент',
  entries: 'Записи',
  assets: 'Ресурсы',
  media: 'Медиафайлы',
  workflow: 'Рабочий процесс',
  editorial_workflow: 'Редакционный процесс',
  menu: 'Меню',

  // Account
  user_name: 'Имя пользователя',
  password: 'Пароль',
  sign_in: 'Войти',
  signed_in_as_x: 'Вошли как {name}',
  working_with_local_repo: 'Работа с локальным репозиторием',
  working_with_test_repo: 'Работа с тестовым репозиторием',
  sign_out: 'Выйти',

  // Common terms
  create: 'Новый',
  select: 'Выбрать',
  select_all: 'Выбрать всё',
  upload: 'Загрузить',
  copy: 'Копировать',
  download: 'Скачать',
  duplicate: 'Дублировать',
  delete: 'Удалить',
  save: 'Сохранить',
  saving: 'Сохранение…',
  rename: 'Переименовать',
  update: 'Обновить',
  replace: 'Заменить',
  add: 'Добавить',
  remove: 'Удалить',
  remove_x: 'Удалить {name}',
  clear: 'Очистить',
  expand: 'Развернуть',
  expand_all: 'Развернуьб все',
  collapse: 'Свернуть',
  collapse_all: 'Свернуть все',
  insert: 'Вставить',
  restore: 'Восстановить',
  discard: 'Отменить',
  searching: 'Поиск…',
  global: 'Глобально',
  primary: 'Првичный',
  secondary: 'Вторичный',
  collection: 'Коллекция',
  folder: 'Директория',
  api_key: 'API Ключ',
  details: 'Детали',
  back: 'Назад',

  // Common errors
  clipboard_error: 'Возникла ошибка во время копирования данных.',

  // Entrance
  welcome_to_sveltia_cms: 'Добро пожаловать в Sveltia CMS',
  loading_site_config: 'Загрузка конфигурации сайта…',
  loading_site_data: 'Загрузка данных сайта…',
  loading_site_data_error: 'Возникла ошибка во время загрузки данных сайта.',
  sign_in_with_x: 'Войти через {service}',
  authorizing: 'Авторизация…',
  signing_in: 'Вход…',
  work_with_local_repo: 'Работа с локальным репозиторием',
  work_with_local_repo_description:
    'Нажмите кнопку чтобы вбрать корневую директорию “{repo}” репозитория.',
  work_with_local_repo_description_no_repo:
    'Нажмите кнопку чтобы выбрать корневую директорию вашего Git репозитория',
  work_with_test_repo: 'Работа с тестовым репозиторием',
  sign_in_error: {
    not_project_root:
      'Директория которую вы выбрали не является корневой директорией репозитория. Пожалуйста попробуйте еще раз',
    picker_dismissed: 'Корневая директория репозитория не может быть выбрана. Пожалуйста попробуйте еще раз.',
    authentication_aborted: 'Аутентификация отменена. PПожалуйста попробуйте еще раз.',
    // Errors defined in Sveltia CMS Authenticator
    // https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
    UNSUPPORTED_BACKEND: 'Ваш Git backend не поддерживается аутентификатором.',
    UNSUPPORTED_DOMAIN: 'Ваш домен не позволено использовать аутентификатором.',
    MISCONFIGURED_CLIENT: 'OAuth client ID или secret приложения не настроен.',
    AUTH_CODE_REQUEST_FAILED: 'Не удалось получить код авторизаци. Пожалуйста попробуйте еще раз.',
    CSRF_DETECTED: 'Обнаружена потенциальная CSRF атака. Аутентификация прервана.',
    TOKEN_REQUEST_FAILED: 'Не удалось запроситьn access token. Пожалуйста попробуйте еще раз.',
    MALFORMED_RESPONSE: 'Сервер отвелил некорректными данными. Пожалуйста попробуйте еще раз.',
  },
  repository_no_access: 'У вас нет доступа к репозиторию “{repo}”.',
  repository_not_found: 'Репозиторий “{repo}” не существует.',
  repository_empty: 'Репозиторий “{repo}” не содержит веток.',
  branch_not_found: 'Репозиторий “{repo}”  не содержит веток ветку “{branch}” ',
  unexpected_error: 'Unexpected Error',

  // Parser errors
  entry_parse_error:
    'Возникла ошибка во время обработки entry файла. Проверьте констоль отладки браузера для подробностей.',
  entry_parse_errors:
    'Возникли ошибки во время обработки entry файла. Проверьте констоль отладки браузера для подробностей.',

  // Global toolbar
  visit_live_site: 'Перейти на сайт',
  switch_page: 'Переключить страницу',
  search_placeholder_entries: 'Поиск записей…',
  search_placeholder_assets: 'Поиск ресурсов…',
  search_placeholder_all: 'поиск записей и ресурсов…',
  create_entry_or_assets: 'Создать запись или ресурс',
  publish_changes: 'Опубликовать изменения',
  publishing_changes: 'Публикация изменений…',
  publishing_changes_failed: 'Изменения не могут быть опубликованы. Пожалуйста попробуйте еще раз позднее.',
  show_notifications: 'Показать оповещения',
  notifications: 'Оповещения',
  show_account_menu: 'Показать меню учетной записи',
  account: 'Учетная запись',
  live_site: 'сайт',
  git_repository: 'Репозиторий Git',
  settings: 'Настройки',
  site_config: 'Настройки сайта',
  show_help_menu: 'Показать меню справки',
  help: 'Справка',
  keyboard_shortcuts: 'Горячие клавиши',
  documentation: 'Документация',
  release_notes: 'римечания к выпуску',
  version_x: 'Версия {version}',
  report_issue: 'Сообщить об ошибке',
  share_feedback: 'Оставить отзыв',
  get_help: 'Получить справку',
  join_discord: 'свяжитесь снами через Discord',

  // Update notification
  update_available: 'Доступна новая версия Sveltia CMS.',
  update_now: 'Обновить сейчас',

  // Backend status indicator
  backend_status: {
    minor_incident:
      'С {service} возникли небольшие трудности.  Потенциально может быть затронут ваш рабочий процесс.',
    major_incident:
      'С {service} возникли серьёзные проблемы. Вам слежует подождать пока ситуация не улучшится.',
  },

  // Library
  content_library: 'Библиотека контента',
  asset_library: 'Библиотека ресурсов',
  collection_assets: 'Коллекция ресурсов',
  entry_assets: 'Ресурсы записи',
  entry_list: 'Список записей',
  file_list: 'Список файлов',
  asset_list: 'Список ресурсов',
  x_collection: '“{collection}” Коллекция',
  x_asset_folder: '“{folder}” Директория ресурсов',
  viewing_collection_list: 'Вы просматриваете список коллекции.',
  viewing_asset_folder_list: 'Вы просматриваете список папок с ресурсами.',
  viewing_x_collection_many_entries:
    'Вы просматриваете коллекцию “{collection}” которая содержит {count} записей.',
  viewing_x_collection_one_entry:
    'Вы просматриваете коллекцию “{collection}” которая содержит одну запись.',
  viewing_x_collection_no_entries:
    'Вы просматриваете коллекцию “{collection}” которая не содержит записей.',
  viewing_x_asset_folder_many_assets:
    'Вы просматриваете директорию “{folder}” которая содержит {count} ресурс.',
  viewing_x_asset_folder_one_asset:
    'Вы просматриваете директорию “{folder}” которая содержит один ресурс.',
  viewing_x_asset_folder_no_assets:
    'Вы просматриваете директорию “{folder}” которая не содержит ресурсов.',
  collection_not_found: 'Коллекция не найдена',
  file_not_found: 'Файл не найден.',
  x_of_x_selected: 'выбрано {selected} из {total}',
  switch_view: 'Переключить вид',
  list_view: 'Список',
  grid_view: 'Сетка',
  switch_to_list_view: 'Переключить на вид списком',
  switch_to_grid_view: 'Переключить а вид сеткой',
  sort: 'Сортировка',
  sorting_options: 'Параметры сортировки',
  sort_keys: {
    none: 'Не задана',
    name: 'По имени',
    commit_author: 'Автор',
    commit_date: 'Дата',
  },
  ascending: '{label}, В алфавитном порядке',
  ascending_date: '{label}, Снчала старые',
  descending: '{label}, С конца адфавита',
  descending_date: '{label}, Сначала новые',
  filter: 'Фильтр',
  filtering_options: 'Парааметры фильтра',
  group: 'Группировать', // Verb
  grouping_options: 'Параметры группирования',
  type: 'Тип',
  all: 'Все',
  image: 'Изображения',
  video: 'Видео',
  audio: 'Звукозапись',
  document: 'Документ',
  other: 'Прочее',
  show_assets: 'Показать ресурсы',
  hide_assets: 'Скрыть ресурсы',
  show_info: 'Показать информацию',
  hide_info: 'Скрыть информацию',
  all_assets: 'Все ресурсы',
  uncategorized: 'Без типа',
  creating_entries_disabled_by_admin:
    'Создание новых записей в этой коллекции отключено администратором.',
  creating_entries_disabled_by_limit:
    'Вы не можете добавлять записи в эту коллекцию потому что достигнут установленный лтмит в {limit} записей.',
  back_to_collection: 'Назад в коллекцию',
  collection_list: 'Список коллекций',
  back_to_collection_list: 'Назад к списку коллекций',
  asset_folder_list: 'Список директорий с ресурсами',
  back_to_asset_folder_list: 'Нвзвд к списку директорий с ресурсами',
  search_results: 'Результаты поиска',
  search_results_for_x: 'SРезультаты поиска для “{terms}”',
  viewing_search_results:
    'Вы просматриваете результаты поиска для “{terms}”. Найдено {entries} и {assets}.',
  many_entries: '{count} записей',
  one_entry: 'одна запись',
  no_entries: 'ни одной записи',
  many_assets: '{count} ресурсов',
  one_asset: 'один ресурс',
  no_assets: 'ни одного ресурса',
  no_files_found: 'файлов не найдено.',
  no_entries_found: 'Записей не найдено.',
  upload_assets: 'Загрузить новый ресурс',
  edit_options: 'Параметры редактирования',
  show_edit_options: 'Показать папраметры редактирования',
  edit_asset: 'Изменить ресурс',
  edit_x: 'Изменение {name}',
  wrap_long_lines: 'свернуть длинные строки',
  rename_asset: 'Переименовать ресурс',
  rename_x: 'Переименование {name}',
  enter_new_name_for_asset: 'Введите новое имя.',
  enter_new_name_for_asset_with_one_entry:
    'Введите новое имя. Запись использующая ресурс также будет обновлена.',
  enter_new_name_for_asset_with_many_entries:
    'Введите новое имя. {count} записей использующих ресурс также будут обновлены.',
  enter_new_name_for_asset_error: {
    empty: 'Имя файоа не может быть пустым.',
    character: 'Имя файла не может содержать специальные символы.',
    duplicate: 'Это имя файла уже используется другим ресурсом.',
  },
  replace_asset: 'Заменить ресурс',
  replace_x: 'Заменить {name}',
  tap_to_browse: 'Нажмите чтобы выбрать…',
  drop_file_or_click_to_browse: 'Drop a file here or click to browse…',
  drop_files_or_click_to_browse: 'Drop files here or click to browse…',
  drop_image_file_or_click_to_browse: 'Drop an image file here or click to browse…',
  drop_image_files_or_click_to_browse: 'Drop image files here or click to browse…',
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
  processing_file: 'Processing a file. This may take a while.',
  processing_files: 'Processing files. This may take a while.',
  uploading_files: 'Uploading Files',
  confirm_replacing_file: 'Are you sure to replace “{name}” with the following file?',
  confirm_uploading_file: 'Are you sure to save the following file to the “{folder}” folder?',
  confirm_uploading_files:
    'Are you sure to save the following {count} files to the “{folder}” folder?',
  oversized_files: 'Oversized Files',
  warning_oversized_file:
    'This file cannot be uploaded because it exceeds the maximum size of {size}. Please reduce the size or select a different file.',
  warning_oversized_files:
    'These files cannot be uploaded because they exceed the maximum size of {size}. Please reduce the sizes or select different files.',
  file_meta: '{type} · {size}',
  file_meta_converted_from_x: '(converted from {type})',
  no_entries_created: 'This collection has no entries yet.',
  create_new_entry: 'Create New Entry',
  entry: 'Entry',
  index_file: 'Index File',
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
  create_entry_title: 'Creating {name}',
  create_entry_announcement: 'You’re now creating a new entry in the “{collection}” collection.',
  edit_entry_title: '{collection} › {entry}',
  edit_entry_announcement:
    'You’re now editing the “{entry}” entry in the “{collection}” collection.',
  edit_file_announcement: 'You’re now editing the “{file}” file in the “{collection}” collection.',
  save_and_publish: 'Save and Publish',
  save_without_publishing: 'Save without Publishing',
  show_editor_options: 'Show Editor Options',
  editor_options: 'Editor Options',
  show_preview: 'Show Preview',
  sync_scrolling: 'Sync Scrolling',
  switch_locale: 'Switch Locale',
  locale_content_disabled_short: '(disabled)',
  locale_content_error_short: '(error)',
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
  edit_slug: 'Edit Slug',
  edit_slug_warning:
    'Changing the slug may break internal and external links to the entry. Currently, Sveltia CMS does not update references created with the Relation widget, so you’ll need to manually update such references along with other links.',
  edit_slug_error: {
    empty: 'The slug cannot be empty.',
    duplicate: 'This slug is used for another entry.',
  },
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
      number: 'Value must be greater than or equal to {min}.',
      select_many: 'You have to select at least {min} items.',
      select_one: 'You have to select at least {min} item.',
      add_many: 'You have to add at least {min} items.',
      add_one: 'You have to add at least {min} item.',
    },
    range_overflow: {
      number: 'Value must be less than or equal to {max}.',
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
      number: 'Please enter a number.',
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
  add_item_above: 'Add Item Above',
  add_item_below: 'Add Item Below',
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
    link: 'Link',
  },
  key_value: {
    key: 'Key',
    value: 'Value',
    action: 'Action',
    empty_key: 'Key is required.',
    duplicate_key: 'Key must be unique.',
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
      parse_failed_unsupported_type:
        'The configuration file is not a valid file type. Only YAML and JSON are supported.',
      no_collection: 'Collections are not defined in the configuration file.',
      missing_backend: 'The backend is not defined in the configuration file.',
      missing_backend_name: 'The backend name is not defined in the configuration file.',
      unsupported_backend: 'The configured “{name}” backend is not supported.',
      missing_repository: 'The repository is not defined in the configuration file.',
      invalid_repository:
        'The configured repository is invalid. It must be in “owner/repo” format.',
      oauth_implicit_flow: 'The configured authentication method (implicit flow) is not supported.',
      oauth_no_app_id: 'OAuth application ID is not defined in the configuration file.',
      missing_media_folder: 'The media folder is not defined in the configuration file.',
      invalid_media_folder: 'The configured media folder is invalid. It must be a string.',
      invalid_public_folder: 'The configured public folder is invalid. It must be a string.',
      public_folder_relative_path:
        'The configured public folder is invalid. It must be an absolute path starting with “/”.',
      public_folder_absolute_url: 'An absolute URL for the public folder option is not supported.',
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
    language: {
      title: 'Language',
      ui_language: {
        title: 'User Interface Language',
        select_language: 'Select Language',
      },
    },
    contents: {
      title: 'Contents',
      editor: {
        title: 'Editor',
        use_draft_backup: {
          switch_label: 'Automatically back up entry drafts',
        },
        close_on_save: {
          switch_label: 'Close the editor after saving a draft',
        },
      },
      translator: {
        title: '{service} Translator',
        field_label: '{service} API Authentication Key',
        description:
          'Sign up for <a {homeHref}>{service} API</a> and enter <a {apiKeyHref}>your Authentication Key</a> here to enable quick translation of text entry fields.',
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
      beta: {
        title: 'Beta Features',
        description: 'Enable some beta features that may be unstable or unlocalized.',
        switch_label: 'Join Beta Program',
      },
      developer_mode: {
        title: 'Developer Mode',
        description:
          'Enable some developer-oriented features, including detailed console logs and native context menus.',
        switch_label: 'Enable Developer Mode',
      },
      deploy_hook: {
        title: 'Deploy Hook',
        description:
          'Enter a webhook URL to be called when you manually trigger a deployment by selecting Publish Changes. This can be left blank if you’re using GitHub Actions.',
        field_label: 'Deploy Hook URL',
        url_saved: 'Webhook URL has been saved.',
        url_removed: 'Webhook URL has been removed.',
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
    m4v: 'MP4 video',
    mov: 'QuickTime video',
    mp4: 'MP4 video',
    mpeg: 'MPEG video',
    mpg: 'MPEG video',
    ogg: 'Ogg video',
    ogv: 'Ogg video',
    ts: 'MPEG video',
    webm: 'WebM video',
    '3gp': '3GPP video',
    '3g2': '3GPP2 video',
    aac: 'AAC audio',
    mid: 'MIDI',
    midi: 'MIDI',
    m4a: 'MP4 audio',
    mp3: 'MP3 audio',
    oga: 'Ogg audio',
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

