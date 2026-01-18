# Attendance Matrix / Bảng Chấm Công

Excel-like Attendance Management for ERPNext v15.
*(Quản lý chấm công dạng bảng tính Excel cho ERPNext v15)*

## Installation / Cài đặt

### 1. Get the App / Tải ứng dụng
```bash
bench get-app https://github.com/goldrag1/attendance_matrix
```

### 2. Install on Site / Cài vào Site
```bash
bench --site [your-site-name] install-app attendance_matrix
```

### 3. Migrate (Optional but recommended)
```bash
bench migrate
```

### 4. Important: Installation Best Practices / Lưu ý Quan trọng
To ensure the **Auto-Update** feature works correctly without permission errors:
*(Để tính năng **Tự động Cập nhật** hoạt động ổn định và không bị lỗi quyền hạn)*:

1.  **NEVER** run `bench` commands as `root`.
    *(**KHÔNG BAO GIỜ** chạy lệnh `bench` dưới quyền `root`)*.
2.  **ALWAYS** login as `frappe` (or `frappeuser`) before running `bench get-app`.
    *(**LUÔN LUÔN** đăng nhập bằng user `frappe` hoặc `frappeuser` trước khi chạy lệnh cài đặt)*.
    - This ensures all files are owned by the correct user, allowing the app to update itself smoothly.
    *(Điều này đảm bảo mọi file tải về thuộc quyền sở hữu đúng, giúp ứng dụng tự cập nhật mượt mà)*.

## Usage / Hướng dẫn sử dụng

1.  **Quick Access**: Go to the **Attendance** list view and click the **"Chấm công nhanh"** button.
    *(**Truy cập nhanh**: Vào danh sách **Attendance** và bấm nút **"Chấm công nhanh"**)*.
2.  **Direct Link**: Navigate to `/app/attendance-matrix` in your browser.
    *(**Link trực tiếp**: Truy cập đường dẫn `/app/attendance-matrix` trên trình duyệt)*.
