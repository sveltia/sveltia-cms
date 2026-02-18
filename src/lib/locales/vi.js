/**
 * IMPORTANT: These strings are not ready for localization. DO NOT TRANSLATE THIS FILE.
 * @see https://github.com/sveltia/sveltia-cms/blob/main/src/lib/locales/README.md
 */
export const strings = {
  // Pages & Navigation
  collections: 'Bộ sưu tập',
  contents: 'Nội dung',
  entries: 'Mục',
  files: 'Tệp',
  assets: 'Tài nguyên',
  media: 'Phương tiện',
  workflow: 'Quy trình',
  editorial_workflow: 'Quy trình biên tập',
  menu: 'Menu',

  // Account
  user_name: 'Tên người dùng',
  password: 'Mật khẩu',
  sign_in: 'Đăng nhập',
  sign_in_with_mobile: 'Đăng nhập bằng di động',
  sign_in_with_mobile_instruction:
    'Quét mã QR bên dưới bằng điện thoại hoặc máy tính bảng của bạn để đăng nhập không cần mật khẩu. Cài đặt của bạn sẽ được sao chép tự động.',
  signed_in_as_x: 'Đã đăng nhập với tên {name}',
  working_with_local_repo: 'Đang làm việc với Kho lưu trữ cục bộ',
  working_with_test_repo: 'Đang làm việc với Kho lưu trữ thử nghiệm',
  sign_out: 'Đăng xuất',

  // Common terms
  create: 'Mới',
  select: 'Chọn',
  select_all: 'Chọn tất cả',
  upload: 'Tải lên',
  copy: 'Sao chép',
  download: 'Tải xuống',
  duplicate: 'Nhân bản',
  delete: 'Xóa',
  save: 'Lưu',
  saving: 'Đang lưu…',
  rename: 'Đổi tên',
  update: 'Cập nhật',
  replace: 'Thay thế',
  add: 'Thêm',
  remove: 'Gỡ bỏ',
  remove_x: 'Gỡ bỏ {name}',
  clear: 'Xóa sạch',
  expand: 'Mở rộng',
  expand_all: 'Mở rộng tất cả',
  collapse: 'Thu gọn',
  collapse_all: 'Thu gọn tất cả',
  insert: 'Chèn',
  restore: 'Khôi phục',
  discard: 'Hủy bỏ',
  searching: 'Đang tìm kiếm…',
  no_results: 'Không tìm thấy kết quả.',
  global: 'Toàn cục',
  primary: 'Chính',
  secondary: 'Phụ',
  collection: 'Bộ sưu tập',
  folder: 'Thư mục',
  api_key: 'Khóa API',
  details: 'Chi tiết',
  back: 'Quay lại',
  loading: 'Đang tải…',
  later: 'Để sau',
  slug: 'Slug',
  singleton: 'Singleton',
  singletons: 'Singletons',

  // Common errors
  clipboard_error: 'Đã xảy ra lỗi khi sao chép dữ liệu.',

  // Entrance
  welcome_to_sveltia_cms: 'Chào mừng bạn đến với Sveltia CMS',
  loading_cms_config: 'Đang tải Cấu hình CMS…',
  loading_site_data: 'Đang tải Dữ liệu Trang web…',
  loading_site_data_error: 'Đã xảy ra lỗi khi tải dữ liệu trang web.',
  sign_in_with_x: 'Đăng nhập bằng {service}',
  sign_in_with_x_using_token: 'Đăng nhập bằng {service} bằng Mã thông báo',
  sign_in_using_pat_title: 'Đăng nhập bằng Mã thông báo truy cập cá nhân',
  sign_in_using_pat_description:
    'Nhập mã thông báo của bạn bên dưới. Nó phải có quyền đọc/ghi vào nội dung kho lưu trữ.',
  sign_in_using_pat_link: 'Bạn có thể tạo mã thông báo trên <a>trang cài đặt người dùng {service}</a>.',
  personal_access_token: 'Mã thông báo truy cập cá nhân',
  authorizing: 'Đang ủy quyền…',
  signing_in: 'Đang đăng nhập…',
  work_with_local_repo: 'Làm việc với Kho lưu trữ cục bộ',
  work_with_local_repo_description:
    'Khi được nhắc, hãy chọn thư mục gốc của kho lưu trữ “{repo}”.',
  work_with_local_repo_description_no_repo:
    'Khi được nhắc, hãy chọn thư mục gốc của kho lưu trữ Git của bạn.',
  work_with_test_repo: 'Làm việc với Kho lưu trữ thử nghiệm',
  sign_in_error: {
    not_project_root:
      'Thư mục bạn đã chọn không phải là thư mục gốc của kho lưu trữ. Vui lòng thử lại.',
    picker_dismissed: 'Không thể chọn thư mục gốc của kho lưu trữ. Vui lòng thử lại.',
    authentication_aborted: 'Xác thực bị hủy bỏ. Vui lòng thử lại.',
    invalid_token: 'Mã thông báo đã cung cấp không hợp lệ. Vui lòng kiểm tra và thử lại.',
    // Errors defined in Sveltia CMS Authenticator
    // https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
    UNSUPPORTED_BACKEND: 'Phần phụ trợ Git của bạn không được trình xác thực hỗ trợ.',
    UNSUPPORTED_DOMAIN: 'Miền của bạn không được phép sử dụng trình xác thực.',
    MISCONFIGURED_CLIENT: 'ID hoặc bí mật của ứng dụng khách OAuth không được định cấu hình.',
    AUTH_CODE_REQUEST_FAILED: 'Không nhận được mã ủy quyền. Vui lòng thử lại sau.',
    CSRF_DETECTED: 'Đã phát hiện cuộc tấn công CSRF tiềm ẩn. Quy trình xác thực đã bị hủy bỏ.',
    TOKEN_REQUEST_FAILED: 'Không thể yêu cầu mã thông báo truy cập. Vui lòng thử lại sau.',
    TOKEN_REFRESH_FAILED: 'Không thể làm mới mã thông báo truy cập. Vui lòng thử lại sau.',
    MALFORMED_RESPONSE: 'Máy chủ phản hồi với dữ liệu sai định dạng. Vui lòng thử lại sau.',
  },
  backend_unsupported_version: 'Phần phụ trợ {name} yêu cầu {name} {version} trở lên.',
  repository_no_access: 'Bạn không có quyền truy cập vào kho lưu trữ “{repo}”.',
  repository_not_found: 'Kho lưu trữ “{repo}” không tồn tại.',
  repository_empty: 'Kho lưu trữ “{repo}” không có nhánh nào.',
  branch_not_found: 'Kho lưu trữ “{repo}” không có nhánh “{branch}”.',
  unexpected_error: 'Lỗi không xác định',

  // Parser errors
  entry_parse_error:
    'Đã xảy ra lỗi khi phân tích tệp mục. Kiểm tra bảng điều khiển trình duyệt để biết chi tiết.',
  entry_parse_errors:
    'Đã xảy ra lỗi khi phân tích các tệp mục. Kiểm tra bảng điều khiển trình duyệt để biết chi tiết.',

  // Onboarding
  mobile_promo_title: 'Sveltia CMS hiện đã có trên thiết bị di động!',
  mobile_promo_button: 'Thử ngay',

  // Global toolbar
  visit_live_site: 'Truy cập Trang web Trực tiếp',
  switch_page: 'Chuyển trang',
  search_placeholder_entries: 'Tìm kiếm mục…',
  search_placeholder_assets: 'Tìm kiếm tài nguyên…',
  search_placeholder_all: 'Tìm kiếm mục và tài nguyên…',
  create_entry_or_assets: 'Tạo Mục hoặc Tài nguyên',
  publish_changes: 'Xuất bản Thay đổi',
  publishing_changes: 'Đang xuất bản thay đổi…',
  publishing_changes_failed: 'Không thể xuất bản thay đổi. Vui lòng thử lại sau.',
  show_notifications: 'Hiển thị thông báo',
  notifications: 'Thông báo',
  show_account_menu: 'Hiển thị Menu Tài khoản',
  account: 'Tài khoản',
  live_site: 'Trang web trực tiếp',
  git_repository: 'Kho lưu trữ Git',
  settings: 'Cài đặt',
  cms_config: 'Cấu hình CMS',
  show_help_menu: 'Hiển thị Menu Trợ giúp',
  help: 'Trợ giúp',
  keyboard_shortcuts: 'Phím tắt bàn phím',
  documentation: 'Tài liệu',
  release_notes: 'Ghi chú phát hành',
  announcements: 'Thông báo',
  version_x: 'Phiên bản {version}',
  report_issue: 'Báo cáo sự cố',
  share_feedback: 'Chia sẻ phản hồi',
  get_help: 'Nhận trợ giúp',
  join_discord: 'Tham gia với chúng tôi trên Discord',
  bluesky: 'Theo dõi chúng tôi trên Bluesky',

  // Update notification
  update_available: 'Phiên bản mới nhất của Sveltia CMS đã sẵn sàng.',
  update_now: 'Cập nhật ngay',

  // Backend status indicator
  backend_status: {
    minor_incident:
      '{service} đang gặp một sự cố nhỏ. Quy trình làm việc của bạn có thể bị ảnh hưởng.',
    major_incident:
      '{service} đang gặp một sự cố lớn. Bạn nên đợi cho đến khi tình hình được cải thiện.',
  },

  // Library
  content_library: 'Thư viện nội dung',
  asset_library: 'Thư viện tài nguyên',
  asset_location: {
    repository: 'Trang web của bạn',
    external: 'Vị trí bên ngoài',
    stock_photos: 'Ảnh kho',
  },
  collection_assets: 'Tài nguyên bộ sưu tập',
  entry_list: 'Danh sách mục',
  file_list: 'Danh sách tệp',
  asset_list: 'Danh sách tài nguyên',
  x_collection: 'Bộ sưu tập “{collection}”',
  x_asset_folder: 'Thư mục tài nguyên “{folder}”',
  viewing_collection_list: 'Bạn đang xem danh sách bộ sưu tập.',
  viewing_asset_folder_list: 'Bạn đang xem danh sách thư mục tài nguyên.',
  viewing_x_collection_many_entries:
    'Bạn đang xem bộ sưu tập “{collection}”, có {count} mục.',
  viewing_x_collection_one_entry:
    'Bạn đang xem bộ sưu tập “{collection}”, có một mục.',
  viewing_x_collection_no_entries:
    'Bạn đang xem bộ sưu tập “{collection}”, hiện chưa có mục nào.',
  viewing_x_asset_folder_many_assets:
    'Bạn đang xem thư mục tài nguyên “{folder}”, có {count} tài nguyên.',
  viewing_x_asset_folder_one_asset:
    'Bạn đang xem thư mục tài nguyên “{folder}”, có một tài nguyên.',
  viewing_x_asset_folder_no_assets:
    'Bạn đang xem thư mục tài nguyên “{folder}”, hiện chưa có tài nguyên nào.',
  singleton_selected_announcement: 'Nhấn Enter để chỉnh sửa tệp “{file}”.',
  collection_not_found: 'Không tìm thấy bộ sưu tập',
  file_not_found: 'Không tìm thấy tệp.',
  x_of_x_selected: 'Đã chọn {selected} trên {total}',
  switch_view: 'Chuyển đổi chế độ xem',
  list_view: 'Chế độ xem danh sách',
  grid_view: 'Chế độ xem lưới',
  switch_to_list_view: 'Chuyển sang chế độ xem danh sách',
  switch_to_grid_view: 'Chuyển sang chế độ xem lưới',
  sort: 'Sắp xếp',
  sorting_options: 'Tùy chọn sắp xếp',
  sort_keys: {
    none: 'Không',
    name: 'Tên',
    slug: 'Slug',
    commit_author: 'Cập nhật bởi',
    commit_date: 'Cập nhật vào',
  },
  ascending: '{label}, A đến Z',
  ascending_date: '{label}, cũ đến mới',
  descending: '{label}, Z đến A',
  descending_date: '{label}, mới đến cũ',
  filter: 'Lọc',
  filtering_options: 'Tùy chọn lọc',
  group: 'Nhóm', // Verb
  grouping_options: 'Tùy chọn nhóm',
  type: 'Loại',
  all: 'Tất cả',
  image: 'Hình ảnh',
  video: 'Video',
  audio: 'Âm thanh',
  document: 'Tài liệu',
  other: 'Khác',
  show_assets: 'Hiển thị tài nguyên',
  hide_assets: 'Ẩn tài nguyên',
  show_info: 'Hiển thị thông tin',
  hide_info: 'Ẩn thông tin',
  all_assets: 'Tất cả tài nguyên',
  global_assets: 'Tài nguyên toàn cục',
  entry_not_found: 'Không tìm thấy mục.',
  creating_entries_disabled_by_admin:
    'Quản trị viên đã tắt tính năng tạo mục mới trong bộ sưu tập này.',
  creating_entries_disabled_by_limit:
    'Bạn không thể thêm mục mới vào bộ sưu tập này vì nó đã đạt đến giới hạn {limit} mục.',
  back_to_collection: 'Quay lại bộ sưu tập',
  collection_list: 'Danh sách bộ sưu tập',
  back_to_collection_list: 'Quay lại danh sách bộ sưu tập',
  asset_folder_list: 'Danh sách thư mục tài nguyên',
  back_to_asset_folder_list: 'Quay lại danh sách thư mục tài nguyên',
  search_results: 'Kết quả tìm kiếm',
  search_results_for_x: 'Kết quả tìm kiếm cho “{terms}”',
  viewing_entry_search_results:
    'Bạn đang xem kết quả tìm kiếm cho “{terms}”. Chúng tôi đã tìm thấy {entries}.',
  viewing_asset_search_results:
    'Bạn đang xem kết quả tìm kiếm cho “{terms}”. Chúng tôi đã tìm thấy {assets}.',
  many_entries: '{count} mục',
  one_entry: 'một mục',
  no_entries: 'không có mục nào',
  many_assets: '{count} tài nguyên',
  one_asset: 'một tài nguyên',
  no_assets: 'không có tài nguyên nào',
  no_files_found: 'Không tìm thấy tệp nào.',
  no_entries_found: 'Không tìm thấy mục nào.',
  upload_assets: 'Tải lên tài nguyên mới',
  edit_options: 'Tùy chọn chỉnh sửa',
  show_edit_options: 'Hiển thị tùy chọn chỉnh sửa',
  edit_asset: 'Chỉnh sửa tài nguyên',
  edit_x: 'Chỉnh sửa {name}',
  wrap_long_lines: 'Ngắt dòng dài',
  rename_asset: 'Đổi tên tài nguyên',
  rename_x: 'Đổi tên {name}',
  enter_new_name_for_asset: 'Nhập tên mới bên dưới.',
  enter_new_name_for_asset_with_one_entry:
    'Nhập tên mới bên dưới. Mục sử dụng tài nguyên này cũng sẽ được cập nhật.',
  enter_new_name_for_asset_with_many_entries:
    'Nhập tên mới bên dưới. {count} mục sử dụng tài nguyên này cũng sẽ được cập nhật.',
  enter_new_name_for_asset_error: {
    empty: 'Tên tệp không được để trống.',
    character: 'Tên tệp không được chứa các ký tự đặc biệt.',
    duplicate: 'Tên tệp này đã được sử dụng cho một tài nguyên khác.',
  },
  replace_asset: 'Thay thế tài nguyên',
  replace_x: 'Thay thế {name}',
  click_to_browse: 'Nhấp để duyệt…',
  tap_to_browse: 'Chạm để duyệt…',
  drop_file_or_click_to_browse: 'Thả tệp vào đây hoặc nhấp để duyệt…',
  drop_files_or_click_to_browse: 'Thả các tệp vào đây hoặc nhấp để duyệt…',
  drop_image_file_or_click_to_browse: 'Thả một tệp hình ảnh vào đây hoặc nhấp để duyệt…',
  drop_image_files_or_click_to_browse: 'Thả các tệp hình ảnh vào đây hoặc nhấp để duyệt…',
  drop_file_here: 'Thả tệp vào đây',
  drop_files_here: 'Thả các tệp vào đây',
  unsupported_file_type: 'Loại tệp không được hỗ trợ',
  dropped_file_type_mismatch: 'Tệp được thả không phải là loại {type}. Vui lòng thử lại.',
  dropped_image_type_mismatch:
    'Tệp được thả không được hỗ trợ. Chỉ chấp nhận hình ảnh AVIF, GIF, JPEG, PNG, WebP hoặc SVG. Vui lòng thử lại.',
  choose_file: 'Chọn tệp',
  choose_files: 'Chọn các tệp',
  delete_asset: 'Xóa tài nguyên',
  delete_assets: 'Xóa các tài nguyên',
  delete_selected_asset: 'Xóa tài nguyên đã chọn',
  delete_selected_assets: 'Xóa các tài nguyên đã chọn',
  confirm_deleting_this_asset: 'Bạn có chắc chắn muốn xóa tài nguyên này không?',
  confirm_deleting_selected_asset: 'Bạn có chắc chắn muốn xóa tài nguyên đã chọn không?',
  confirm_deleting_selected_assets: 'Bạn có chắc chắn muốn xóa {count} tài nguyên đã chọn không?',
  confirm_deleting_all_assets: 'Bạn có chắc chắn muốn xóa tất cả tài nguyên không?',
  delete_entry: 'Xóa mục',
  delete_entries: 'Xóa các mục',
  delete_selected_entry: 'Xóa mục đã chọn',
  delete_selected_entries: 'Xóa các mục đã chọn',
  confirm_deleting_this_entry: 'Bạn có chắc chắn muốn xóa mục này không?',
  confirm_deleting_this_entry_with_assets:
    'Bạn có chắc chắn muốn xóa mục này và các tài nguyên liên quan không?',
  confirm_deleting_selected_entry: 'Bạn có chắc chắn muốn xóa mục đã chọn không?',
  confirm_deleting_selected_entry_with_assets:
    'Bạn có chắc chắn muốn xóa mục đã chọn và các tài nguyên liên quan không?',
  confirm_deleting_selected_entries:
    'Bạn có chắc chắn muốn xóa {count} mục đã chọn không?',
  confirm_deleting_selected_entries_with_assets:
    'Bạn có chắc chắn muốn xóa {count} mục đã chọn và các tài nguyên liên quan không?',
  confirm_deleting_all_entries: 'Bạn có chắc chắn muốn xóa tất cả các mục không?',
  confirm_deleting_all_entries_with_assets:
    'Bạn có chắc chắn muốn xóa tất cả các mục và các tài nguyên liên quan không?',
  processing_file: 'Đang xử lý một tệp. Việc này có thể mất một lúc.',
  processing_files: 'Đang xử lý các tệp. Việc này có thể mất một lúc.',
  uploading_files: 'Đang tải lên các tệp',
  confirm_replacing_file: 'Bạn có chắc chắn muốn thay thế “{name}” bằng tệp sau không?',
  confirm_uploading_file:
    'Bạn có chắc chắn muốn lưu tệp sau vào thư mục “{folder}” không?',
  confirm_uploading_files:
    'Bạn có chắc chắn muốn lưu {count} tệp sau vào thư mục “{folder}” không?',
  oversized_files: 'Tệp quá kích thước',
  warning_oversized_file:
    'Không thể tải tệp này lên vì nó vượt quá kích thước tối đa là {size}. Vui lòng giảm kích thước hoặc chọn một tệp khác.',
  warning_oversized_files:
    'Không thể tải các tệp này lên vì chúng vượt quá kích thước tối đa là {size}. Vui lòng giảm kích thước hoặc chọn các tệp khác.',
  uploading_files_progress: 'Đang tải lên các tệp…',
  uploading_file_progress: 'Đang tải lên tệp…',
  uploading_files_failed: 'Không thể tải lên các tệp',
  uploading_file_failed: 'Không thể tải lên tệp',
  file_meta: '{type} · {size}',
  file_meta_converted_from_x: '(chuyển đổi từ {type})',
  no_entries_created: 'Bộ sưu tập này hiện chưa có mục nào.',
  create_new_entry: 'Tạo mục mới',
  entry: 'Mục',
  index_file: 'Tệp chỉ mục',
  no_files_in_collection: 'Không có tệp nào trong bộ sưu tập này.',
  asset_info: 'Thông tin tài nguyên',
  select_asset_show_info: 'Chọn một tài nguyên để xem thông tin.',
  duplicate_entry: 'Nhân bản mục',
  entry_duplicated: 'Mục đã được nhân bản. Nó hiện là một bản nháp mới.',
  entry_validation_error: 'Một trường có lỗi. Vui lòng sửa lỗi để lưu mục.',
  entry_validation_errors: '{count} trường có lỗi. Vui lòng sửa lỗi để lưu mục.',
  entry_saved: 'Mục đã được lưu.',
  entry_saved_and_published: 'Mục đã được lưu và xuất bản.',
  entry_deleted: 'Mục đã được xóa.',
  entries_deleted: 'Đã xóa {count} mục.',
  asset_saved: 'Tài nguyên đã được lưu.',
  asset_saved_and_published: 'Tài nguyên đã được lưu và xuất bản.',
  assets_saved: 'Đã lưu {count} tài nguyên.',
  assets_saved_and_published: 'Đã lưu và xuất bản {count} tài nguyên.',
  asset_url_copied: 'URL tài nguyên đã được sao chép vào bộ nhớ tạm.',
  asset_urls_copied: 'Các URL tài nguyên đã được sao chép vào bộ nhớ tạm.',
  asset_path_copied: 'Đường dẫn tệp tài nguyên đã được sao chép vào bộ nhớ tạm.',
  asset_paths_copied: 'Các đường dẫn tệp tài nguyên đã được sao chép vào bộ nhớ tạm.',
  asset_data_copied: 'Tệp tài nguyên đã được sao chép vào bộ nhớ tạm.',
  asset_downloaded: 'Tệp tài nguyên đã được tải xuống.',
  assets_downloaded: 'Các tệp tài nguyên đã được tải xuống.',
  asset_moved: 'Tài nguyên đã được di chuyển.',
  assets_moved: 'Đã di chuyển {count} tài nguyên.',
  asset_renamed: 'Tài nguyên đã được đổi tên.',
  assets_renamed: 'Đã đổi tên {count} tài nguyên.',
  asset_deleted: 'Tài nguyên đã được xóa.',
  assets_deleted: 'Đã xóa {count} tài nguyên.',

  // Content editor
  content_editor: 'Trình chỉnh sửa nội dung',
  restore_backup_title: 'Khôi phục bản nháp',
  restore_backup_description:
    'Mục này có một bản sao lưu từ {datetime}. Bạn có muốn khôi phục bản nháp đã chỉnh sửa không?',
  draft_backup_saved: 'Bản sao lưu bản nháp đã được lưu.',
  draft_backup_restored: 'Bản sao lưu bản nháp đã được khôi phục.',
  draft_backup_deleted: 'Bản sao lưu bản nháp đã được xóa.',
  cancel_editing: 'Hủy chỉnh sửa',
  create_entry_title: 'Đang tạo {name}',
  create_entry_announcement: 'Bạn đang tạo một mục mới trong bộ sưu tập “{collection}”.',
  edit_entry_title: '{collection} › {entry}',
  edit_entry_announcement:
    'Bạn đang chỉnh sửa mục “{entry}” trong bộ sưu tập “{collection}”.',
  edit_file_announcement: 'Bạn đang chỉnh sửa tệp “{file}” trong bộ sưu tập “{collection}”.',
  edit_singleton_announcement: 'Bạn đang chỉnh sửa tệp “{file}”.',
  save_and_publish: 'Lưu và Xuất bản',
  save_without_publishing: 'Lưu mà không xuất bản',
  show_editor_options: 'Hiển thị tùy chọn trình chỉnh sửa',
  editor_options: 'Tùy chọn trình chỉnh sửa',
  show_preview: 'Hiển thị bản xem trước',
  sync_scrolling: 'Đồng bộ cuộn',
  switch_locale: 'Chuyển đổi ngôn ngữ',
  locale_content_disabled_short: '(đã tắt)',
  locale_content_error_short: '(lỗi)',
  edit: 'Chỉnh sửa',
  preview: 'Xem trước',
  edit_x_locale: 'Chỉnh sửa nội dung {locale}',
  preview_x_locale: 'Xem trước nội dung {locale}',
  content_preview: 'Xem trước nội dung',
  show_content_options_x_locale: 'Hiển thị tùy chọn nội dung {locale}',
  content_options_x_locale: 'Tùy chọn nội dung {locale}',
  x_field: 'Trường “{field}”',
  show_field_options: 'Hiển thị tùy chọn trường',
  field_options: 'Tùy chọn trường',
  unsupported_field_type_x: 'Loại trường không được hỗ trợ: {name}',
  enable_x_locale: 'Bật {locale}',
  reenable_x_locale: 'Bật lại {locale}',
  disable_x_locale: 'Tắt {locale}',
  locale_x_has_been_disabled: 'Nội dung {locale} đã bị tắt.',
  locale_x_now_disabled:
    'Nội dung {locale} hiện đã bị tắt. Nó sẽ bị xóa khi bạn lưu mục.',
  view_in_repository: 'Xem trong kho lưu trữ',
  view_on_x: 'Xem trên {service}',
  view_on_live_site: 'Xem trên trang web trực tiếp',
  copy_from: 'Sao chép từ…',
  copy_from_x: 'Sao chép từ {locale}',
  translation_options: 'Tùy chọn dịch',
  translate: 'Dịch',
  translate_field: 'Dịch trường',
  translate_fields: 'Dịch các trường',
  translate_from: 'Dịch từ…',
  translate_from_x: 'Dịch từ {locale}',
  revert_changes: 'Hoàn tác thay đổi',
  revert_all_changes: 'Hoàn tác tất cả thay đổi',
  edit_slug: 'Chỉnh sửa Slug',
  edit_slug_warning:
    'Thay đổi slug có thể làm hỏng các liên kết nội bộ và bên ngoài đến mục này. Hiện tại, Sveltia CMS không cập nhật các tham chiếu được tạo bằng các trường Quan hệ (Relation), vì vậy bạn sẽ cần cập nhật thủ công các tham chiếu đó cùng với các liên kết khác.',
  edit_slug_error: {
    empty: 'Slug không được để trống.',
    duplicate: 'Slug này đã được sử dụng cho một mục khác.',
  },
  required: 'Bắt buộc',
  editor: {
    translation: {
      none: 'Chưa có gì được dịch.',
      started: 'Đang dịch…',
      error: 'Đã xảy ra lỗi khi dịch.',
      complete: {
        one: 'Đã dịch trường từ {source}.',
        many: 'Đã dịch {count} trường từ {source}.',
      },
    },
    copy: {
      none: 'Chưa có gì được sao chép.',
      complete: {
        one: 'Đã sao chép trường từ {source}.',
        many: 'Đã sao chép {count} trường từ {source}.',
      },
    },
  },
  validation: {
    value_missing: 'Trường này là bắt buộc.',
    range_underflow: {
      number: 'Giá trị phải lớn hơn hoặc bằng {min}.',
      select_many: 'Bạn phải chọn ít nhất {min} mục.',
      select_one: 'Bạn phải chọn ít nhất {min} mục.',
      add_many: 'Bạn phải thêm ít nhất {min} mục.',
      add_one: 'Bạn phải thêm ít nhất {min} mục.',
    },
    range_overflow: {
      number: 'Giá trị phải nhỏ hơn hoặc bằng {max}.',
      select_many: 'Bạn không thể chọn nhiều hơn {max} mục.',
      select_one: 'Bạn không thể chọn nhiều hơn {max} mục.',
      add_many: 'Bạn không thể thêm nhiều hơn {max} mục.',
      add_one: 'Bạn không thể thêm nhiều hơn {max} mục.',
    },
    too_short: {
      one: 'Bạn phải nhập ít nhất {min} ký tự.',
      many: 'Bạn phải nhập ít nhất {min} ký tự.',
    },
    too_long: {
      one: 'Bạn không thể nhập nhiều hơn {max} ký tự.',
      many: 'Bạn không thể nhập nhiều hơn {max} ký tự.',
    },
    type_mismatch: {
      number: 'Vui lòng nhập một số.',
      email: 'Vui lòng nhập một email hợp lệ.',
      url: 'Vui lòng nhập một URL hợp lệ.',
    },
  },
  saving_entry: {
    error: {
      title: 'Lỗi',
      description: 'Đã xảy ra lỗi khi lưu mục. Vui lòng thử lại sau.',
    },
  },

  // Media details
  viewing_x_asset_details: 'Bạn đang xem chi tiết của tài nguyên “{name}”.',
  asset_editor: 'Trình chỉnh sửa tài nguyên',
  preview_unavailable: 'Bản xem trước không khả dụng.',
  public_url: 'URL công khai',
  public_urls: 'Các URL công khai',
  file_path: 'Đường dẫn tệp',
  file_paths: 'Các đường dẫn tệp',
  file_data: 'Dữ liệu tệp',
  kind: 'Loại',
  size: 'Kích thước',
  dimensions: 'Kích thước ảnh',
  duration: 'Thời lượng',
  used_in: 'Được sử dụng trong',
  created_date: 'Ngày tạo',
  location: 'Vị trí',
  map_lat_lng: 'Bản đồ hiển thị vĩ độ {latitude}, kinh độ {longitude}',

  // Fields
  select_file: 'Chọn tệp',
  select_image: 'Chọn hình ảnh',
  replace_file: 'Thay thế tệp',
  replace_image: 'Thay thế hình ảnh',
  remove_file: 'Gỡ bỏ tệp',
  remove_image: 'Gỡ bỏ hình ảnh',
  remove_this_item: 'Gỡ bỏ mục này',
  move_up: 'Di chuyển lên',
  move_down: 'Di chuyển xuống',
  add_x: 'Thêm {name}',
  add_item_above: 'Thêm mục lên trên',
  add_item_below: 'Thêm mục xuống dưới',
  select_list_type: 'Chọn loại danh sách',
  opacity: 'Độ mờ',
  unselected_option: '(Không có)',
  assets_dialog: {
    title: {
      file: 'Chọn tệp',
      image: 'Chọn hình ảnh',
    },
    search_for_file: 'Tìm kiếm tệp',
    search_for_image: 'Tìm kiếm hình ảnh',
    locations: 'Vị trí',
    folder: {
      field: 'Tài nguyên trường',
      entry: 'Tài nguyên mục',
      file: 'Tài nguyên tệp',
      collection: 'Tài nguyên bộ sưu tập',
      global: 'Tài nguyên toàn cục',
    },
    error: {
      invalid_key: 'Khóa API của bạn không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại và thử lại.',
      search_fetch_failed: 'Đã xảy ra lỗi khi tìm kiếm tài nguyên. Vui lòng thử lại sau.',
      image_fetch_failed:
        'Đã xảy ra lỗi khi tải xuống tài nguyên đã chọn. Vui lòng thử lại sau.',
    },
    available_images: 'Hình ảnh có sẵn',
    enter_url: 'Nhập URL',
    enter_file_url: 'Nhập URL của tệp:',
    enter_image_url: 'Nhập URL của hình ảnh:',
    large_file: {
      title: 'Tệp lớn',
    },
    photo_credit: {
      title: 'Ghi công ảnh',
      description: 'Sử dụng ghi công sau nếu có thể:',
    },
    unsaved: 'Chưa lưu',
  },
  character_counter: {
    min_max: {
      one: 'Đã nhập {count} ký tự. Tối thiểu: {min}. Tối đa: {max}.',
      many: 'Đã nhập {count} ký tự. Tối thiểu: {min}. Tối đa: {max}.',
    },
    min: {
      one: 'Đã nhập {count} ký tự. Tối thiểu: {min}.',
      many: 'Đã nhập {count} ký tự. Tối thiểu: {min}.',
    },
    max: {
      one: 'Đã nhập {count} ký tự. Tối đa: {max}.',
      many: 'Đã nhập {count} ký tự. Tối đa: {max}.',
    },
  },
  youtube_video_player: 'Trình phát video YouTube',
  today: 'Hôm nay',
  now: 'Bây giờ',
  editor_components: {
    image: 'Hình ảnh',
    src: 'Nguồn',
    alt: 'Văn bản thay thế',
    title: 'Tiêu đề',
    link: 'Liên kết',
  },
  key_value: {
    key: 'Khóa',
    value: 'Giá trị',
    action: 'Hành động',
    empty_key: 'Khóa là bắt buộc.',
    duplicate_key: 'Khóa phải là duy nhất.',
  },
  find_place: 'Tìm địa điểm',
  use_your_location: 'Sử dụng vị trí của bạn',
  geolocation_error_title: 'Lỗi định vị',
  geolocation_error_body: 'Đã xảy ra lỗi khi lấy vị trí của bạn.',
  geolocation_unsupported: 'Trình duyệt này không hỗ trợ API định vị.',

  // Content preview
  boolean: {
    true: 'Có',
    false: 'Không',
  },

  // Integrations
  cloud_storage: {
    invalid: 'Dịch vụ không được định cấu hình đúng.',
    auth: {
      api_key: {
        initial: 'Nhập khóa API của bạn để đăng nhập vào {service}.',
        requested: 'Đang xác thực…',
        error: 'Khóa API đã cung cấp không hợp lệ. Vui lòng kiểm tra lại và thử lại.',
      },
      password: {
        initial: 'Nhập mật khẩu của bạn để đăng nhập vào {service}.',
        requested: 'Đang đăng nhập…',
        error: 'Tên người dùng hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại và thử lại.',
      },
    },
    cloudinary: {
      iframe_title: 'Thư viện phương tiện Cloudinary',
      activate: {
        button_label: 'Kích hoạt Cloudinary',
        description: 'Sau khi đăng nhập, nhấp lại vào nút Đăng nhập để tiếp tục.', // Don’t translate "Sign In" here
      },
      auth: {
        initial: 'Nhập Bí mật API (API Secret) của bạn để sử dụng Cloudinary.', // Not "API Key"
        requested: 'Đang xác thực…',
        error: 'Bí mật API đã cung cấp không hợp lệ. Vui lòng kiểm tra lại và thử lại.',
      },
    },
    uploadcare: {
      auth: {
        initial: 'Nhập Khóa Bí mật API (API Secret Key) của bạn để sử dụng Uploadcare.',
        requested: 'Đang xác thực…',
        error: 'Khóa Bí mật đã cung cấp không hợp lệ. Vui lòng kiểm tra lại và thử lại.',
      },
    },
  },

  // Configuration
  config: {
    one_error: 'Có một lỗi trong cấu hình CMS. Vui lòng giải quyết vấn đề và thử lại.',
    many_errors:
      'Có nhiều lỗi trong cấu hình CMS. Vui lòng giải quyết các vấn đề và thử lại.',
    error_locator: {
      collection: 'Bộ sưu tập {collection}',
      file: 'Tệp {file}',
      field: 'Trường `{field}`',
    },
    error: {
      no_secure_context: 'Sveltia CMS chỉ hoạt động với các URL HTTPS hoặc localhost.',
      insecure_url: 'URL tệp cấu hình phải sử dụng giao thức HTTPS hoặc địa chỉ localhost.',
      insecure_urls: 'Các URL tệp cấu hình phải sử dụng giao thức HTTPS hoặc địa chỉ localhost.',
      fetch_failed: 'Không thể lấy tệp cấu hình.',
      fetch_failed_not_ok: 'Phản hồi HTTP trả về với trạng thái {status}.',
      fetch_failed_with_manual_init:
        'Không thể lấy tệp cấu hình. Để ngăn tệp `config.yml` tải, hãy thêm [`load_config_file: false`](https://sveltiacms.app/en/docs/api/initialization#providing-a-full-configuration) vào đối tượng cấu hình được truyền cho `CMS.init()`.',
      parse_failed: 'Không thể phân tích tệp cấu hình.',
      parse_failed_invalid_object: 'Tệp cấu hình không phải là một đối tượng JavaScript hợp lệ.',
      parse_failed_unsupported_type:
        'Tệp cấu hình không thuộc loại tệp hợp lệ. Chỉ hỗ trợ YAML, TOML và JSON.',
      no_collection: 'Các bộ sưu tập chưa được xác định.',
      missing_backend: 'Phần phụ trợ chưa được xác định.',
      missing_backend_name: 'Tên phần phụ trợ chưa được xác định.',
      unsupported_known_backend:
        'Phần phụ trợ {name} [không được hỗ trợ](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented) trong Sveltia CMS.',
      unsupported_custom_backend:
        'Các phần phụ trợ tùy chỉnh [không được hỗ trợ](https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented) trong Sveltia CMS.',
      unsupported_backend_suggestion:
        'Thay vào đó, hãy sử dụng một trong các [phần phụ trợ được hỗ trợ](https://sveltiacms.app/en/docs/backends#supported-backends) thay thế.',
      missing_repository: 'Kho lưu trữ chưa được xác định.',
      invalid_repository:
        'Kho lưu trữ được định cấu hình không hợp lệ. Nó phải có định dạng “chủ_sở_hữu/tên_kho”.',
      oauth_implicit_flow:
        'Phương thức xác thực được định cấu hình (implicit flow) không được hỗ trợ trong Sveltia CMS. Thay vào đó, hãy sử dụng ủy quyền PKCE.',
      github_pkce_unsupported:
        'Ủy quyền PKCE với GitHub vẫn chưa được hỗ trợ trong Sveltia CMS do các hạn chế của GitHub.',
      oauth_no_app_id: 'ID ứng dụng OAuth chưa được xác định.',
      missing_media_folder: 'Thư mục phương tiện chưa được xác định.',
      invalid_media_folder: 'Thư mục phương tiện được định cấu hình không hợp lệ. Nó phải là một chuỗi.',
      invalid_public_folder: 'Thư mục công khai được định cấu hình không hợp lệ. Nó phải là một chuỗi.',
      public_folder_relative_path:
        'Thư mục công khai được định cấu hình không hợp lệ. Nó phải là một đường dẫn tuyệt đối bắt đầu bằng “/”.',
      public_folder_absolute_url:
        'Một URL tuyệt đối cho tùy chọn thư mục công khai không được hỗ trợ trong Sveltia CMS.',
      invalid_collection_no_options:
        'Bộ sưu tập phải được xác định tùy chọn `folder`, `files` hoặc `divider`.',
      invalid_collection_multiple_options:
        'Bộ sưu tập không thể có đồng thời các tùy chọn `folder`, `files` và `divider`.',
      file_format_mismatch: 'Phần mở rộng `{extension}` không khớp với định dạng `{format}`.',
      invalid_slug_slash:
        'Mẫu slug `{slug}` không hợp lệ vì nó không được chứa dấu gạch chéo. Để sắp xếp các mục trong các thư mục con, hãy sử dụng tùy chọn `path` thay cho `slug`.',
      missing_collection_name:
        'Bộ sưu tập {count} phải được xác định tùy chọn `name` là một chuỗi không rỗng.',
      invalid_collection_name:
        'Tên bộ sưu tập `{name}` không hợp lệ. Nó không được chứa các ký tự đặc biệt.',
      duplicate_collection_name:
        'Tên bộ sưu tập phải là duy nhất, nhưng `{name}` được sử dụng nhiều hơn một lần.',
      missing_collection_file_name:
        'Tệp bộ sưu tập {count} phải được xác định tùy chọn `name` là một chuỗi không rỗng.',
      invalid_collection_file_name:
        'Tên tệp bộ sưu tập `{name}` không hợp lệ. Nó không được chứa các ký tự đặc biệt.',
      duplicate_collection_file_name:
        'Tên tệp bộ sưu tập phải là duy nhất, nhưng `{name}` được sử dụng nhiều hơn một lần.',
      missing_field_name:
        'Trường {count} phải được xác định tùy chọn `name` là một chuỗi không rỗng.',
      invalid_field_name:
        'Tên trường `{name}` không hợp lệ. Nó không được chứa các ký tự đặc biệt.',
      duplicate_field_name: 'Tên trường phải là duy nhất, nhưng `{name}` được sử dụng nhiều hơn một lần.',
      missing_variable_type:
        'Loại biến {count} phải được xác định tùy chọn `name` là một chuỗi không rỗng.',
      invalid_variable_type:
        'Tên loại biến `{name}` không hợp lệ. Nó không được chứa các ký tự đặc biệt.',
      duplicate_variable_type:
        'Tên loại biến phải là duy nhất, nhưng `{name}` được sử dụng nhiều hơn một lần.',
      date_field_type:
        'Loại trường Date cũ không được hỗ trợ trong Sveltia CMS. Thay vào đó, hãy sử dụng loại trường DateTime với tùy chọn `time_format:false`.',
      unsupported_deprecated_option:
        'Tùy chọn `{prop}` cũ không được hỗ trợ trong Sveltia CMS. Thay vào đó, hãy sử dụng tùy chọn `{newProp}`.',
      allow_multiple:
        'Tùy chọn `allow_multiple` không được hỗ trợ trong Sveltia CMS. Thay vào đó, hãy sử dụng tùy chọn `multiple`, mặc định là `false`.',
      invalid_list_field:
        'Trường Danh sách (List) không thể có đồng thời các tùy chọn `field`, `fields` và `types`.',
      invalid_list_variable_type:
        'Loại biến của trường Danh sách (List) không hợp lệ. Tùy chọn `widget` được đặt thành `{widget}` nhưng nó phải là `object`.',
      invalid_object_field:
        'Trường Đối tượng (Object) không thể có đồng thời các tùy chọn `fields` và `types`.',
      object_field_missing_fields:
        'Trường Đối tượng (Object) phải được xác định tùy chọn `fields` hoặc `types`.',
      relation_field_invalid_collection:
        'Bộ sưu tập được tham chiếu `{collection}` không hợp lệ hoặc chưa được xác định.',
      relation_field_invalid_collection_file:
        'Tệp được tham chiếu `{file}` không hợp lệ hoặc chưa được xác định.',
      relation_field_missing_file_name:
        'Tùy chọn `file` phải được xác định cho một quan hệ đến một bộ sưu tập tệp.',
      relation_field_invalid_value_field:
        'Trường giá trị được tham chiếu `{field}` không hợp lệ hoặc chưa được xác định.',
      unexpected: 'Lỗi không xác định',
    },
    warning: {
      editorial_workflow_unsupported: 'Quy trình biên tập vẫn chưa được hỗ trợ trong Sveltia CMS.',
      open_authoring_unsupported: 'Sáng tác mở (Open authoring) vẫn chưa được hỗ trợ trong Sveltia CMS.',
      nested_collections_unsupported: 'Bộ sưu tập lồng nhau vẫn chưa được hỗ trợ trong Sveltia CMS.',
      unsupported_ignored_option:
        'Tùy chọn `{prop}` không được hỗ trợ trong Sveltia CMS. Nó sẽ bị bỏ qua.',
    },
    compatibility_link:
      'Xem ghi chú tương thích để biết chi tiết: https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented',
  },

  // Backends
  local_backend: {
    indicator: 'Cục bộ',
    unsupported_browser:
      'Phát triển cục bộ không được hỗ trợ trong trình duyệt của bạn. Vui lòng sử dụng Chrome hoặc Edge thay thế.',
    disabled: 'Phát triển cục bộ bị tắt trong trình duyệt của bạn. <a>Đây là cách để bật nó</a>.',
  },

  // Editorial Workflow
  status: {
    drafts: 'Bản nháp',
    in_review: 'Đang xem xét',
    ready: 'Sẵn sàng',
  },

  // Settings
  categories: 'Danh mục',
  prefs: {
    changes: {
      api_key_saved: 'Khóa API đã được lưu.',
      api_key_removed: 'Khóa API đã được gỡ bỏ.',
    },
    error: {
      permission_denied:
        'Truy cập bộ nhớ trình duyệt (Cookie) đã bị từ chối. Vui lòng kiểm tra quyền và thử lại.',
    },
    appearance: {
      title: 'Giao diện',
      theme: 'Chủ đề',
      select_theme: 'Chọn chủ đề',
    },
    theme: {
      auto: 'Tự động',
      dark: 'Tối',
      light: 'Sáng',
    },
    language: {
      title: 'Ngôn ngữ',
      ui_language: {
        title: 'Ngôn ngữ giao diện người dùng',
        select_language: 'Chọn ngôn ngữ',
      },
    },
    contents: {
      title: 'Nội dung',
      editor: {
        title: 'Trình chỉnh sửa',
        use_draft_backup: {
          switch_label: 'Tự động sao lưu bản nháp mục',
        },
        close_on_save: {
          switch_label: 'Đóng trình chỉnh sửa sau khi lưu bản nháp',
        },
        close_with_escape: {
          switch_label: 'Đóng trình chỉnh sửa bằng phím Escape',
        },
      },
    },
    i18n: {
      title: 'Quốc tế hóa',
      translators: {
        default: {
          title: 'Dịch vụ dịch mặc định',
          select_service: 'Chọn dịch vụ',
        },
        api_keys: {
          title: 'Khóa API dịch vụ dịch',
          description: 'Quản lý khóa API cho các <a>dịch vụ dịch</a>.',
        },
        field_label: 'Khóa {service}',
        description:
          'Đăng ký <a {homeHref}>{service}</a> và nhập <a {apiKeyHref}>khóa API của bạn</a> tại đây để bật tính năng dịch nhanh các trường nhập văn bản.',
      },
    },
    media: {
      title: 'Phương tiện',
      stock_photos: {
        api_keys: {
          title: 'Khóa API dịch vụ ảnh kho',
          description: 'Quản lý khóa API cho các <a>dịch vụ ảnh kho</a>.',
        },
        field_label: 'Khóa API {service}',
        description:
          'Đăng ký <a {homeHref}>{service} API</a> và nhập <a {apiKeyHref}>khóa API của bạn</a> tại đây để chèn ảnh kho miễn phí vào các trường nhập hình ảnh.',
        credit: 'Ảnh được cung cấp bởi {service}',
      },
      cloud_storage: {
        api_keys: {
          title: 'Khóa API dịch vụ lưu trữ đám mây',
          description: 'Quản lý khóa API cho các <a>dịch vụ lưu trữ đám mây</a>.',
        },
        field_label: 'Khóa API {service}',
      },
      libraries_disabled: 'Các thư viện phương tiện bên ngoài đã bị quản trị viên tắt.',
    },
    accessibility: {
      title: 'Khả năng truy cập',
      underline_links: {
        title: 'Gạch chân liên kết',
        description: 'Hiển thị gạch chân cho các liên kết trong bản xem trước mục và các nhãn giao diện người dùng.',
        switch_label: 'Luôn gạch chân liên kết',
      },
    },
    advanced: {
      title: 'Nâng cao',
      beta: {
        title: 'Tính năng Beta',
        description: 'Bật một số tính năng beta có thể không ổn định hoặc chưa được bản địa hóa.',
        switch_label: 'Tham gia chương trình Beta',
      },
      developer_mode: {
        title: 'Chế độ nhà phát triển',
        description:
          'Bật một số tính năng dành cho nhà phát triển, bao gồm nhật ký bảng điều khiển chi tiết và menu ngữ cảnh gốc.',
        switch_label: 'Bật chế độ nhà phát triển',
      },
      deploy_hook: {
        title: 'Deploy Hook',
        description:
          'Nhập một URL webhook sẽ được gọi khi bạn kích hoạt triển khai thủ công bằng cách chọn Xuất bản Thay đổi. Bạn có thể để trống nếu đang sử dụng GitHub Actions.',
        url: {
          field_label: 'URL Hook',
          saved: 'URL Hook đã được lưu.',
          removed: 'URL Hook đã được gỡ bỏ.',
        },
        auth: {
          field_label: 'Tiêu đề Authorization (ví dụ: Bearer <token>) (tùy chọn)',
          saved: 'Tiêu đề Authorization đã được lưu.',
          removed: 'Tiêu đề Authorization đã được gỡ bỏ.',
        },
      },
    },
  },

  // Keyboard shortcuts
  keyboard_shortcuts_: {
    view_content_library: 'Xem thư viện nội dung',
    view_asset_library: 'Xem thư viện tài nguyên',
    search: 'Tìm kiếm mục và tài nguyên',
    create_entry: 'Tạo một mục mới',
    save_entry: 'Lưu một mục',
    cancel_editing: 'Hủy chỉnh sửa mục',
  },

  // File types
  file_type_labels: {
    avif: 'Hình ảnh AVIF',
    bmp: 'Hình ảnh Bitmap',
    gif: 'Hình ảnh GIF',
    ico: 'Biểu tượng',
    jpeg: 'Hình ảnh JPEG',
    jpg: 'Hình ảnh JPEG',
    png: 'Hình ảnh PNG',
    svg: 'Hình ảnh SVG',
    tif: 'Hình ảnh TIFF',
    tiff: 'Hình ảnh TIFF',
    webp: 'Hình ảnh WebP',
    avi: 'Video AVI',
    m4v: 'Video MP4',
    mov: 'Video QuickTime',
    mp4: 'Video MP4',
    mpeg: 'Video MPEG',
    mpg: 'Video MPEG',
    ogg: 'Video Ogg',
    ogv: 'Video Ogg',
    ts: 'Video MPEG',
    webm: 'Video WebM',
    '3gp': 'Video 3GPP',
    '3g2': 'Video 3GPP2',
    aac: 'Âm thanh AAC',
    mid: 'MIDI',
    midi: 'MIDI',
    m4a: 'Âm thanh MP4',
    mp3: 'Âm thanh MP3',
    oga: 'Âm thanh Ogg',
    opus: 'Âm thanh OPUS',
    wav: 'Âm thanh WAV',
    weba: 'Âm thanh WebM',
    csv: 'Bảng tính CSV',
    doc: 'Tài liệu Word',
    docx: 'Tài liệu Word',
    odp: 'Bản trình chiếu OpenDocument',
    ods: 'Bảng tính OpenDocument',
    odt: 'Văn bản OpenDocument',
    pdf: 'Tài liệu PDF',
    ppt: 'Bản trình chiếu PowerPoint',
    pptx: 'Bản trình chiếu PowerPoint',
    rtf: 'Tài liệu Rich text',
    xls: 'Bảng tính Excel',
    xlsx: 'Bảng tính Excel',
    html: 'Văn bản HTML',
    js: 'JavaScript',
    json: 'Văn bản JSON',
    md: 'Văn bản Markdown',
    toml: 'Văn bản TOML',
    yaml: 'Văn bản YAML',
    yml: 'Văn bản YAML',
  },

  // file size units
  file_size_units: {
    b: '{size} byte',
    kb: '{size} KB',
    mb: '{size} MB',
    gb: '{size} GB',
    tb: '{size} TB',
  },
};
