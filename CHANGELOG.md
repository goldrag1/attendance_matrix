## v2.0.24
- **Một ô chấm công không còn đẻ ra hai phiếu** (vé FB-2026-00030). Lưới tự lưu sau MỖI phím gõ và bản cũ không có chốt nào, nên một phiên bắn `save_matrix_bulk` 4 lượt trong 40 ms rồi 5 lượt nữa 15 giây sau — cùng payload; máy chủ xử song song rồi tạo hai phiếu ĐÃ DUYỆT cho cùng (nhân viên, ngày), lượt đi sau ăn `TimestampMismatchError`. Đo prod 04/09/2026: 967/1036 lượt lưu (93%) nằm trong 207 chùm cùng-một-giây; 48 ô đang mang 2 phiếu (101 dòng, 53 dòng thừa, 14 ô mâu thuẫn trạng thái).
- **Chốt đặt ở CẢ hai phía.** Giao diện: đang lưu thì không bắn lượt mới, các ô sửa trong lúc chờ được gộp và gửi MỘT lượt sau (không phải debounce — debounce vẫn cho hai lượt chồng khi mạng chậm), và chỉ bỏ dấu bẩn của đúng những ô đã gửi. Máy chủ: mỗi ô xếp hàng bằng khoá tên MariaDB, tra ô bằng đọc-khoá `SELECT … FOR UPDATE` (đọc thường trả ảnh chụp cũ vì cơ sở dữ liệu chạy REPEATABLE-READ), mỗi ô là một giao dịch riêng nên không ôm khoá dòng sang ô sau (đây là thứ gây "Deadlock found" khi thử bản vá chỉ có đọc-khoá).
- **Lưu lại cùng một giá trị = KHÔNG LÀM GÌ.** Trước đây mỗi lượt trùng đều huỷ + xoá + tạo lại phiếu — chính vòng đó đẻ ra phiếu trùng và ném lỗi vào lượt đi sau.
- **Tự kiểm trùng thay cho kiểm trùng của HRMS.** Mọi đường ghi vẫn cần `ignore_validate` để lách `validate_status` gắn cứng, mà cờ đó tắt luôn `validate_duplicate_record`; nay chính hàm lưu tra và gom phiếu trùng của ĐÚNG ô đang ghi.
- **Chấm theo giờ** đi cùng một luật (đọc-khoá + không đổi thì không ghi). Prod đo được 0 nhật ký giờ trùng — chốt này để cửa thứ hai không mở lại lỗ vừa bịt.
- **Không đụng dữ liệu lịch sử.** 53 dòng thừa để chủ đầu tư rà tay; `scripts/liet_ke_cham_cong_trung.py` liệt kê từng cặp (chỉ đọc, không sửa gì).
- **Test hồi quy**: `attendance_matrix/tests/test_cham_cong_trung.py` (3 ca, có ca chạy HAI lượt lưu song song thật) + `attendance_matrix/tests/test_chot_luu_client.mjs` (chốt đang-bay phía giao diện, chạy bằng node).

## v2.0.23
- **Sửa lỗi không sửa được ô đã chấm**: người có vai HR nhưng bị User Permission bó vào nhân viên của chính mình (HR tự sinh cho mọi nhân viên) thì TẠO được ô trống cho người khác nhưng SỬA/XOÁ ô đã chấm lại báo lỗi — do cancel()/delete() thiếu ignore_permissions trong khi mọi thao tác ghi khác đều có. Đo trên prod: 93 lần lưu hỏng, 18 người thuộc diện ảnh hưởng. Không mất dữ liệu (0 ngày công bị treo).
- **Thông báo lỗi đọc được**: hộp thoại "Lưu thất bại" trước đây hiện "undefined (undefined): undefined" vì nhánh lỗi trả về chuỗi trong khi giao diện đọc theo đối tượng; log cũng rỗng vì PermissionError không có nội dung. Nay nêu rõ nhân viên, ngày và lý do.
- **Chặn chấm công cho mã nhân viên không tồn tại**: bản ghi được ghi với ignore_validate nên Frappe không kiểm tra link, một mã bịa ra vẫn tạo được phiếu.
- **Test hồi quy**: thêm attendance_matrix/tests/test_matrix_save_permissions.py (4 test).

## v2.0.22
- **Sửa lỗ hổng phân quyền chấm công (fail-closed)**: trước đây nhân viên không thuộc HR và không có User Permission phòng vẫn xem + chấm công được cho toàn bộ nhân viên (get_permitted_departments trả None = toàn quyền). Nay: chỉ System Manager / HR Manager / HR User (toàn công ty) hoặc người có User Permission phòng (theo phòng) mới chấm được; còn lại bị chặn (lưới rỗng + chặn lưu).

