# Attendance Matrix - User Permission Guide / Hướng dẫn Phân quyền

## Overview / Tổng quan

The Attendance Matrix app supports **department-based permissions** using ERPNext's built-in User Permission system. This allows you to restrict which employees a user can view and edit.

*Ứng dụng Attendance Matrix hỗ trợ **phân quyền theo phòng ban** sử dụng hệ thống User Permission có sẵn của ERPNext. Điều này cho phép bạn giới hạn nhân viên mà một người dùng có thể xem và chỉnh sửa.*

---

## Permission Levels / Các cấp độ quyền

| Role / Vai trò | Access / Quyền truy cập |
|----------------|-------------------------|
| **System Manager** | Full access to all employees / Toàn quyền truy cập |
| **HR Manager** | Full access to all employees / Toàn quyền truy cập |
| **HR User** | Only employees in permitted departments / Chỉ nhân viên trong phòng ban được phép |
| **Other Users** | Only employees in permitted departments / Chỉ nhân viên trong phòng ban được phép |

---

## How to Set Up Permissions / Cách thiết lập Phân quyền

### Step 1: Go to User Permission / Vào User Permission
1. Navigate to **Setup > User Permission**
   
   *Điều hướng đến **Thiết lập > User Permission***

2. Click **+ Add User Permission**
   
   *Bấm **+ Thêm User Permission***

### Step 2: Configure Permission / Cấu hình quyền
Fill in the following fields / Điền các trường sau:

| Field | Value | Ý nghĩa |
|-------|-------|---------|
| **User** | Select the user | Chọn người dùng |
| **Allow** | Department | Chọn "Department" |
| **For Value** | Select department name | Chọn tên phòng ban |

### Step 3: Save / Lưu
Click **Save** to apply the permission.

*Bấm **Lưu** để áp dụng quyền.*

---

## Example Scenarios / Ví dụ

### Scenario 1 / Trường hợp 1
**User:** attendance_admin@company.com  
**Permission:** Department = "Sales - CON"

**Result / Kết quả:**
- ✅ Can view/edit employees in "Sales - CON"
- ❌ Cannot see employees in other departments

*✅ Có thể xem/sửa nhân viên trong "Sales - CON"*  
*❌ Không thể thấy nhân viên ở phòng ban khác*

### Scenario 2 / Trường hợp 2
**User:** hr_manager@company.com  
**Role:** HR Manager (no User Permission needed)

**Result / Kết quả:**
- ✅ Full access to all employees

*✅ Toàn quyền truy cập tất cả nhân viên*

### Scenario 3 / Trường hợp 3
**User:** supervisor@company.com  
**Permissions:**
- Department = "Production A"
- Department = "Production B"

**Result / Kết quả:**
- ✅ Can view/edit employees in "Production A" and "Production B"

*✅ Có thể xem/sửa nhân viên trong "Production A" và "Production B"*

---

## Troubleshooting / Xử lý sự cố

### Issue: "You don't have permission for this department"
**Cause / Nguyên nhân:**
User is trying to access a department they don't have permission for.

*Người dùng đang cố truy cập phòng ban mà họ không có quyền.*

**Solution / Giải pháp:**
1. Check the user's User Permission settings
2. Add the required department to their permissions

*1. Kiểm tra cài đặt User Permission của người dùng*  
*2. Thêm phòng ban cần thiết vào quyền của họ*

### Issue: "No employees found"
**Cause / Nguyên nhân:**
User has department restrictions but no employees exist in permitted departments.

*Người dùng có giới hạn phòng ban nhưng không có nhân viên nào trong các phòng ban được phép.*

**Solution / Giải pháp:**
1. Verify employees are assigned to the correct department
2. Check that User Permission is set correctly

*1. Xác minh nhân viên được gán đúng phòng ban*  
*2. Kiểm tra User Permission được thiết lập đúng*

---

## Notes / Lưu ý

> [!IMPORTANT]
> Users without any User Permission for Department will have **full access** by default. This is to maintain backward compatibility.
>
> *Người dùng không có User Permission cho Department sẽ có **toàn quyền truy cập** theo mặc định. Điều này để đảm bảo tương thích ngược.*

> [!TIP]
> To quickly check a user's permissions, go to **User > [User Name] > User Permissions** tab.
>
> *Để kiểm tra nhanh quyền của người dùng, vào **User > [Tên người dùng] > Tab User Permissions**.*
