export const strings = {
  // Pages & Navigation
  collections: 'コレクション',
  contents: 'コンテンツ',
  entries: 'エントリー',
  assets: 'アセット',
  media: 'メディア',
  workflow: 'ワークフロー',
  editorial_workflow: '編集ワークフロー',
  notifications: '通知',
  site_config: 'サイト設定',
  settings: '設定',
  account: 'アカウント',
  live_site: '管理対象サイト',
  git_repository: 'Git レポジトリ',
  help: {
    keyboard_shortcuts: 'キーボードショートカット',
    documentation: 'ドキュメンテーション',
    release_notes: 'リリースノート',
    issue: '問題を報告',
    feedback: 'フィードバックを共有',
  },

  // Account
  user_name: 'ユーザー名',
  password: 'パスワード',
  sign_in: 'ログイン',
  sign_in_with_x: '{name} でログイン',
  signed_in_as_x: '{name} としてログイン中',
  work_with_local_repo: 'ローカルレポジトリで作業',
  working_with_local_repo: 'ローカルレポジトリで作業中',
  sign_out: 'ログアウト',

  // Common actions
  create: '新規作成',
  select: '選択',
  select_all: 'すべて選択',
  clear_selection: '選択を解除',
  upload: 'アップロード',
  upload_and_publish: 'アップロードして公開',
  copy: 'コピー',
  download: 'ダウンロード',
  delete: '削除',
  duplicate: '複製',
  save: '保存',
  publish: '公開',
  saving: '保存中…',
  ok: 'OK',
  cancel: 'キャンセル',
  replace: '置き換え',
  remove: '削除',
  clear: 'クリア',
  expand: '広げる',
  collapse: '折り畳む',
  close: '閉じる',
  insert: '挿入',
  show_menu: 'メニューを開く',
  hide_menu: 'メニューを閉じる',
  move_to: 'フォルダへ移動…',
  search: '検索',
  searching: '検索中…',
  error: 'エラー',

  // Entrance
  loading_site_config: 'サイト設定を読み込んでいます…',
  loading_site_data: 'サイトデータを読み込んでいます…',
  loading_site_data_error: 'サイトデータの読み込み中にエラーが発生しました。',
  unexpected_error: '予期せぬエラー',

  // Global toolbar
  search_placeholder: 'エントリーとアセットを検索…',
  asset: 'アセット',

  // Library
  collection_not_found: 'コレクションが見つかりませんでした',
  actions: 'アクション',
  switch_view: 'ビューを切り替え',
  list_view: 'リストビュー',
  grid_view: 'グリッドビュー',
  sort_by: '並び替え',
  sort_field: '並べ替え項目',
  sort_keys: {
    none: 'なし',
    name: '名前',
    commit_author: '更新者',
    commit_date: '更新日時',
  },
  sort_order: '並べ替え順',
  ascending: '{label} (A–Z)',
  ascending_date: '{label} (古い順)',
  descending: '{label} (Z–A)',
  descending_date: '{label} (新しい順)',
  filter_by: '絞り込み',
  group_by: 'グループ化',
  file_type: 'ファイル形式',
  all: 'すべて',
  image: '画像',
  video: '動画',
  audio: '音声',
  document: '書類',
  other: 'その他',
  show_assets: 'アセットを表示',
  show_info: '情報を表示',
  default: 'デフォルト',
  all_assets: 'すべてのアセット',
  collection_files: 'コレクションファイル',
  uncategorized: '未分類',
  x_collection_media_folder: '{collection} コレクションメディアフォルダー',
  search_results_for_x: '「{terms}」の検索結果',
  no_files_found: 'ファイルは見つかりませんでした。',
  no_entries_found: 'エントリーは見つかりませんでした。',
  drop_files_or_browse: 'ここにファイルをドロップするか下のボタンをクリックして参照:',
  drop_files_here: 'ここにファイルをドロップ',
  delete_file: 'ファイルを削除',
  delete_files: 'ファイルを削除',
  confirm_deleting_selected_file: '選択されたファイルを削除してもよろしいですか？',
  confirm_deleting_selected_files: '選択された {number} 個のファイルを削除してもよろしいですか？',
  confirm_deleting_all_files: 'すべてのファイルを削除してもよろしいですか？',
  delete_entry: 'エントリーを削除',
  delete_entries: 'エントリーを削除',
  confirm_deleting_this_entry: 'このエントリーを削除してもよろしいですか？',
  confirm_deleting_selected_entry: '選択されたエントリーを削除してもよろしいですか？',
  confirm_deleting_selected_entries:
    '選択された {number} 個のエントリーを削除してもよろしいですか？',
  confirm_deleting_all_entries: 'すべてのエントリーを削除してもよろしいですか？',
  upload_files: 'ファイルをアップロード',
  uploading_files: 'ファイルをアップロードしています',
  confirm_uploading_file: '以下のファイルを {folder} フォルダーに保存してもよろしいですか？',
  confirm_uploading_files:
    '以下の {number} 個のファイルを {folder} フォルダーに保存してもよろしいですか？',
  no_entries_created: 'このコレクションにはまだエントリーがありません。',
  create_new_entry: '新しいエントリーを作成',
  no_files_created: 'このコレクションにはファイルがありません。',
  multi_files_selected: '複数のファイルが選択されています。',
  select_asset_show_info: 'ファイルを選択すると情報が表示されます。',
  entry_duplicated: 'エントリーが複製され、新しい下書きとなりました。',
  entry_validation_error:
    'ひとつのフィールドにエラーがあります。エントリーを保存するには問題を修正してください。',
  entry_validation_errors:
    '{count} 個のフィールドにエラーがあります。エントリーを保存するには問題を修正してください。',
  entry_saved: 'エントリーが保存されました。',
  entry_deleted: 'エントリーが削除されました。',
  entries_deleted: '{count} 個のエントリーが削除されました。',
  asset_saved: 'アセットが保存されました。',
  asset_deleted: 'アセットが削除されました。',
  assets_deleted: '{count} 個のアセットが削除されました。',

  // Content editor
  creating_x: '{name} を作成',
  editing_x: '{name} を編集',
  show_preview: 'プレビューを表示',
  sync_scrolling: 'スクロールを同期',
  edit: '編集',
  preview: 'プレビュー',
  unsupported_widget_x: '非対応ウィジェット: {name}',
  enable_x_locale: '{locale} を有効化',
  reenable_x_locale: '{locale} を再度有効化',
  disable_x_locale: '{locale} を無効化',
  locale_x_has_been_disabled: '{locale} コンテンツは無効化されています。',
  locale_x_now_disabled:
    '{locale} コンテンツは無効化されました。エントリーを保存する際に削除されます。',
  copy_from: '他の言語からコピー…',
  copy_from_x: '{locale} からコピー',
  translate_from: '他の言語から翻訳…',
  translate_from_x: '{locale} から翻訳',
  revert_changes: '変更を取り消す',
  revert_all_changes: 'すべての変更を取り消す',
  required: '必須',
  validation: {
    value_missing: 'この項目は必須です。',
    range_underflow: {
      select_singular: '少なくとも {min} 個の項目を選択してください。',
      select_plural: '少なくとも {min} 個の項目を選択してください。',
      add_singular: '少なくとも {min} 個の項目を追加してください。',
      add_plural: '少なくとも {min} 個の項目を追加してください。',
    },
    range_overflow: {
      select_singular: '選択できるのは最大で {max} 項目です。',
      select_plural: '選択できるのは最大で {max} 項目です。',
      add_singular: '追加できるのは最大で {max} 項目です。',
      add_plural: '追加できるのは最大で {max} 項目です。',
    },
  },
  saving_entry: {
    error: {
      title: 'エラー',
      description: 'エントリーを保存中に問題が発生しました。後で再度お試しください。',
    },
  },

  // Media details
  no_preview_available: 'プレビューは表示できません',
  public_url: '公開 URL',
  file_path: 'ファイルパス',
  kind: '種類',
  size: 'サイズ',
  dimensions: '大きさ',
  duration: '再生時間',
  used_in: '使われているエントリー',

  // Widgets
  move_up: '上へ移動',
  move_down: '下へ移動',
  today: '今日',
  current_time: '現在時刻',
  add_x: '{name} を追加',
  drag_to_sort_items: 'ドラッグしてアイテムを並び替え',
  assets_dialog: {
    title: {
      file: 'ファイルを選択',
      image: '画像を選択',
    },
    location: {
      this_repository: 'このレポジトリ',
      external_locations: '外部の場所',
      stock_photos: 'ストックフォト',
    },
    error: {
      invalid_key: 'あなたの API キーは正しくないか期限切れです。確認の上、再度お試しください。',
      search_fetch_failed: 'アセットを検索中に問題が発生しました。後で再度お試しください。',
      image_fetch_failed:
        '選択されたアセットをダウンロード中に問題が発生しました。後で再度お試しください。',
    },
    enter_url: 'URL を入力',
    enter_file_url: 'ファイルの URL を入力:',
    enter_image_url: '画像の URL を入力:',
    large_file: {
      title: '大きなファイル',
      description: 'このファイルは最大サイズ {size} を超えています。他のファイルを選んでください。',
    },
    photo_credit: {
      title: '写真クレジット',
      description: '可能であれば以下のクレジットを使ってください:',
    },
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
      fetch_failed: '設定ファイルを読み込めませんでした。',
      parse_failed: '設定ファイルを解析できませんでした。',
      no_collection: '設定ファイル内でコレクションが定義されていません。',
      no_backend: '設定ファイル内でバックエンドが定義されていません。',
      unsupported_backend: '設定されている「{name}」バックエンドは非対応です。',
      no_media_folder: '設定ファイル内でメディアフォルダーが定義されていません。',
      unexpected: '設定ファイルを検証中に予期せぬ問題が発生しました。',
      try_again: '問題を解決してから再度お試しください。',
    },
  },

  // Backends
  unsupported: {
    browser:
      'お使いのブラウザーはローカル開発に対応していません。代わりに Chrome か Edge を使ってください。',
    storage:
      'お使いのブラウザーでローカルストレージが無効化されています。プライバシー (クッキー) 設定を確認の上、再度お試しください。',
    unexpected: 'ログイン中に予期せぬ問題が発生しました。後で再度お試しください。',
  },

  // Site Settings
  general: '一般',

  // Editorial Workflow
  status: {
    drafts: '下書き',
    in_review: 'レビュー中',
    ready: '公開可',
  },

  // Settings
  prefs: {
    error: {
      permission_denied:
        'ブラウザーストレージ (Cookie) アクセスが拒否されました。許可設定を確認の上、再度お試しください。',
    },
    appearance: {
      title: 'アピアランス',
      theme: 'テーマ',
    },
    theme: {
      auto: '自動',
      dark: 'ダーク',
      light: 'ライト',
    },
    languages: {
      title: '言語',
      ui_language: {
        title: 'ユーザーインターフェース言語',
      },
      translator: {
        title: '{service} 翻訳',
        field_label: '{service} API 認証キー',
        description:
          '<a {homeHref}>{service} API</a> にユーザー登録して、<a {apiKeyHref}>発行された認証キー</a> をここに入力すると、テキストエントリー項目の素早い翻訳が可能となります。',
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
      },
    },
    advanced: {
      title: '詳細',
      developer_mode: {
        title: '開発者モード',
        description:
          '詳細なコンソールログやネイティブコンテキストメニューなど、いくつかの機能を有効化します。',
        switch_label: '開発者モードを有効にする',
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts: {
    search: 'エントリーとアセットを検索',
    create_entry: '新しいエントリーを作成',
    save_entry: 'エントリーを保存',
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
    mp4: 'MP4 動画',
    mpeg: 'MPEG 動画',
    ogv: 'OGG 動画',
    ts: 'MPEG 動画',
    webm: 'WebM 動画',
    '3gp': '3GPP 動画',
    '3g2': '3GPP2 動画',
    aac: 'AAC 音声',
    mid: 'MIDI',
    midi: 'MIDI',
    mp3: 'MP3 音声',
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
  },
};