## v2.0.21
- **Chấm theo giờ**: Thêm chế độ "Chấm theo giờ" (cạnh Điểm danh, Tăng ca) để nhập số giờ làm mỗi ngày, lưu độc lập trong Nhật ký chấm công theo giờ (không ảnh hưởng công / giờ chuẩn / lương). Thêm cột "Tổng chấm theo giờ" hiển thị ở cả chế độ Điểm danh và Chấm theo giờ. Xuất Excel có thêm sheet riêng cho giờ từng ngày.

## v2.0.20
- **License**: Gỡ bỏ toàn bộ cơ chế kiểm tra giấy phép qua server từ xa. App hoạt động độc lập, không gọi đến server bên ngoài.

## v2.0.19
- **System**: Tắt chế độ ghi log debug để làm sạch hệ thống sau khi đã fix xong lỗi nhập liệu Tăng ca.

## v2.0.18
- **Overtime Fix**: Hỗ trợ nhập liệu Tăng ca dùng dấu cách thay vì dấu hai chấm (Ví dụ: "HP 1" thay vì "HP: 1").

## v2.0.17
- **Debug**: Bật tính năng ghi log chi tiết khi lưu Tăng ca để kiểm tra lỗi mất dữ liệu. (Xem trong Error Log).

## v2.0.16
- **Overtime**: Cải thiện logic nhập liệu Tăng ca. Bây giờ nếu bạn chỉ nhập số (ví dụ: "2") mà không cần gõ mã (ví dụ: "OT1: 2"), hệ thống sẽ tự động hiểu là loại tăng ca đầu tiên trong cấu hình.

## v2.0.15
- **Settings**: Sửa lỗi không lưu vị trí sắp xếp trong bảng Cấu hình. Bây giờ hệ thống sẽ ghi nhớ chính xác thứ tự bạn đã kéo thả.

## v2.0.14
- **System**: Tắt các patch cũ (v1.8.0, v1.8.1) gây lỗi ModuleNotFoundError khi chạy migrate trên một số môi trường server.

## v2.0.13
- **Fix**: Sửa lỗi "Lưu ảo" trong chế độ Tăng ca (Overtime). Hệ thống giờ đây sẽ bỏ qua các validation chặt chẽ của Attendance khi lưu log tăng ca, đảm bảo dữ liệu được ghi nhận thành công vào Database.

## v2.0.12
- **Settings**: Sửa lỗi giao diện nút "Update to v..." không hiển thị trong bản cập nhật trước. Giờ đây nút đỏ sẽ xuất hiện đúng như mô tả khi có bản cập nhật mới.

## v2.0.11
- **System**: Cải thiện logic kiểm tra cập nhật. Hệ thống giờ đây sẽ so sánh phiên bản một cách thông minh (Semantic Versioning), tránh trường hợp báo "Có bản cập nhật" khi phiên bản local thực tế mới hơn remote (do cache GitHub chưa kịp cập nhật).

## v2.0.10
- **Settings**: Thêm nút **"Update to v..."** màu đỏ nổi bật ngay trên đầu trang khi phát hiện bản cập nhật mới. Người dùng chỉ cần bấm 1 click để cập nhật, không cần tìm kiếm nút ẩn.

## v2.0.9
- **Settings**: Hiển thị phiên bản hiện tại (Current Version) và trạng thái cập nhật (Update Available) ngay trên đầu trang **Attendance Matrix Settings**. Giúp người quản trị dễ dàng theo dõi và cập nhật ứng dụng kể cả khi trang chính bị lỗi.

## v2.0.8
- **Hotfix**: Sửa lỗi "Trắng trang" do xung đột khi load file CSS có chứa query string. Vui lòng **Hard Reload (Ctrl + Shift + R)** để thấy thay đổi mới nhất về scrollbar.

## v2.0.7
- **System**: Force reload file CSS để áp dụng thay đổi thanh cuộn ngay lập tức (tránh cache trình duyệt).

## v2.0.6
- **UI/UX**: Tiếp tục tăng kích thước thanh cuộn lên **35px** (theo yêu cầu) để tối đa hóa khả năng tương tác.

