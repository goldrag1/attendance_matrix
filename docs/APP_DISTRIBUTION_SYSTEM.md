# HỆ THỐNG QUẢN LÝ VERSION & LICENSE (App Distribution System)

Tài liệu này mô tả kiến trúc và cách triển khai hệ thống quản lý bản quyền (License) và tự động cập nhật (Auto-Update) cho các Custom App (như `attendance_matrix`).

---

## 1. Kiến trúc Tổng quan

Hệ thống hoạt động theo mô hình **Client-Server**:
*   **License Server (LMS):** Là một Frappe App (`licence_manager`) đặt tại server trung tâm. Quản lý danh sách khách hàng, tên miền được phép truy cập và phiên bản họ đang dùng.
*   **Client App:** Là ứng dụng cài tại máy khách hàng. Tự động kiểm tra license và tải cập nhật từ GitHub.

### 1.1. Yêu cầu Hệ thống (Prerequisites)
Để tính năng "Smart Update" hoạt động, server của khách hàng **bắt buộc phải cài đặt Git**.
*   Hầu hết các server chạy Frappe/ERPNext đều đã cài sẵn Git (vì `bench` cần Git để hoạt động).
*   Nếu chưa có, cần cài đặt: `sudo apt-get install git`.

---

## 2. Server Side (`licence_manager`)

Đây là app quản lý tập trung. Cần cài đặt trên `erp.minionapp.fun` (hoặc server quản lý của bạn).

### 2.1. Cấu trúc App
*   **DocType:** `LMS License`
    *   `domain` (Data): Tên miền khách hàng (VD: `erp.khachhang.com`).
    *   `app_name` (Data): Tên app (VD: `attendance_matrix`).
    *   `status` (Select): `Active`, `Inactive`, `Expired`.
    *   `current_version` (Data, Read Only): Phiên bản hiện tại của khách.
    *   `last_checked` (Datetime, Read Only): Lần cuối online.
*   **API:** `licence_manager.api.validate_domain(domain, app_name, version)`

### 2.2. API Validation Logic
Khi Client gọi API này, Server sẽ:
1.  Kiểm tra cặp `domain` + `app_name` có tồn tại và `status="Active"` không.
2.  Cập nhật `current_version`, `last_checked`, `server_ip` vào License để tracking.
3.  Trả về `Active` hoặc `Inactive`.

---

## 3. Client Side (Custom App)

Để tích hợp hệ thống này vào một App mới, bạn cần thêm các file sau:

### 3.1. Backend (`utils/updates.py`)
File này quản lý việc tương tác với Git.
*   **Chức năng:**
    *   `check_for_updates()`: So sánh git hash local (HEAD) với remote (origin/main). Đọc file `CHANGELOG.md` từ server.
    *   `perform_update()`: Chạy lệnh `git pull` và `bench migrate`.
    *   **Tự động sửa lỗi Git:** Nếu thư mục app chưa là git repo (thường gặp khi cài thủ công), nó sẽ tự `git init` và add remote.

### 3.2. License Check (`license.py`)
File này chạy nền để kiểm tra bản quyền.
*   **Logic:**
    *   Gửi request đến License Server kèm theo `domain`, `app_name` và `version` (lấy từ git hash).
    *   Lưu kết quả vào Cache (24h) để tránh spam request.
    *   Nếu License `Inactive`, chặn truy cập các trang quan trọng.

### 3.3. Frontend (JS)
Tích hợp vào nút "Update" trên giao diện.
*   **Hiển thị:**
    *   Badge phiên bản (VD: `v7a9e904`) hiện cạnh tiêu đề trang.
    *   Màu đỏ = Có update mới.
*   **Popup:** Gọi `check_for_updates` để lấy nội dung `CHANGELOG.md` và hiển thị cho người dùng xem trước khi bấm nút cập nhật.

---

## 4. Quy trình Phát hành (Release Workflow)

Khi bạn muốn ra mắt tính năng mới cho khách hàng:

1.  **Code & Test:** Hoàn thiện tính năng trên máy Local.
2.  **Viết Changelog:**
    *   Mở file `CHANGELOG.md` trong thư mục gốc của App.
    *   Thêm nội dung phiên bản mới lên đầu file (theo format Markdown):
        ```markdown
        ## Phiên bản Mới (vX.Y)
        - Tính năng: ...
        - Sửa lỗi: ...
        ```
3.  **Deploy:**
    *   Commit code: `git commit -m "..."`.
    *   Push lên GitHub: `git push origin main`.
4.  **Tự động hóa:**
    *   Khách hàng mở App -> Thấy Badge đỏ.
    *   Bấm Badge -> Thấy nội dung bạn vừa viết trong `CHANGELOG.md`.
    *   Bấm "Cập nhật" -> App tự tải code mới về.

---

## 5. Security Note
*   Hệ thống hiện tại dựa trên mã nguồn mở (Open Source).
*   Để bảo mật logic check license, cần thực hiện **Code Obfuscation** (làm rối mã) hoặc biên dịch thành **Cython** (.so) trước khi bàn giao cho khách hàng rành công nghệ.
