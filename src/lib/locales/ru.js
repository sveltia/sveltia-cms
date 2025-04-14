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
  drop_file_or_click_to_browse: 'Перетащите файл сюда или нажмите стобы выбрать…',
  drop_files_or_click_to_browse: 'Перетащите файлы сюда или нажмите стобы выбрать…',
  drop_image_file_or_click_to_browse: 'Перетащите файл изображения сюда или нажмите стобы выбрать…',
  drop_image_files_or_click_to_browse: 'Перетащите файлы изображений сюда или нажмите стобы выбрать…',
  drop_file_here: 'Перетащите файл сюда',
  drop_files_here: 'Перетащите файлы сюда',
  drop_files_type_mismatch: 'Выбранный файл не соответствует типу “{type}”. Пожалуйста попробуйте снова.',
  choose_file: 'Выбрать файл',
  choose_files: 'Выбрать файлы',
  delete_asset: 'Удалить ресурс',
  delete_assets: 'Удалить ресурсы',
  delete_selected_asset: 'Удалить выбранный ресурс',
  delete_selected_assets: 'Удалить выбранные ресурсы',
  confirm_deleting_this_asset: 'Вы действительно хотите удалить этот ресурс?',
  confirm_deleting_selected_asset: 'Вы действительно хотите удалить выбранный ресурс?',
  confirm_deleting_selected_assets: 'Вы действительно хотите удалить {count} выбранных ресрсов?',
  confirm_deleting_all_assets: 'Вы действительно хотите удалить все ресурсы?',
  delete_entry: 'Удалить запись',
  delete_entries: 'Удалить записи',
  delete_selected_entry: 'Удалить выбранную запись',
  delete_selected_entries: 'Удалить выбранные записи',
  confirm_deleting_this_entry: 'Вы действительно хотите удалить эту запись?',
  confirm_deleting_this_entry_with_assets:
    'Вы действительно хотите удалить эту запись и связанные ресурсы?',
  confirm_deleting_selected_entry: 'Вы действительно хотите удалить выделенную запись?',
  confirm_deleting_selected_entry_with_assets:
    'Вы действительно хотите удалить выделенную запись и связанные ресурсы?',
  confirm_deleting_selected_entries: 'Вы действительно хотите удалить {count} выделенных записей?',
  confirm_deleting_selected_entries_with_assets:
    'Вы действительно хотите удалить {count} выделенных записей и связанные ресурсы?',
  confirm_deleting_all_entries: 'Вы действительно хотите удалить все записи?',
  confirm_deleting_all_entries_with_assets:
    'Вы действительно хотите удалить все записи и связанные ресурсы??',
  processing_file: 'Обработка файла. Это может занять некоторое время.',
  processing_files: 'Обработка файлов. Это может занять некоторое время.',
  uploading_files: 'Загрузка файлов',
  confirm_replacing_file: 'Вы действительно хотите заменить “{name}” следующим файлом?',
  confirm_uploading_file: 'Вы действительно хотите сохранить следующий файл в директорию “{folder}”?',
  confirm_uploading_files:
    'Вы действительно хотите сохранить следующие {count} файлов в диекторию “{folder}”?',
  oversized_files: 'Слишком большие файлы',
  warning_oversized_file:
    'Этот файл не может быть загружен потому что он превышает максимальный размер файла {size}. Пожалуйста уменьшите размер или выберите другой файл.',
  warning_oversized_files:
    'Эти файлы не могут быть загружены потому что они превышают максимальный размер файла {size}. Пожалуйста уменьшите размер или выберите другие файлы.',
  file_meta: '{type} · {size}',
  file_meta_converted_from_x: '(converted from {type})',
  no_entries_created: 'Эта коллекция пока не содержит записей.',
  create_new_entry: 'Создать новую запись',
  entry: 'Запись',
  index_file: 'Index файл',
  no_files_in_collection: 'В этой коллекции нет файлов.',
  asset_info: 'Информация о ресурсе',
  select_asset_show_info: 'Выбкрите ресурс для просмотра информации.',
  duplicate_entry: 'Дублировать запись',
  entry_duplicated: 'Запись дублирована. Теперь это черновик новой записи',
  entry_validation_error: 'Одно поле содержит ошибку. Пожалуйста исправьте это для сохранения записи.',
  entry_validation_errors: '{count} полей содержат ошибки. Пожалуйста исправьте это для сохранения записи.',
  entry_saved: 'Запись сохранена.',
  entry_saved_and_published: 'Запись сохранена и опубликована.',
  entry_deleted: 'Запись удалена.',
  entries_deleted: '{count} записей улалены.',
  asset_saved: 'Ресурс сохранен.',
  asset_saved_and_published: 'Ресурс сохранен и опубликован.',
  assets_saved: '{count} ресурсов сохранено.',
  assets_saved_and_published: '{count} ресурсов сохранено и опубликовано.',
  asset_url_copied: 'URL ресурса копирован в буфер обмена.',
  asset_urls_copied: 'URL ресурсов копированы в буфер обмена.',
  asset_path_copied: 'Путь к файлу ресурса копирован в буфер обмена.',
  asset_paths_copied: 'Пути к файлам ресурса копированы в буфер обмена.',
  asset_data_copied: ' Файл ресурса копирован в буфер обмена.',
  asset_downloaded: 'Файл ресурса скачан.',
  assets_downloaded: 'Файлы ресурсов скачаны.',
  asset_moved: 'Ресурс перемещен.',
  assets_moved: '{count} ресурсов перемещены.',
  asset_renamed: 'Ресурс переименован.',
  assets_renamed: '{count} ресурсов переименовано.',
  asset_deleted: 'Ресурс удален.',
  assets_deleted: '{count} ресурсов удалено.',

  // Content editor
  content_editor: 'Редактор',
  restore_backup_title: 'Восстановить черновик',
  restore_backup_description:
    'Запись имеет резервную копию от {datetime}. Хотите восстановить эту версию?',
  draft_backup_saved: 'Резервная копия черновика сохранена.',
  draft_backup_restored: 'Резервная копия черновика восстановлена.',
  draft_backup_deleted: 'Резервная копия черновика удалена.',
  cancel_editing: 'Отменить редактирование',
  create_entry_title: 'Создание {name}',
  create_entry_announcement: 'Вы создаете новую запись в коллекции “{collection}”.',
  edit_entry_title: '{collection} › {entry}',
  edit_entry_announcement:
    'Вы редактируете запись “{entry}” в коллекции “{collection}”.',
  edit_file_announcement: 'Вы редактируете файл “{file}” в коллекции “{collection}”.',
  save_and_publish: 'Сохранить и опубликовать',
  save_without_publishing: 'Сохранить но не публиковать',
  show_editor_options: 'Показать параметры редактора',
  editor_options: 'Параметры редактора',
  show_preview: 'Предпросмотр',
  sync_scrolling: 'синхронная прокрутка',
  switch_locale: 'переключить язык',
  locale_content_disabled_short: '(откобчено)',
  locale_content_error_short: '(ошибка)',
  edit: 'Редактировать',
  preview: 'Предпросмотр',
  edit_x_locale: 'Редактировать на языке {locale}',
  preview_x_locale: 'Предпросмотр на языке {locale}',
  content_preview: 'Предпросмотр записи',
  show_content_options_x_locale: 'Показать параметры контента на языке {locale}',
  content_options_x_locale: 'Параметры контента на {locale}',
  x_field: '“{field}” поле',
  show_field_options: 'Показать параметры поля',
  field_options: 'Параметры поля',
  unsupported_widget_x: 'неподдерживаемый виджет: {name}',
  enable_x_locale: 'Включить {locale}',
  reenable_x_locale: 'Перезагрузить {locale}',
  disable_x_locale: 'Отключить {locale}',
  locale_x_has_been_disabled: 'Содержимое на язвке {locale} выключено.',
  locale_x_now_disabled:
    'Солержимое на язвке {locale} выключено. Оно будет удалено, когда вы сохраните запись.',
  view_in_repository: 'Показать в репозитории',
  view_on_x: 'Показать на {service}',
  view_on_live_site: 'Показа на сайте',
  copy_from: 'Копировать из…',
  copy_from_x: 'Копировать из {locale}',
  translation_options: 'Параметры перевода',
  translate: 'Перевести',
  translate_field: 'Перевести поле',
  translate_fields: 'Перевести поля',
  translate_from: 'Перевести с…',
  translate_from_x: 'Перевести с {locale}',
  revert_changes: 'Отменить изменения',
  revert_all_changes: 'Отменить все изменения',
  edit_slug: 'Изменить Slug',
  edit_slug_warning:
    'Изменение slug может сломать внутренние и внутренние ссылки на записи. Сейчас, Sveltia CMS не поддерживает обновление ссылок созданных с помощью виджета Relation, поэтому вам придется обновить эти и другие ссылки вручую.',
  edit_slug_error: {
    empty: 'этот slug не может быть пустым.',
    duplicate: 'Этот slug используется для другой записи.',
  },
  required: 'Обязательно',
  editor: {
    translation: {
      none: 'Ничего не переведено.',
      started: 'Перевод…',
      error: 'Во время перевода возникла ошибка.',
      complete: {
        one: 'Переведено поле из {source}.',
        many: 'Переведено {count} полей из {source}.',
      },
    },
    copy: {
      none: 'Ничего не скопировано.',
      complete: {
        one: 'Копировано поле из {source}.',
        many: 'Копированы {count} полей из {source}.',
      },
    },
  },
  validation: {
    value_missing: 'Поле требуется.',
    range_underflow: {
      number: 'Знвчение должно быть больше или равно {min}.',
      select_many: 'Нужно выбрать не меньше {min} элементов.',
      select_one: 'Нужно выбрать не меньше {min} элементов.',
      add_many: 'Нужно добавить не меньше {min} элементов.',
      add_one: 'Нужно добавить не меньше {min} элементов.',
    },
    range_overflow: {
      number: 'Знвчение должно быть меньше или равно {max}.',
      select_many: 'Нельзя выбрать больше {max} элементов.',
      select_one: 'Нельзя выбрать больше {max} элементов.',
      add_many: 'Нельзя добавить больше {max} элементов.',
      add_one: 'Нельзя добавить больше {max} элементов.',
    },
    too_short: {
      one: 'Нужно ввести не менее {min} символа.',
      many: 'Нужно ввести не менее {min} символов.',
    },
    too_long: {
      one: 'Нужно ввести не более {max} символа.',
      many: 'Нужно ввести не более {max} символов.',
    },
    type_mismatch: {
      number: 'Пожалуйста введите цифры.',
      email: 'Пожалуйста введите email.',
      url: 'Пожалуйста введите корректный URL.',
    },
  },
  saving_entry: {
    error: {
      title: 'Ошибка',
      description: 'Во время сохранения записи возникла ошибка. Пожалуйста попробуйте позднее.',
    },
  },

  // Media details
  viewing_x_asset_details: 'Вы просматриваете информацию о ресурса “{name}” .',
  asset_editor: 'Редактор ресурсов',
  preview_unavailable: 'Предпросмотр невозможен.',
  public_url: 'публичный URL',
  public_urls: 'Публичные URL',
  file_path: 'Путь к файлу',
  file_paths: 'Пути к файлам',
  file_data: 'Данные файла',
  kind: 'Тип',
  size: 'Размер',
  dimensions: 'Размеры',
  duration: 'Длительность',
  used_in: 'Использован в',

  // Widgets
  select_file: 'Выбрать файл',
  select_image: 'Выбрать изображение',
  replace_file: 'Заменить файл',
  replace_image: 'Заменить изображение',
  remove_file: 'Удалить файл',
  remove_image: 'Удалить изображение',
  remove_this_item: 'Удалить этот элемент',
  move_up: 'Переместить вверх',
  move_down: 'Переместить вниз',
  add_x: 'Добавить {name}',
  add_item_above: 'Добавить элемент сверху',
  add_item_below: 'Добавить элеменнт снизу',
  select_list_type: 'Выбрать тип списка',
  opacity: 'Прозрачность',
  unselected_option: '(Нет)',
  assets_dialog: {
    title: {
      file: 'Выбрать файл',
      image: 'Выбрать изображение',
    },
    search_for_file: 'Искать файлы',
    search_for_image: 'Искать изображения',
    locations: 'Местоположение',
    location: {
      local: 'Ваш компьютер',
      repository: 'Этот репозиторий',
      external_locations: 'Внешнее местоположение',
      stock_photos: 'Общедоступные фото',
    },
    error: {
      invalid_key: 'Ваш API ключ некорректен или истек. Пожалуйста перепроверьте и попробуйте снова.',
      search_fetch_failed: 'Во время поиска ресурсов возникла ошибка. Пожалуйста попробуйте позднее снова.',
      image_fetch_failed:
        'Во время скачивания ресурса возникла ошибка. Пожалуйста попробуйте снова позже.',
    },
    available_images: 'Доступные изображения',
    enter_url: 'Введите URL',
    enter_file_url: 'Введите URL файла:',
    enter_image_url: 'Введите URL изображения:',
    large_file: {
      title: 'Большой файл',
    },
    photo_credit: {
      title: 'Фото Credit',
      description: 'Использвать следующий credit если возможно:',
    },
  },
  character_counter: {
    min_max: {
      one: 'Введено {count} символа. Минмум: {min}. Максимум: {max}.',
      many: 'Введено {count} Символов. Минимум: {min}. Максимум: {max}.',
    },
    min: {
      one: 'Введено {count} символа. Минимум: {min}.',
      many: 'Введено {count} символов. Минимум: {min}.',
    },
    max: {
      one: 'Введено {count} символа. Максимум: {max}.',
      many: 'Введено {count} Символов. Максимум: {max}.',
    },
  },
  youtube_video_player: 'Видео проигрыватель YouTube',
  today: 'Сегодня',
  now: 'Сейчас',
  editor_components: {
    image: 'Изображение',
    src: 'исходный',
    alt: 'Alt тэг',
    title: 'Надпись',
    link: 'Ссылка',
  },
  key_value: {
    key: 'Ключ',
    value: 'Значение',
    action: 'Действие',
    empty_key: 'Ключ обязателен.',
    duplicate_key: 'Ключ должен быть уникален.',
  },

  // Content preview
  boolean: {
    true: 'Да',
    false: 'Нет',
  },

  // Integrations
  cloud_storage: {
    invalid: 'Сервис настроен некорректно.',
    auth: {
      initial: 'Войдите в {service} чтобы вставить мультимедиа из хранилища в поле записи.',
      requested: 'Вход…',
      error: 'Имя рользователя или парольекорректны. Пожалуйста перепроверьте и попробуйте снова.',
    },
  },

  // Configuration
  config: {
    error: {
      no_secure_context: 'Sveltia CMS работает только по HTTPS или на локальном (localhost) URL.',
      fetch_failed: 'Не удалось получить конфигурационный файл.',
      fetch_failed_not_ok: 'HTTP ответ вернул статус {status}.',
      parse_failed: 'Не удалось обработать конфигурационный файл.',
      parse_failed_invalid_object: 'Файл конфигурации не является допустимым объектом JavaScript.',
      parse_failed_unsupported_type:
        'Файл конфигурации недопустимого типа. Поддерживаются только YAML и JSON.',
      no_collection: 'В файле конфигурации не определены коллекции.',
      missing_backend: 'В файле конфигурации не задано ключевое слово backend.',
      missing_backend_name: 'В файле конфигурации не определено название backend.',
      unsupported_backend: 'Заданный backend “{name}” не поддерживается.',
      missing_repository: 'В файле конфигурации не задан репозиторий.',
      invalid_repository:
        'Настроенный репозиторий некорректен. Он должен быть задан в формате “владелец/репозиторий”.',
      oauth_implicit_flow: 'Настроенный метод аутентификации (implicit flow) не поддерживается.',
      oauth_no_app_id: 'В файле конфигурации не задан OAuth идентификатор приложения.',
      missing_media_folder: 'В файле конфигурации не задана папка мультимедиа.',
      invalid_media_folder: 'Указана недопустимая директория мультимедиа. Это должна быть строка.',
      invalid_public_folder: 'Указанная публичная директория недопустима. Это должна быть строка.',
      public_folder_relative_path:
        'Указанная публчная директоря недопустима. Это должен быть абсолютный путь, начинающийся с “/”.',
      public_folder_absolute_url: 'Абсолютный URL-адрес для параметра "публичная директория" не поддерживается.',
      unexpected: 'При проверке файла конфигурации произошла непредвиденная ошибка.',
      try_again: 'Пожалуйста, устраните проблему и повторите попытку.',
    },
  },

  // Backends
  local_backend: {
    unsupported_browser:
      'Локальная разработка не поддерживается вашим браузером. Пожалуйста, используйте Chrome или Edge.',
    disabled: 'В вашем браузере отключена локальная разработка. <a>Вот как ее включить.</a>.',
  },

  // Editorial Workflow
  status: {
    drafts: 'Черновики',
    in_review: 'На проверке',
    ready: 'Готово',
  },

  // Settings
  categories: 'Категории',
  prefs: {
    changes: {
      api_key_saved: 'API ключ сохранен.',
      api_key_removed: 'API ключ удален.',
    },
    error: {
      permission_denied:
        'В доступе к хранилищу браузера (Cookie) было отказано. Пожалуйста, проверьте разрешение и повторите попытку.',
    },
    appearance: {
      title: 'Отображение',
      theme: 'Темы',
      select_theme: 'Выбрать тему',
    },
    theme: {
      auto: 'Автоматически',
      dark: 'Темная',
      light: 'Светлая',
    },
    language: {
      title: 'Язык',
      ui_language: {
        title: 'Язык пользовательского интерфейса',
        select_language: 'Выберите язык',
      },
    },
    contents: {
      title: 'Содержимое',
      editor: {
        title: 'Редактор',
        use_draft_backup: {
          switch_label: 'Автоматически делать резервные копии черновиков записей',
        },
        close_on_save: {
          switch_label: 'Закрыть редактор после сохранения черновика',
        },
      },
      translator: {
        title: '{service} переводчик',
        field_label: '{service} API ключ аутентификации',
        description:
          'Для включения быстрого перевода текстовых полей ввода войдите в <a {homeHref}>{service} API</a> и введите <a {apiKeyHref}>ваш ключ аутентификации</a> здесь.',
      },
    },
    media: {
      title: 'Мультимедиа',
      stock_photos: {
        title: '{service} Бесплатные картинки',
        field_label: '{service} API ключ',
        description:
          'Для вставки бесплатных публичных изображений войдите в <a {homeHref}>{service} API</a> и введите <a {apiKeyHref}>ваш API ключ</a> здесь.',
        credit: 'Photos provided by {service}',
      },
    },
    accessibility: {
      title: 'Специальные возможности',
      underline_links: {
        title: 'Подчеркивание ссылок',
        description: 'Показывать подчеркивание для ссылок в предварительном просмотре записи и надписях пользовательского интерфейса.',
        switch_label: 'Всегда подчеркивать ссылки',
      },
    },
    advanced: {
      title: 'Расширенные',
      beta: {
        title: 'Тестовые функции',
        description: 'Включить  тестовы функции которые могут быть нестабильными или нелокализованными.',
        switch_label: 'Присоедиться к программе бета-тестирования',
      },
      developer_mode: {
        title: 'Режим разработчика',
        description:
          'Включить некоторые функции для разработчиков включая подробные журналы консоли и собственные контекстные меню.',
        switch_label: 'Включить режим разработчика',
      },
      deploy_hook: {
        title: 'Развернуть перехватчик',
        description:
          'Введите URL-адрес веб хука, который будет вызываться при запуске развертывания вручную выором пункта Опубликовать изменения. Это поле можно оставить пустым, если вы используете GitHub Actions',
        field_label: 'URL веб хука развертывания',
        url_saved: ' URL веб хука сохранен.',
        url_removed: 'URL веб хука удален.',
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts_: {
    view_content_library: 'Показать библиотеку контента',
    view_asset_library: 'Показать библиотеку ресурсов',
    search: 'Поиск записей и ресурсов',
    create_entry: 'Создать новую запись',
    save_entry: 'Сохранить запись',
    cancel_editing: 'Отменить редактирование записи',
  },

  // File types
  file_type_labels: {
    avif: 'AVIF изображение',
    bmp: 'Bitmap изображение',
    gif: 'GIF изображение',
    ico: 'Иконка',
    jpeg: 'JPEG изображение',
    jpg: 'JPEG изображение',
    png: 'PNG изображение',
    svg: 'SVG изображение',
    tif: 'TIFF изображение',
    tiff: 'TIFF изображение',
    webp: 'WebP изображение',
    avi: 'AVI видео',
    m4v: 'MP4 видео',
    mov: 'QuickTime видео',
    mp4: 'MP4 видео',
    mpeg: 'MPEG видео',
    mpg: 'MPEG видео',
    ogg: 'Ogg видео',
    ogv: 'Ogg видео',
    ts: 'MPEG видео',
    webm: 'WebM видео',
    '3gp': '3GPP видео',
    '3g2': '3GPP2 видео',
    aac: 'AAC аудио',
    mid: 'MIDI аудио',
    midi: 'MIDI аудио',
    m4a: 'MP4 аудио',
    mp3: 'MP3 аудио',
    oga: 'Ogg аудио',
    opus: 'OPUS аудио',
    wav: 'WAV аудио',
    weba: 'WebM аудио',
    csv: 'CSV таблица',
    doc: 'Word документ',
    docx: 'Word документ',
    odp: 'OpenDocument презентпция',
    ods: 'OpenDocument таблица',
    odt: 'OpenDocument текст',
    pdf: 'PDF документ',
    ppt: 'PowerPoint презентация',
    pptx: 'PowerPoint презентация',
    rtf: 'Rich text документ',
    xls: 'Excel таблица',
    xlsx: 'Excel таблица',
    html: 'HTML текст',
    js: 'JavaScript',
    json: 'JSON формат',
    md: 'Markdown формат',
    toml: 'TOML формат',
    yaml: 'YAML формат',
    yml: 'YAML формат',
  },

  // file size units
  file_size_units: {
    b: '{size} байт',
    kb: '{size} КБ',
    mb: '{size} МБ',
    gb: '{size} ГБ',
    tb: '{size} ТБ',
  },
};