## v2.0.5
- **UI/UX**: Cải thiện thanh cuộn (Scrollbar) cho to rõ hơn (20px) và đậm màu hơn (#888) theo yêu cầu, giúp thao tác kéo thả dễ dàng hơn.

## v2.0.4
- **UI/UX**: Fix triệt để lỗi "Double Scrollbar" (2 thanh cuộn) bằng cách ẩn thanh cuộn của trình duyệt (`overflow: hidden`) khi đang ở trang chấm công.
- **UI/UX**: Tinh chỉnh chiều cao bảng chấm công (`100vh - 60px`) để vừa khít với header của hệ thống, loại bỏ khoảng trắng thừa.

## v2.0.3
- **UI/UX**: Fix lỗi giao diện "tràn màn hình" (Sidebar bị che khuất) ảnh hưởng tới các trang khác của ERPNext.
- **UI/UX**: Tối ưu hóa chiều cao bảng chấm công, loại bỏ scrollbar thừa của trình duyệt, giúp thao tác mượt mà hơn.

## v2.0.2
- **Fix**: Sửa lỗi "Lưu ảo" trong cấu hình. Hệ thống sẽ báo lỗi và ngăn không cho lưu nếu người dùng chưa nhập đủ tên hoặc tên viết tắt cho các mục cấu hình (Trạng thái, Tăng ca), tránh việc dữ liệu bị mất do validate bên server.

## v2.0.1
- **Fix**: Sửa lỗi bộ lọc nhân viên (Filter by Employee). Giờ đây search sẽ tìm cả trong ID (name) và Tên nhân viên (employee_name), khắc phục lỗi không tìm thấy người nếu ID khác tên.
- **UX**: Cải thiện giao diện Cấu hình (Settings):
    - Thêm thanh cuộn (Scrollbar) cho các bảng danh sách dài.
    - Hỗ trợ Kéo & Thả (Drag & Drop) để sắp xếp thứ tự các trạng thái, ca làm việc và mã tăng ca.
    - Tự động ghi nhớ thứ tự sắp xếp.

## v2.0
- **Major Feature**: Hỗ trợ toàn diện tính năng **Chấm công tăng ca (Overtime)**:
    - Bổ sung view "Overtime" riêng biệt với cột "Kiểu tăng ca" thay thế cho cột "Ca".
    - Nhập liệu thông minh: Hỗ trợ nhập "Viết tắt + Số lượng" (VD: "PT 5" -> "PT: 5") hoặc tự động nhận diện kiểu khi nhập số.
    - Auto-detection: Tự động phát hiện trạng thái "Hỗn hợp" (Mixed) nếu một người có nhiều kiểu tăng ca trong cùng một ngày.
- **Legacy Support**:
    - **Overtime**: Hệ thống tự động quét và hiển thị các kiểu tăng ca cũ (đã bị đổi tên hoặc xóa khỏi cấu hình) trong cả giao diện lưới và file Excel, đảm bảo không mất dữ liệu lịch sử.
    - **Attendance**: Tương tự, tự động phát hiện và hiển thị các trạng thái chấm công cũ trong cột tổng hợp.
- **Excel Export**: Xuất file Excel thông minh, tự động thay đổi cột theo view (Chấm công / Tăng ca) và bao gồm đầy đủ các cột tổng hợp (bao gồm cả dữ liệu Legacy).
- **UI/UX**:
    - Cải thiện độ tương phản nút chuyển đổi View (Xanh / Đỏ) để dễ nhận biết.
    - Fix lỗi màn hình trắng khi tải trang (do lỗi cú pháp template).
- **i18n**: Chuẩn hóa toàn bộ bản dịch tiếng Anh - tiếng Việt cho các tính năng mới (Mixed, Legacy Data, Overtime Codes...).

## v1.7.6
- **System**: Cải thiện logic tìm kiếm lệnh `bench` khi cập nhật. Hệ thống sẽ tự động tìm trong thư mục `env` của dự án nếu không tìm thấy trong biến môi trường (Khắc phục lỗi "Asset build skipped" trên một số server).

## v1.7.5
- **Fix**: Sửa lỗi 500 khi xuất Excel (do thiếu cấu hình màu).
- **Fix**: Sửa lỗi JavaScript khi bật tắt cột hiển thị.
- **Feature**: Bổ sung màu nền cho các cột tổng hợp trong file Excel (đồng bộ với giao diện).

## v1.7.4
- **i18n**: Chuẩn hóa ngôn ngữ UI (Show Abbreviations, Fullscreen, Reset Filters) sang tiếng Anh làm gốc và bổ sung bản dịch tiếng Việt tương ứng.

## v1.7.3
- **i18n**: Bổ sung dịch tiếng Việt cho checkbox "Chỉ hiện nhân viên đang làm việc".

## v1.7.2
- **Feature**: Bổ sung bộ lọc "Chỉ hiện nhân viên đang làm việc" (Mặc định: Bật).
    - Khi BẬT: Chỉ hiển thị nhân viên có trạng thái Active.
    - Khi TẮT: Hiển thị tất cả nhân viên (bao gồm đã nghỉ việc, tạm nghỉ...), đồng thời hiển thị thêm cột "Status" trong bảng để phân biệt.
- **UI**: Cập nhật menu "Show" (Hiển thị) gom nhóm các tùy chọn hiển thị cột và bộ lọc.

## v1.7.1
- **Fix**: Sửa lỗi màn hình trắng khi tải trang (do lỗi cú pháp Vue template trong phần switch hiển thị viết tắt).
- **Docs**: Cập nhật README thêm hướng dẫn sửa lỗi phân quyền (chown).

## v1.7.0
- **Feature**: Bổ sung chế độ "Hiển thị viết tắt" (Toggle):
    - Khi BẬT: Các ô chấm công hiển thị mã viết tắt (VD: 1, 1/2) thay vì tên đầy đủ. Áp dụng cho cả giao diện và xuất Excel.
    - Khi TẮT: Hiển thị tên đầy đủ như cũ.
- **UX**: Cột tổng hợp cuối bảng giờ hiển thị Tên đầy đủ của trạng thái thay vì viết tắt.
- **System**: Đổi tên file thư viện `ag-grid.css` thành `ag-grid-custom.css` để khắc phục lỗi phân quyền.

## v1.6.10
- **System**: Đổi tên file thư viện `ag-grid.css` thành `ag-grid-custom.css` để khắc phục triệt để lỗi phân quyền (Permission Denied) khi update trên các máy chủ mà file cũ bị chiếm quyền bởi root.
- **System**: Loại bỏ các file css cũ khỏi code nguồn.

## v1.6.9
- **System**: Cải thiện thuật toán Autoupdate - tải code theo commit SHA mới nhất để tránh cache của GitHub (đảm bảo code luôn mới nhất thay vì bị trễ vài tiếng).
- **System**: Tăng thời gian chờ và bắt buộc chạy lệnh `bench build` khi update.

## v1.6.8
- **UX**: Popup lỗi giờ hiển thị chi tiết đầy đủ (Nhân viên, Ngày, Lỗi) thay vì chỉ nói "xem console".

## v1.6.7
- **UX**: Khi nhập trạng thái không hợp lệ, hiển thị thông báo rõ ràng liệt kê các giá trị hợp lệ thay vì lỗi quyền truy cập khó hiểu.

## v1.6.6
- **Permission**: Dropdown Công ty giờ chỉ hiển thị công ty có phòng ban được phép.
- **Permission**: Danh sách nhân viên cho tìm kiếm cũng được lọc theo phòng ban được phép.

## v1.6.5
- **Fix**: Badge phân quyền giờ hiển thị đúng tên phòng ban thay vì "Tất cả các phòng ban".
- **Fix**: Dropdown Phòng ban giờ chỉ hiển thị các phòng ban mà người dùng được phép.

## v1.6.4
- **Permission Change**: Chỉ System Manager và HR Manager có toàn quyền. HR User giờ phải dùng User Permission theo Department để giới hạn phạm vi xem.

## v1.6.3
- **Permission Fix**: Thêm role "All" vào Page Permission, cho phép tất cả người dùng đã đăng nhập có thể mở trang Attendance Matrix (phân quyền Department vẫn hoạt động bình thường).
- **UI**: Đổi badge phân quyền sang màu hồng nhẹ nhàng.

## v1.6.2
- **Critical Fix**: Bổ sung lệnh `bench build` vào quy trình cập nhật tự động. Đảm bảo các file JS/CSS được rebuild đúng cách sau khi update.

## v1.6.1
- **UI Enhancement**: Hiển thị badge phân quyền bên cạnh số lượng nhân viên (🔓 All Departments hoặc 🔒 Tên phòng ban). Giúp người dùng biết rõ quyền của mình.

## v1.6.0
- **New Feature**: Phân quyền theo Phòng ban (Department-based permissions). Người dùng chỉ có thể xem và chỉnh sửa chấm công cho nhân viên thuộc phòng ban mà họ được phép. Sử dụng User Permission của ERPNext.
- **Documentation**: Thêm tài liệu hướng dẫn phân quyền song ngữ Anh-Việt (`docs/USER_PERMISSIONS_GUIDE.md`).

## v1.5.13

## v1.5.12
- **Major Fix**: Thay thế hoàn toàn thư viện `requests` bằng `urllib` (Built-in Python). Đảm bảo tương thích với mọi cấu hình Server/Proxy mà không phụ thuộc vào thư viện bên thứ 3.

## v1.5.11
- **Critical Fix**: Chuyển hoàn toàn sang GET request để kiểm tra License. Loại bỏ triệt để lỗi HTTP 417 gây ra bởi `Expect` header và các cấu hình Proxy/Nginx chặt chẽ.

## v1.5.10
- **Network Fix**: Chuyển đổi phương thức gửi dữ liệu License sang Form Data (thay vì JSON) và vô hiệu hóa Header "Expect" để tránh lỗi HTTP 417 trên một số Server Proxy/Nginx cấu hình chặt chẽ.

## v1.5.9
- **Compatibility**: Tự động xử lý lỗi HTTP 417. Nếu Server License chưa cập nhật kịp, Client sẽ tự động chuyển sang chế độ tương thích (không gửi thông tin version) để đảm bảo kết nối luôn thông suốt.

## v1.5.8
- **Debug**: Hiển thị chi tiết lý do lỗi License ngay trên thông báo (Popup) để Admin dễ dàng xử lý (VD: HTTP 404, Unauthorized, Timeout...). Cập nhật đường dẫn API License chính xác hơn.

## v1.5.7
- **Improvement**: Tăng thời gian chờ kiểm tra License (Timeout) lên 10s. Ghi log chi tiết lỗi nếu kiểm tra thất bại để dễ dàng debug.

## v1.5.6
- **Realtime Check**: Bỏ hoàn toàn Cache khi xác thực thất bại. Hệ thống sẽ kiểm tra (và ghi log) mỗi lần truy cập nếu License chưa được kích hoạt, giúp Admin nắm bắt tình hình ngay lập tức.

## v1.5.5
- **Optimization**: Giảm thời gian Cache khi Check License thất bại xuống còn 1 giờ (thay vì 24h). Giúp client cập nhật trạng thái nhanh hơn nếu mới mua License.

## v1.5.4
- **Security Fix**: Giới hạn phạm vi kiểm tra License. Chỉ chặn truy cập khi vào "Attendance Matrix", không khóa toàn bộ ERPNext.

## v1.5.3
- **Security**: Tăng cường bảo mật License. Tích hợp kiểm tra License sâu vào trong logic ứng dụng (tránh việc bypass bằng cách tắt hook).

## v1.5.2
- **Hotfix**: Sửa lỗi "Vue Compile Error" do xung đột dấu nháy đơn / kép.

## v1.5.1
- **Bug Fix**: Sửa lỗi "Trắng trang" do vấn đề cú pháp file JS.
- **i18n**: Dịch hoàn thiện nút "Chấm công nhanh" và các tiêu đề bảng.
- **Translations**: Khôi phục đầy đủ file dịch `vi.csv` (sửa lỗi mất dòng).

## v1.5.0
- **Internationalization (i18n)**: 
    - Full English codebase. (Mã nguồn chuẩn Tiếng Anh).
    - Added Vietnamese Translation (`vi.csv`). (Hỗ trợ song ngữ Anh-Việt).
    - Auto-detects user language preference. (Tự động nhận diện ngôn ngữ người dùng).

## v1.4.3
- **Test Zip Update**: Kiểm thử cơ chế cập nhật mới (Zip Download) không phụ thuộc Git.
- **Frontend**: Log "v1.4.3 (Zip) Loaded Successfully".
- **Backend**: Update tag "v1.4.3 (Zip) Loaded".

## v1.4.2
- **Test Auto-Update**: Lần kiểm tra cuối cùng sau khi fix quyền hạn (Permissions).
- **Frontend**: Log "v1.4.2 Loaded Successfully".
- **Backend**: Update tag "v1.4.2 Loaded".

## v1.4.1
- **Kiểm thử cập nhật**: Phiên bản kiểm tra tính năng tự động kéo code (Backend & Frontend).
- **Frontend**: Thêm Log kiểm tra "v1.4.1 Loaded".
- **Backend**: Update comment kiểm tra file Python.

## v1.4
- **Giao diện**: Sửa lỗi hiển thị phiên bản bị thừa chữ "v" (ví dụ `vv1.3`).
- **Thông báo**: Sửa lỗi popup thông báo xuất hiện 2 lần.
- **Hiệu năng**: Tối ưu hóa logic kiểm tra cập nhật.

## v1.3
- **Quản lý License**: Gửi thông tin phiên bản lên server để theo dõi.
- **Giao diện**: Hiển thị badge phiên bản ngay cạnh tiêu đề.
- **Cập nhật**: Sửa lỗi logic gửi dữ liệu và cải thiện popup thông báo.
