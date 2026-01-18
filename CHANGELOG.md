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
