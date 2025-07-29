/**
 * IMPORTANT: These strings are not ready for localization. DO NOT TRANSLATE THIS FILE.
 * @see https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md
 */
export const strings = {
  // Pages & Navigation
  collections: 'コレクション',
  contents: 'コンテンツ',
  entries: 'エントリー',
  files: 'ファイル',
  assets: 'アセット',
  media: 'メディア',
  workflow: 'ワークフロー',
  editorial_workflow: '編集ワークフロー',
  menu: 'メニュー',

  // Account
  user_name: 'ユーザー名',
  password: 'パスワード',
  sign_in: 'ログイン',
  sign_in_with_mobile: 'モバイルでログイン',
  sign_in_with_mobile_instruction:
    '以下の QR コードを携帯電話かタブレットでスキャンすると、パスワードなしでログインできます。ユーザー設定は自動的にコピーされます。',
  signed_in_as_x: '{name} としてログイン中',
  working_with_local_repo: 'ローカルレポジトリで作業中',
  working_with_test_repo: 'テストレポジトリで作業中',
  sign_out: 'ログアウト',

  // Common terms
  create: '新規作成',
  select: '選択',
  select_all: 'すべて選択',
  upload: 'アップロード',
  copy: 'コピー',
  download: 'ダウンロード',
  duplicate: '複製',
  delete: '削除',
  save: '保存',
  saving: '保存中…',
  rename: '名前を変更',
  update: '更新',
  replace: '差し替え',
  add: '追加',
  remove: '削除',
  remove_x: '{name} を削除',
  clear: 'クリア',
  expand: '広げる',
  expand_all: 'すべて広げる',
  collapse: '折り畳む',
  collapse_all: 'すべて折り畳む',
  insert: '挿入',
  restore: '復元',
  discard: '破棄',
  searching: '検索中…',
  no_results: '結果が見つかりませんでした。',
  global: 'グローバル',
  primary: 'プライマリー',
  secondary: 'セカンダリー',
  collection: 'コレクション',
  folder: 'フォルダー',
  api_key: 'API キー',
  details: '詳細',
  back: '戻る',
  loading: '読み込み中…',
  later: '後で',

  // Common errors
  clipboard_error: 'データのコピー中に問題が発生しました。',

  // Entrance
  welcome_to_sveltia_cms: 'Sveltia CMS へようこそ',
  loading_site_config: 'サイト設定を読み込んでいます…',
  loading_site_data: 'サイトデータを読み込んでいます…',
  loading_site_data_error: 'サイトデータの読み込み中にエラーが発生しました。',
  sign_in_with_x: '{service} でログイン',
  use_regular_authentication_flow: '通常の認証フローを使用',
  use_personal_access_token: '個人用アクセストークンを使用',
  sign_in_using_pat_title: '個人用アクセストークンでログイン',
  sign_in_using_pat_description:
    '以下にトークンを入力してください。レポジトリコンテンツへの読み取り・書き込みアクセスが必要です。',
  personal_access_token: '個人用アクセストークン',
  authorizing: '認証中…',
  signing_in: 'ログイン中…',
  work_with_local_repo: 'ローカルレポジトリで作業',
  work_with_local_repo_description:
    'ボタンをクリックして「{repo}」レポジトリのルートディレクトリを選択してください。',
  work_with_local_repo_description_no_repo:
    'ボタンをクリックして Git レポジトリのルートディレクトリを選択してください。',
  work_with_test_repo: 'テストレポジトリで作業',
  sign_in_error: {
    not_project_root:
      '選択されたフォルダーはレポジトリのルートディレクトリではありません。再度お試しください。',
    picker_dismissed: 'レポジトリのルートディレクトリを選択できませんでした。再度お試しください。',
    authentication_aborted: '認証が中断されました。再度お試しください。',
    invalid_token: '入力されたトークンが無効です。確認して再度お試しください。',
    // Errors defined in Sveltia CMS Authenticator
    // https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
    UNSUPPORTED_BACKEND: 'この認証アプリはお使いの Git バックエンドに対応していません。',
    UNSUPPORTED_DOMAIN: 'この認証アプリではお使いのドメインの使用は許可されていません。',
    MISCONFIGURED_CLIENT: 'OAuth アプリのクライアント ID またはシークレットが設定されていません。',
    AUTH_CODE_REQUEST_FAILED: '認証コードを取得できませんでした。後で再度お試しください。',
    CSRF_DETECTED: 'CSRF 攻撃の可能性が検出されたため、認証フローは中断されました。',
    TOKEN_REQUEST_FAILED: 'アクセストークンを要求できませんでした。後で再度お試しください。',
    TOKEN_REFRESH_FAILED: 'アクセストークンの更新に失敗しました。後で再度お試しください。',
    MALFORMED_RESPONSE: 'サーバーから不正なデータが返されました。後で再度お試しください。',
  },
  backend_unsupported_version:
    '{name} バックエンドには {name} {version} 以降のバージョンが必要です。',
  repository_no_access: 'あなたには「{repo}」レポジトリへのアクセス権がありません。',
  repository_not_found: '「{repo}」レポジトリは存在しません。',
  repository_empty: '「{repo}」レポジトリにはブランチがありません。',
  branch_not_found: '「{repo}」レポジトリに「{branch}」ブランチは存在しません。',
  unexpected_error: '予期せぬエラー',

  // Parser errors
  entry_parse_error:
    'エントリーファイルの読み込み中にエラーが発生しました。詳しくはブラウザーのコンソールを確認してください。',
  entry_parse_errors:
    'エントリーファイルの読み込み中にエラーが発生しました。詳しくはブラウザーのコンソールを確認してください。',

  // Global toolbar
  visit_live_site: '管理対象サイトを開く',
  switch_page: 'ページを切り替え',
  search_placeholder_entries: 'エントリーを検索…',
  search_placeholder_assets: 'アセットを検索…',
  search_placeholder_all: 'エントリーとアセットを検索…',
  create_entry_or_assets: 'エントリーまたはアセットを作成',
  publish_changes: '変更を公開',
  publishing_changes: '変更を公開しています…',
  publishing_changes_failed: '変更を公開できませんでした。後で再度お試しください。',
  show_notifications: '通知を表示',
  notifications: '通知',
  show_account_menu: 'アカウントメニューを表示',
  account: 'アカウント',
  live_site: '管理対象サイト',
  git_repository: 'Git レポジトリ',
  settings: '設定',
  site_config: 'サイト設定',
  show_help_menu: 'ヘルプメニューを表示',
  help: 'ヘルプ',
  keyboard_shortcuts: 'キーボードショートカット',
  documentation: 'ドキュメンテーション',
  release_notes: 'リリースノート',
  version_x: 'バージョン {version}',
  report_issue: '問題を報告',
  share_feedback: 'フィードバックを共有',
  get_help: 'サポート',
  join_discord: 'Discord チャンネルに参加',

  // Onboarding
  mobile_promo_title: 'Sveltia CMS がモバイルに対応しました！',
  mobile_promo_button: '試してみる',

  // Update notification
  update_available: 'Sveltia CMS の最新版が利用可能です。',
  update_now: '今すぐ更新',

  // Backend status indicator
  backend_status: {
    minor_incident:
      '{service} で軽微な障害が発生しています。ワークフローに潜在的な影響が及ぶ可能性があります。',
    major_incident:
      '{service} で重大な障害が発生しています。状況が改善されるまで待った方が良いかもしれません。',
  },

  // Library
  content_library: 'コンテンツライブラリ',
  asset_library: 'アセットライブラリ',
  asset_location: {
    repository: 'あなたのサイト',
    external: '外部の場所',
    stock_photos: 'ストックフォト',
  },
  collection_assets: 'コレクションアセット',
  entry_list: 'エントリーリスト',
  file_list: 'ファイルリスト',
  asset_list: 'アセットリスト',
  x_collection: '「{collection}」コレクション',
  x_asset_folder: '「{folder}」アセットフォルダー',
  viewing_collection_list: 'コレクションリストを表示しています。',
  viewing_asset_folder_list: 'アセットフォルダーリストを表示しています。',
  viewing_x_collection_many_entries:
    '「{collection}」コレクションを表示しています。ここには {count} 個のエントリーがあります。',
  viewing_x_collection_one_entry:
    '「{collection}」コレクションを表示しています。ここにはひとつのエントリーがあります。',
  viewing_x_collection_no_entries:
    '「{collection}」コレクションを表示しています。ここにはまだエントリーがありません。',
  viewing_x_asset_folder_many_assets:
    '「{folder}」アセットフォルダーを表示しています。ここには {count} 個のアセットがあります。',
  viewing_x_asset_folder_one_asset:
    '「{folder}」アセットフォルダーを表示しています。ここにはひとつのアセットがあります。',
  viewing_x_asset_folder_no_assets:
    '「{folder}」アセットフォルダーを表示しています。ここにはまだアセットがありません。',
  singleton_selected_announcement: '「{file}」ファイルを編集するには Enter キーを押してください。',
  collection_not_found: 'コレクションが見つかりませんでした',
  file_not_found: 'ファイルが見つかりませんでした',
  x_of_x_selected: '{total} 個のうち {selected} 個を選択中',
  switch_view: 'ビューを切り替え',
  list_view: 'リストビュー',
  grid_view: 'グリッドビュー',
  switch_to_list_view: 'リストビューに切り替え',
  switch_to_grid_view: 'グリッドビューに切り替え',
  sort: '並び替え',
  sorting_options: '並べ替えオプション',
  sort_keys: {
    none: 'なし',
    name: '名前',
    slug: 'スラッグ',
    commit_author: '更新者',
    commit_date: '更新日時',
  },
  ascending: '{label} (A–Z)',
  ascending_date: '{label} (古い順)',
  descending: '{label} (Z–A)',
  descending_date: '{label} (新しい順)',
  filter: '絞り込み',
  filtering_options: '絞り込みオプション',
  group: 'グループ化', // Verb
  grouping_options: 'グループ化オプション',
  type: '種類',
  all: 'すべて',
  image: '画像',
  video: '動画',
  audio: '音声',
  document: '書類',
  other: 'その他',
  show_assets: 'アセットを表示',
  hide_assets: 'アセットを隠す',
  show_info: '情報を表示',
  hide_info: '情報を隠す',
  all_assets: 'すべてのアセット',
  global_assets: 'グローバルアセット',
  creating_entries_disabled_by_admin:
    'このコレクションへの新しいエントリーの作成は、管理者によって無効化されています。',
  creating_entries_disabled_by_limit:
    'このコレクションは最大の {limit} エントリーに達したため、新しいエントリーを作成することはできません。',
  back_to_collection: 'コレクションへ戻る',
  collection_list: 'コレクションリスト',
  back_to_collection_list: 'コレクションリストへ戻る',
  asset_folder_list: 'アセットフォルダーリスト',
  back_to_asset_folder_list: 'アセットフォルダーリストへ戻る',
  search_results: '検索結果',
  search_results_for_x: '「{terms}」の検索結果',
  viewing_entry_search_results:
    '「{terms}」の検索結果を表示しています。{entries} が見つかりました。',
  viewing_asset_search_results:
    '「{terms}」の検索結果を表示しています。{assets} が見つかりました。',
  many_entries: '{count} 個のエントリー',
  one_entry: '1 個のエントリー',
  no_entries: '0 個のエントリー',
  many_assets: '{count} 個のアセット',
  one_asset: '1 個のアセット',
  no_assets: '0 個のアセット',
  no_files_found: 'ファイルは見つかりませんでした。',
  no_entries_found: 'エントリーは見つかりませんでした。',
  upload_assets: '新しいアセットをアップロード',
  edit_options: '編集オプション',
  show_edit_options: '編集オプションを表示',
  edit_asset: 'アセットを編集',
  edit_x: '{name} を編集',
  wrap_long_lines: '長い行を折り返す',
  rename_asset: 'アセットの名前を変更',
  rename_x: '{name} の名前を変更',
  enter_new_name_for_asset: '新しい名前を以下に入力してください。',
  enter_new_name_for_asset_with_one_entry:
    '新しい名前を以下に入力してください。このアセットを使用している 1 個のエントリーも更新されます。',
  enter_new_name_for_asset_with_many_entries:
    '新しい名前を以下に入力してください。このアセットを使用している {count} 個のエントリーも更新されます。',
  enter_new_name_for_asset_error: {
    empty: 'ファイル名を空白にすることはできません。',
    character: 'ファイル名に特別な文字を含めることはできません。',
    duplicate: 'このファイル名は他のアセットに使われています。',
  },
  replace_asset: 'アセットを差し替え',
  replace_x: '{name} を差し替え',
  tap_to_browse: 'タップして参照…',
  drop_file_or_click_to_browse: 'ここにファイルをドロップするかクリックして参照…',
  drop_files_or_click_to_browse: 'ここにファイルをドロップするかクリックして参照…',
  drop_image_file_or_click_to_browse: 'ここに画像ファイルをドロップするかクリックして参照…',
  drop_image_files_or_click_to_browse: 'ここに画像ファイルをドロップするかクリックして参照…',
  drop_file_here: 'ここにファイルをドロップ',
  drop_files_here: 'ここにファイルをドロップ',
  unsupported_file_type: '非対応ファイル形式',
  dropped_file_type_mismatch:
    'ドロップされたファイルは {type} 形式ではありません。再度お試しください。',
  dropped_image_type_mismatch:
    'ドロップされたファイルはサポートされていません。AVIF、GIF、JPEG、PNG、WebP または SVG 形式の画像のみが受け入れられます。再度お試しください。',
  choose_file: 'ファイルを選択',
  choose_files: 'ファイルを選択',
  delete_asset: 'アセットを削除',
  delete_assets: 'アセットを削除',
  delete_selected_asset: '選択されたアセットを削除',
  delete_selected_assets: '選択されたアセットを削除',
  confirm_deleting_this_asset: 'このアセットを削除してもよろしいですか？',
  confirm_deleting_selected_asset: '選択されたファイルを削除してもよろしいですか？',
  confirm_deleting_selected_assets: '選択された {count} 個のファイルを削除してもよろしいですか？',
  confirm_deleting_all_assets: 'すべてのアセットを削除してもよろしいですか？',
  delete_entry: 'エントリーを削除',
  delete_entries: 'エントリーを削除',
  delete_selected_entry: '選択されたエントリーを削除',
  delete_selected_entries: '選択されたエントリーを削除',
  confirm_deleting_this_entry: 'このエントリーを削除してもよろしいですか？',
  confirm_deleting_this_entry_with_assets:
    'このエントリーと関連アセットを削除してもよろしいですか？',
  confirm_deleting_selected_entry: '選択されたエントリーを削除してもよろしいですか？',
  confirm_deleting_selected_entry_with_assets:
    '選択されたエントリーと関連アセットを削除してもよろしいですか？',
  confirm_deleting_selected_entries:
    '選択された {count} 個のエントリーを削除してもよろしいですか？',
  confirm_deleting_selected_entries_with_assets:
    '選択された {count} 個のエントリーと関連アセットを削除してもよろしいですか？',
  confirm_deleting_all_entries: 'すべてのエントリーを削除してもよろしいですか？',
  confirm_deleting_all_entries_with_assets:
    'すべてのエントリーと関連アセットを削除してもよろしいですか？',
  processing_file: 'ファイルを処理しています。これには時間がかかる場合があります。',
  processing_files: 'ファイルを処理しています。これには時間がかかる場合があります。',
  uploading_files: 'アップロード対象ファイル',
  confirm_replacing_file: '「{name}」を以下のファイルと差し替えてもよろしいですか？',
  confirm_uploading_file: '以下のファイルを「{folder}」フォルダーに保存してもよろしいですか？',
  confirm_uploading_files:
    '以下の {count} 個のファイルを「{folder}」フォルダーに保存してもよろしいですか？',
  oversized_files: 'サイズ超過ファイル',
  warning_oversized_file:
    'このファイルは最大サイズ {size} を超えているため、アップロードできません。サイズを縮小するか、他のファイルを選んでください。',
  warning_oversized_files:
    'これらのファイルは最大サイズ {size} を超えているため、アップロードできません。サイズを縮小するか、他のファイルを選んでください',
  file_meta: '{type} · {size}',
  file_meta_converted_from_x: '({type} から変換)',
  no_entries_created: 'このコレクションにはまだエントリーがありません。',
  create_new_entry: '新しいエントリーを作成',
  entry: 'エントリー',
  index_file: 'インデックスファイル',
  no_files_in_collection: 'このコレクションにはファイルがありません。',
  asset_info: 'アセット情報',
  select_asset_show_info: 'アセットを選択すると情報が表示されます。',
  duplicate_entry: 'エントリーを複製',
  entry_duplicated: 'エントリーが複製され、新しい下書きとなりました。',
  entry_validation_error:
    'ひとつのフィールドにエラーがあります。エントリーを保存するには問題を修正してください。',
  entry_validation_errors:
    '{count} 個のフィールドにエラーがあります。エントリーを保存するには問題を修正してください。',
  entry_saved: 'エントリーが保存されました。',
  entry_saved_and_published: 'エントリーが保存、公開されました。',
  entry_deleted: 'エントリーが削除されました。',
  entries_deleted: '{count} 個のエントリーが削除されました。',
  asset_saved: 'アセットが保存されました。',
  asset_saved_and_published: 'アセットが保存、公開されました。',
  assets_saved: '{count} 個のアセットが保存されました。',
  assets_saved_and_published: '{count} 個のアセットが保存、公開されました。',
  asset_url_copied: 'アセット URL がクリップボードにコピーされました。',
  asset_urls_copied: 'アセット URL がクリップボードにコピーされました。',
  asset_path_copied: 'アセットファイルパスがクリップボードにコピーされました。',
  asset_paths_copied: 'アセットファイルパスがクリップボードにコピーされました。',
  asset_data_copied: 'アセットファイルがクリップボードにコピーされました。',
  asset_downloaded: 'アセットファイルがダウンロードされました。',
  assets_downloaded: 'アセットファイルがダウンロードされました。',
  asset_moved: 'アセットが移動されました。',
  assets_moved: '{count} 個のアセットが移動されました。',
  asset_renamed: 'アセットの名前が変更されました。',
  assets_renamed: '{count} 個のアセットの名前が変更されました。',
  asset_deleted: 'アセットが削除されました。',
  assets_deleted: '{count} 個のアセットが削除されました。',

  // Content editor
  content_editor: 'コンテンツエディター',
  restore_backup_title: '下書きを復元',
  restore_backup_description:
    'このエントリーには {datetime} に保存されたバックアップがあります。その編集済みの下書きを復元しますか？',
  draft_backup_saved: '下書きのバックアップが保存されました。',
  draft_backup_restored: '下書きのバックアップが復元されました。',
  draft_backup_deleted: '下書きのバックアップが削除されました。',
  cancel_editing: '編集をキャンセル',
  create_entry_title: '{name} を作成',
  create_entry_announcement: '「{collection}」コレクションの新しいエントリーを作成しています。',
  edit_entry_title: '{collection} › {entry}',
  edit_entry_announcement: '「{collection}」コレクションの「{entry}」エントリーを編集しています。',
  edit_file_announcement: '「{collection}」コレクションの「{file}」ファイルを編集しています。',
  edit_singleton_announcement: '「{file}」ファイルを編集しています。',
  save_and_publish: '保存して公開',
  save_without_publishing: '公開せずに保存',
  show_editor_options: 'エディターオプションを表示',
  editor_options: 'エディターオプション',
  show_preview: 'プレビューを表示',
  sync_scrolling: 'スクロールを同期',
  switch_locale: 'ロケールを切り替え',
  locale_content_disabled_short: '(無効)',
  locale_content_error_short: '(エラー)',
  edit: '編集',
  preview: 'プレビュー',
  edit_x_locale: '{locale} コンテンツを編集',
  preview_x_locale: '{locale} コンテンツをプレビュー',
  content_preview: 'コンテンツプレビュー',
  show_content_options_x_locale: '{locale} コンテンツのオプションを表示',
  content_options_x_locale: '{locale} コンテンツのオプション',
  x_field: '「{field}」フィールド',
  show_field_options: 'フィールドオプションを表示',
  field_options: 'フィールドオプション',
  unsupported_widget_x: '非対応ウィジェット: {name}',
  enable_x_locale: '{locale} を有効化',
  reenable_x_locale: '{locale} を再度有効化',
  disable_x_locale: '{locale} を無効化',
  locale_x_has_been_disabled: '{locale} コンテンツは無効化されています。',
  locale_x_now_disabled:
    '{locale} コンテンツは無効化されました。エントリーを保存する際に削除されます。',
  view_in_repository: 'レポジトリ内で見る',
  view_on_x: '{service} で見る',
  view_on_live_site: '管理対象サイトで見る',
  copy_from: '他の言語からコピー…',
  copy_from_x: '{locale} からコピー',
  translation_options: '翻訳オプション',
  translate: '翻訳',
  translate_field: 'フィールドを翻訳',
  translate_fields: 'フィールドを翻訳',
  translate_from: '他の言語から翻訳…',
  translate_from_x: '{locale} から翻訳',
  revert_changes: '変更を取り消す',
  revert_all_changes: 'すべての変更を取り消す',
  edit_slug: 'スラッグを編集',
  edit_slug_warning:
    'スラッグを変更すると、エントリーへの内部・外部リンクが壊れる可能性があります。現在のところ、Sveltia CMS は Relation ウィジェットで作成された参照を更新しないため、そのような参照は他のリンクとともに手動で更新する必要があります。',
  edit_slug_error: {
    empty: 'スラッグは空白にはできません。',
    duplicate: 'このスラッグは他のエントリーに使われています。',
  },
  required: '必須',
  editor: {
    translation: {
      none: '翻訳されたフィールドはありません。',
      started: '翻訳中…',
      error: '翻訳中に問題が発生しました。',
      complete: {
        one: '{source} からフィールドを翻訳しました。',
        many: '{source} から {count} 個のフィールドを翻訳しました。',
      },
    },
    copy: {
      none: 'コピーされたフィールドはありません。',
      complete: {
        one: '{source} からフィールドをコピーしました。',
        many: '{source} から {count} 個のフィールドをコピーしました。',
      },
    },
  },
  validation: {
    value_missing: 'この項目は必須です。',
    range_underflow: {
      select_many: '少なくとも {min} 個の項目を選択してください。',
      select_one: '少なくとも {min} 個の項目を選択してください。',
      add_many: '少なくとも {min} 個の項目を追加してください。',
      add_one: '少なくとも {min} 個の項目を追加してください。',
    },
    range_overflow: {
      select_many: '選択できるのは最大で {max} 項目です。',
      select_one: '選択できるのは最大で {max} 項目です。',
      add_many: '追加できるのは最大で {max} 項目です。',
      add_one: '追加できるのは最大で {max} 項目です。',
    },
    too_short: {
      one: '少なくとも {min} 文字は入力してください。',
      many: '少なくとも {min} 文字は入力してください。',
    },
    too_long: {
      one: '{max} 文字を超える入力はできません。',
      many: '{max} 文字を超える入力はできません。',
    },
    type_mismatch: {
      email: '正しいメールアドレスを入力してください。',
      url: '正しい URL を入力してください。',
    },
  },
  saving_entry: {
    error: {
      title: 'エラー',
      description: 'エントリーを保存中に問題が発生しました。後で再度お試しください。',
    },
  },
  find_place: '場所を検索',
  use_your_location: '現在地を使用',
  geolocation_error_title: '位置情報エラー',
  geolocation_error_body: 'あなたの現在地を取得できませんでした。',
  geolocation_unsupported: 'お使いのブラウザーは位置情報 API をサポートしていません。',

  // Media details
  viewing_x_asset_details: '「{name}」アセットの詳細を表示しています。',
  asset_editor: 'アセットエディター',
  preview_unavailable: 'プレビューは表示できません',
  public_url: '公開 URL',
  public_urls: '公開 URL',
  file_path: 'ファイルパス',
  file_paths: 'ファイルパス',
  file_data: 'ファイルデータ',
  kind: '種類',
  size: 'サイズ',
  dimensions: '大きさ',
  duration: '再生時間',
  used_in: '使われているエントリー',
  created_date: '作成日時',
  location: '場所',
  map_lat_lng: '緯度 {latitude}、経度 {longitude} の地図',

  // Widgets
  select_file: 'ファイルを選択',
  select_image: '画像を選択',
  replace_file: 'ファイルを差し替え',
  replace_image: '画像を差し替え',
  remove_file: 'ファイルを削除',
  remove_image: '画像を削除',
  remove_this_item: 'このアイテムを削除',
  move_up: '上へ移動',
  move_down: '下へ移動',
  add_x: '{name} を追加',
  add_item_above: '上にアイテムを追加',
  add_item_below: '下にアイテムを追加',
  select_list_type: 'リストタイプを選択',
  opacity: '透明度',
  unselected_option: '(なし)',
  assets_dialog: {
    title: {
      file: 'ファイルを選択',
      image: '画像を選択',
    },
    search_for_file: 'ファイルを検索',
    search_for_image: '画像を検索',
    locations: '場所',
    folder: {
      field: 'フィールドアセット',
      entry: 'エントリーアセット',
      file: 'ファイルアセット',
      collection: 'コレクションアセット',
      global: 'グローバルアセット',
    },
    error: {
      invalid_key: 'あなたの API キーは正しくないか期限切れです。確認の上、再度お試しください。',
      search_fetch_failed: 'アセットを検索中に問題が発生しました。後で再度お試しください。',
      image_fetch_failed:
        '選択されたアセットをダウンロード中に問題が発生しました。後で再度お試しください。',
    },
    available_images: '利用可能な画像',
    enter_url: 'URL を入力',
    enter_file_url: 'ファイルの URL を入力:',
    enter_image_url: '画像の URL を入力:',
    large_file: {
      title: '大きなファイル',
    },
    photo_credit: {
      title: '写真クレジット',
      description: '可能であれば以下のクレジットを使ってください:',
    },
    unsaved: '未保存',
  },
  character_counter: {
    min_max: {
      one: '{count} 文字入力されています。最小: {min}。最大 {max}。',
      many: '{count} 文字入力されています。最小: {min}。最大 {max}。',
    },
    min: {
      one: '{count} 文字入力されています。最小: {min}。',
      many: '{count} 文字入力されています。最小: {min}。',
    },
    max: {
      one: '{count} 文字入力されています。最大: {max}。',
      many: '{count} 文字入力されています。最大: {max}。',
    },
  },
  youtube_video_player: 'YouTube 動画プレーヤー',
  today: '今日',
  now: '現在時刻',
  editor_components: {
    image: '画像',
    src: 'ソース',
    alt: '代替テキスト',
    title: 'タイトル',
    link: 'リンク',
  },
  key_value: {
    key: 'キー',
    value: '値',
    action: 'アクション',
    empty_key: 'キーは必須です。',
    duplicate_key: 'キーが重複しています。',
  },

  // Content preview
  boolean: {
    true: 'はい',
    false: 'いいえ',
  },

  // Integrations
  cloud_storage: {
    invalid: 'このサービスは正しく設定されていません。',
    auth: {
      initial: '{service} へログインすると、ストレージ上のメディアをエントリー項目へ挿入できます。',
      requested: 'ログイン中…',
      error: 'ユーザー名またはパスワードが間違っています。確認の上、再度お試しください。',
    },
  },

  // Configuration
  config: {
    error: {
      no_secure_context: 'Sveltia CMS は HTTPS またはローカルホスト URL でのみ動作します。',
      fetch_failed: '設定ファイルを読み込めませんでした。',
      fetch_failed_not_ok: 'HTTP レスポンスがステータス {status} で返されました。',
      parse_failed: '設定ファイルを解析できませんでした。',
      parse_failed_invalid_object: '設定ファイルが有効な JavaScript オブジェクトではありません。',
      parse_failed_unsupported_type:
        '設定ファイルが有効なファイル形式ではありません。サポートされているのは YAML と JSON のみです。',
      no_collection: '設定ファイル内でコレクションが定義されていません。',
      missing_backend: '設定ファイル内でバックエンドが定義されていません。',
      missing_backend_name: '設定ファイル内でバックエンド名が定義されていません。',
      unsupported_backend: '設定されている「{name}」バックエンドは非対応です。',
      missing_repository: '設定ファイル内でレポジトリが定義されていません。',
      invalid_repository:
        '設定されているレポジトリが正しくありません。この設定は「owner/repo」形式でなければなりません。',
      oauth_implicit_flow: '設定されている認証方式 (暗黙的フロー) は非対応です。',
      oauth_no_app_id: '設定ファイル内で OAuth アプリケーション ID が定義されていません。',
      missing_media_folder: '設定ファイル内でメディアフォルダーが定義されていません。',
      invalid_media_folder:
        '設定されているメディアフォルダーが正しくありません。この設定は文字列でなければなりません。',
      invalid_public_folder:
        '設定されているパブリックフォルダーが正しくありません。この設定は文字列でなければなりません。',
      public_folder_relative_path:
        '設定されているパブリックフォルダーが正しくありません。この設定は「/」で始まる絶対パスでなければなりません。',
      public_folder_absolute_url: 'パブリックフォルダーオプションの絶対 URL は非対応です。',
      unexpected: '設定ファイルを検証中に予期せぬ問題が発生しました。',
      try_again: '問題を解決してから再度お試しください。',
    },
  },

  // Backends
  local_backend: {
    unsupported_browser:
      'お使いのブラウザーはローカル開発に対応していません。代わりに Chrome か Edge を使ってください。',
    disabled:
      'お使いのブラウザーではローカル開発が無効化されています。<a>有効化する方法はこちら</a>。',
  },

  // Editorial Workflow
  status: {
    drafts: '下書き',
    in_review: 'レビュー中',
    ready: '公開可',
  },

  // Settings
  categories: 'カテゴリ',
  prefs: {
    changes: {
      api_key_saved: 'API キーが保存されました。',
      api_key_removed: 'API キーが削除されました。',
    },
    error: {
      permission_denied:
        'ブラウザーストレージ (Cookie) アクセスが拒否されました。許可設定を確認の上、再度お試しください。',
    },
    appearance: {
      title: 'アピアランス',
      theme: 'テーマ',
      select_theme: 'テーマを選択',
    },
    theme: {
      auto: '自動',
      dark: 'ダーク',
      light: 'ライト',
    },
    language: {
      title: '言語',
      ui_language: {
        title: 'ユーザーインターフェース言語',
        select_language: '言語を選択',
      },
    },
    contents: {
      title: 'コンテンツ',
      editor: {
        title: 'エディター',
        use_draft_backup: {
          switch_label: 'エントリーの下書きを自動的にバックアップする',
        },
        close_on_save: {
          switch_label: '下書き保存後にエディターを閉じる',
        },
        close_with_escape: {
          switch_label: 'Escape キーでエディターを閉じる',
        },
      },
      translator: {
        field_label: '{service} API キー',
        description:
          '<a {homeHref}>{service} API</a> にユーザー登録して、<a {apiKeyHref}>発行されたキー</a> をここに入力すると、テキストエントリー項目の素早い翻訳が可能となります。',
      },
    },
    media: {
      title: 'メディア',
      stock_photos: {
        title: '{service} 無料画像素材',
        field_label: '{service} API キー',
        description:
          '<a {homeHref}>{service} API</a> にユーザー登録して、<a {apiKeyHref}>発行された API キー</a> をここに入力すると、画像エントリー項目に無料のストックフォトを挿入できます。',
        credit: '写真提供: {service}',
        providers_disabled: 'ストックアセットプロバイダーは管理者によって無効化されています。',
      },
    },
    accessibility: {
      title: 'アクセシビリティ',
      underline_links: {
        title: 'リンクに下線を付ける',
        description:
          'エントリープレビューやユーザーインターフェイスラベル内のリンクに下線を表示します。',
        switch_label: '常に下線を付ける',
      },
    },
    advanced: {
      title: '詳細',
      beta: {
        title: 'ベータ機能',
        description:
          '不安定あるいは未ローカライズの可能性がある、いくつかのベータ機能を有効化します。',
        switch_label: 'ベータプログラムに参加する',
      },
      developer_mode: {
        title: '開発者モード',
        description:
          '詳細なコンソールログやネイティブコンテキストメニューなど、いくつかの開発者向け機能を有効化します。',
        switch_label: '開発者モードを有効にする',
      },
      deploy_hook: {
        title: 'デプロイフック',
        description:
          '「変更を公開」を選択して手動でデプロイを実行する際に呼び出すウェブフック URL を入力してください。GitHub Actions を使用する場合は空欄のままで構いません。',
        field_label: 'デプロイフック URL',
        url_saved: 'ウェブフック URL が保存されました。',
        url_removed: 'ウェブフック URL が削除されました。',
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts_: {
    view_content_library: 'コンテンツライブラリを表示',
    view_asset_library: 'アセットライブラリを表示',
    search: 'エントリーとアセットを検索',
    create_entry: '新しいエントリーを作成',
    save_entry: 'エントリーを保存',
    cancel_editing: 'エントリーの編集をキャンセル',
  },

  // File types
  file_type_labels: {
    avif: 'AVIF 画像',
    bmp: 'Bitmap 画像',
    gif: 'GIF 画像',
    ico: 'アイコン',
    jpeg: 'JPEG 画像',
    jpg: 'JPEG 画像',
    png: 'PNG 画像',
    svg: 'SVG 画像',
    tif: 'TIFF 画像',
    tiff: 'TIFF 画像',
    webp: 'WebP 画像',
    avi: 'AVI 動画',
    m4v: 'MP4 動画',
    mov: 'QuickTime 動画',
    mp4: 'MP4 動画',
    mpeg: 'MPEG 動画',
    mpg: 'MPEG 動画',
    ogg: 'Ogg 動画',
    ogv: 'Ogg 動画',
    ts: 'MPEG 動画',
    webm: 'WebM 動画',
    '3gp': '3GPP 動画',
    '3g2': '3GPP2 動画',
    aac: 'AAC 音声',
    mid: 'MIDI',
    midi: 'MIDI',
    m4a: 'MP4 音声',
    mp3: 'MP3 音声',
    oga: 'Ogg 音声',
    opus: 'OPUS 音声',
    wav: 'WAV 音声',
    weba: 'WebM 音声',
    csv: 'CSV スプレッドシート',
    doc: 'Word ドキュメント',
    docx: 'Word ドキュメント',
    odp: 'OpenDocument プレゼンテーション',
    ods: 'OpenDocument スプレッドシート',
    odt: 'OpenDocument テキスト',
    pdf: 'PDF ドキュメント',
    ppt: 'PowerPoint プレゼンテーション',
    pptx: 'PowerPoint プレゼンテーション',
    rtf: 'リッチテキストドキュメント',
    xls: 'Excel スプレッドシート',
    xlsx: 'Excel スプレッドシート',
    html: 'HTML テキスト',
    js: 'JavaScript',
    json: 'JSON テキスト',
    md: 'Markdown テキスト',
    toml: 'TOML テキスト',
    yaml: 'YAML テキスト',
    yml: 'YAML テキスト',
  },

  // file size units
  file_size_units: {
    b: '{size} バイト',
    kb: '{size} KB',
    mb: '{size} MB',
    gb: '{size} GB',
    tb: '{size} TB',
  },
};
