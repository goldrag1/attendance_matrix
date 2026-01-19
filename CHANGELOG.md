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
