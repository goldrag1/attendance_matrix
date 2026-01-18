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

### 1.2. Lưu ý quan trọng khi cài đặt (Installation Best Practices)
Để tránh hoàn toàn lỗi "Permission Denied" ngay từ đầu, khi cài đặt App mới bằng `bench get-app`, bạn **BẮT BUỘC** phải tuân thủ nguyên tắc:

1.  **KHÔNG BAO GIỜ** chạy lệnh `bench` với quyền `root` (dù `bench` cũng thường chặn việc này).
2.  **LUÔN LUÔN** đăng nhập bằng user `frappe` (hoặc `frappeuser`) để chạy lệnh install.
    *   Khi đó, mọi file code tải về sẽ tự động thuộc quyền sở hữu của `frappeuser`.
    *   Hệ thống Auto-Update sẽ hoạt động ngay lập tức mà không cần chạy lệnh `chown` sửa lỗi.

---
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
    *   Thêm nội dung phiên bản mới lên đầu file.
3.  **Tạo Version Tag (Quan trọng):**
    *   Để hiển thị số phiên bản đẹp (VD: `v1.2`) thay vì mã số ngẫu nhiên (`7a9e904`), bạn cần tạo Tag:
        ```bash
        git tag v1.2
        git push origin v1.2
        ```
    *   Nếu không tạo Tag, hệ thống sẽ tự động dùng mã Hash (VD: `7a9e904`) để hiển thị.
4.  **Deploy Code:**
    *   Commit code: `git commit -m "Release v1.2"`.
    *   Push lên GitHub: `git push origin main`.
5.  **Tự động hóa:**
    *   Khách hàng mở App -> Thấy Badge `v1.2` (hoặc `v1.2-1-g...` nếu có commit mới sau tag).
    *   Khách hàng mở App -> Thấy Badge đỏ.
    *   Bấm Badge -> Thấy nội dung bạn vừa viết trong `CHANGELOG.md`.
    *   Bấm "Cập nhật" -> App tự tải code mới về.

> [!IMPORTANT]
> **Lưu ý về Cập nhật:**
> *   **Javascript/HTML/CSS**: Thường có hiệu lực ngay sau khi khách hàng reload trình duyệt (Ctrl + Shift + R).
> *   **Python (Backend)**: Code Python được Server load vào RAM khi khởi động. Do đó, nếu bản cập nhật có sửa file `.py`, khách hàng **cần phải khởi động lại Server** (hoặc chờ hệ thống tự reload nếu có cơ chế supervisor) để code mới có hiệu lực.
> *   **Database**: Nếu có thay đổi cấu trúc bảng, lệnh `bench migrate` (được chạy tự động trong `perform_update`) sẽ xử lý việc này.

---

## 5. Security Note
*   Hệ thống hiện tại dựa trên mã nguồn mở (Open Source).
*   Để bảo mật logic check license, cần thực hiện **Code Obfuscation** (làm rối mã) hoặc biên dịch thành **Cython** (.so) trước khi bàn giao cho khách hàng rành công nghệ.
*   **Lưu ý:** Ngay cả khi dùng file `.so`, quy trình cập nhật **vẫn bắt buộc phải Restart Server** giống như file `.py` (vì file .so cũng được load vào RAM).

## 6. Các hạn chế kỹ thuật (Troubleshooting)

### 6.1. Tại sao Server không tự Restart được?
Tính năng "Tự động Restart" (`bench restart`) có thể thất bại trong các trường hợp sau:
1.  **Production Mode (Supervisor):** Tiến trình Web (Gunicorn) thường chạy với quyền user thường (`frappe`), nhưng lệnh restart service (`supervisorctl restart` hoặc `systemctl restart`) lại cần quyền **root** hoặc cấu hình sudo đặc biệt. Nếu chưa cấu hình quyền này, lệnh sẽ bị từ chối.
2.  **Docker Container:** Trong môi trường Container, việc một process con (web worker) restart process cha (entrypoint) thường bị hạn chế hoặc không được thiết kế để làm vậy.
3.  **Local Development:** Trên Windows, đôi khi tiến trình con Python không thể restart lại tiến trình cha CMD/Powershell đang chạy `bench start`.

**Giải pháp an toàn (Không cần cấu hình):**
Hệ thống đã được lập trình để xử lý tình huống "Không có quyền Restart":
1.  **Vẫn cập nhật code mới**: Code đã được tải về thành công.
2.  **Xóa Cache**: Đảm bảo Giao diện (JS/CSS) cập nhật ngay lập tức.
3.  **Thông báo nhẹ nhàng**: Chỉ nhắc nhở *"Lưu ý: Nếu có lỗi logic Backend..."*
    *   Hầu hết các bản cập nhật nhỏ (sửa giao diện, text) **sẽ chạy ngay** mà không cần restart.
    *   Khách hàng chỉ cần nhờ IT can thiệp khi có bản cập nhật lớn (thay đổi logic tính toán).

### 6.3. Lỗi "Permission Denied" (Không thể cập nhật)
**Hiện tượng**: Báo lỗi `unable to unlink` hoặc `cannot create directory`.
**Nguyên nhân**:
- Do bạn copy file bằng WinSCP với tài khoản `root` (hoặc user khác), nên `frappeuser` không có quyền ghi đè file cũ.
- Thư mục `.git` bị sở hữu bởi user khác.

**Khắc phục**:
Sau khi copy thủ công, **BẮT BUỘC** phải chạy lệnh này trên server để cấp quyền lại cho `frappeuser`:
```bash
sudo chown -R frappeuser:frappeuser /home/frappeuser/frappe-bench/apps/attendance_matrix
```
*(Nếu server của bạn dùng user khác, hãy thay `frappeuser:frappeuser` bằng user tương ứng)*.

### 6.4. Cấu hình nâng cao (Tùy chọn)
Để App có thể tự động restart mà không cần mật khẩu, Admin server cần cấu hình **sudoers**:

1.  **Cách 1:** Kết nối SSH bằng user `root`.
2.  **Cách 2:** Nếu đang ở user `frappe` (hoặc user thường), hãy dùng lệnh:
    ```bash
    sudo visudo
    ```
    *(Nhập mật khẩu sudo của user hiện tại nếu được hỏi)*

3.  Thêm dòng sau vào cuối file:
    ```bash
    frappe ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart all
    ```
4.  Lưu lại. 

Khi đã cấu hình như trên, hệ thống sẽ có thể tự động khởi động lại mượt mà 100%.
