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

### 4. Finalize Permissions / Hoàn tất phân quyền
**(Important / Quan trọng)**
To ensure the **Auto-Update** feature works correctly, you **MUST** set the correct file ownership for your bench.
*(Để tính năng **Tự động Cập nhật** hoạt động ổn định, bạn **PHẢI** thiết lập đúng quyền sở hữu file cho bench của mình)*.

Run this command after installation:
*(Chạy lệnh sau sau khi cài đặt)*:
```bash
sudo chown -R frappeuser:frappeuser /home/frappeuser/frappe-bench
```
*(Note: Replace `frappeuser` with your actual system user if different. / Lưu ý: Thay `frappeuser` bằng user hệ thống thực tế của bạn nếu khác)*.

> **Warning**: Never run `bench` commands as `root`. Always use the `frappe` system user.
> *(**Cảnh báo**: Không bao giờ chạy lệnh `bench` dưới quyền `root`. Luôn sử dụng user hệ thống `frappe`)*.

## Usage / Hướng dẫn sử dụng

1.  **Quick Access**: Go to the **Attendance** list view and click the **"Chấm công nhanh"** button.
    *(**Truy cập nhanh**: Vào danh sách **Attendance** và bấm nút **"Chấm công nhanh"**)*.
2.  **Direct Link**: Navigate to `/app/attendance-matrix` in your browser.
    *(**Link trực tiếp**: Truy cập đường dẫn `/app/attendance-matrix` trên trình duyệt)*.

---

## User Permissions / Phân quyền người dùng

### Permission Levels / Các cấp độ quyền

| Role / Vai trò | Access / Quyền truy cập |
|----------------|-------------------------|
| **System Manager** | Full access / Toàn quyền |
| **HR Manager** | Full access / Toàn quyền |
| **HR User** | Department-based / Theo phòng ban |
| **Other Users** | Department-based / Theo phòng ban |

### How to Set Up / Cách thiết lập

1. Go to **Setup > User Permission**
   *Vào **Thiết lập > User Permission***

2. Add: **Allow = Department**, **For Value = [Department Name]**
   *Thêm: **Cho phép = Department**, **Giá trị = [Tên phòng ban]***

3. Save
   *Lưu*

### Notes / Lưu ý

- Users with no Department User Permission will have **full access**
  *Người dùng không có User Permission cho Department sẽ có **toàn quyền***
- All dropdowns (Company, Department, Employee) are filtered by permission
  *Tất cả dropdown đều được lọc theo quyền*

---

## Troubleshooting / Khắc phục sự cố

### Issue: "AppNotInstalledError" or "TypeError" during install
*(Lỗi: "AppNotInstalledError" hoặc "TypeError" khi cài đặt)*

**Cause**: This is a known bug in Frappe Bench **v5.27.0**. The bench tries to build assets before the app is fully registered.
*(**Nguyên nhân**: Đây là lỗi của Frappe Bench **v5.27.0**. Bench cố gắng build assets trước khi app được đăng ký xong.)*

**Solution A: Update Bench (Recommended)**
*(**Giải pháp A: Cập nhật Bench (Khuyên dùng)**)*
```bash
pip3 install --upgrade frappe-bench
```

**Solution B: Manual Install (If update is not possible)**
*(**Giải pháp B: Cài đặt thủ công (Nếu không thể cập nhật)**)*

1.  Clone the app manually:
    ```bash
    git clone https://github.com/goldrag1/attendance_matrix apps/attendance_matrix
    ```
2.  Install python dependencies:
    ```bash
    ./env/bin/pip install -e apps/attendance_matrix
    ```
3.  Add `attendance_matrix` to `sites/apps.txt`.
4.  Install to site:
    ```bash
    bench --site [your-site-name] install-app attendance_matrix
    ```

### Issue: "You don't have permission for this department"
*(Lỗi: "Bạn không có quyền truy cập phòng ban này")*

**Solution**: Add User Permission for the required Department.
*(**Giải pháp**: Thêm User Permission cho Department cần thiết.)*

### Issue: "Permission Denied" during Auto-Update
*(Lỗi: Không có quyền ghi đè file khi cập nhật tự động)*

**Cause**: Some files might be owned by `root`, preventing `frappeuser` from updating them.
*(**Nguyên nhân**: Một số file thuộc quyền `root`, khiến `frappeuser` không thể ghi đè)*

**Solution**: Run the following command to fix permissions:
*(**Giải pháp**: Chạy lệnh sau để sửa quyền)*
```bash
sudo chown -R frappeuser:frappeuser /home/frappeuser/frappe-bench
```
