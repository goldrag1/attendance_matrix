# MATRIX UI DESIGN SYSTEM (Quy chuẩn Thiết kế Matrix App)

Tài liệu này tổng hợp các quy tắc thiết kế (Design Language) và tiêu chuẩn kỹ thuật cho các ứng dụng dạng "Matrix" (Bảng ma trận) trong hệ thống ERPNext, dựa trên mẫu **Attendance Matrix** và **Delivery Note Matrix**.

Mục tiêu: Đảm bảo sự thống nhất về giao diện (UI) và trải nghiệm người dùng (UX) cho các ứng dụng tương lai.

---

## 1. Công nghệ (Technology Stack)
*   **Framework Frontend:** Vue.js 3 (Sử dụng build ES Modules hoặc CDN, không dùng .vue file cần compile phức tạp nếu không cần thiết).
*   **Grid Library:** AG Grid Community (Bản miễn phí, đủ tính năng View/Edit/Filter).
*   **CSS Framework:** Bootstrap 4 (Mặc định của Frappe) + Custom Utility Classes.
*   **Icons:** FontAwesome 4.7 (Mặc định của Frappe).
*   **Backend:** Frappe Framework (Python API).

---

## 2. Bố cục & Phân vùng (Layout & Zoning)

Nguyên tắc cốt lõi: **"Full Screen & Data-Centric"** (Tận dụng toàn màn hình, tập trung vào dữ liệu).

### 2.1. Container Chính (App Wrapper)
*   **Reset Mặc định:** Ẩn `.page-head` (tiêu đề mặc định của Frappe) và `footer`.
*   **Kích thước:**
    *   `width: 100%` (Override `.container` của Frappe).
    *   `height: calc(100vh - 65px)` (Trừ đi chiều cao Header custom).
    *   `overflow: hidden` (Để ép thanh cuộn nằm ngay đáy màn hình, không bị trôi xuống dưới).

### 2.2. Header (Thanh Tiêu đề & Công cụ)
Sử dụng layout **2 Dòng (Two-Tier Layout)** tách biệt rõ ràng:

**Dòng 1: Unified Header (Tiêu đề & Hành động)**
*   **Vị trí:** Trên cùng.
*   **Bên Trái:** Tiêu đề Trang (Font: `h4`, Bold).
*   **Bên Phải:** Khu vực tương tác (Interactive Area), bao gồm:
    *   **Legend (Chú thích):** Hiển thị inline, tự ẩn trên mobile. Format: `[Badge Màu] Tên trạng thái`.
    *   **Action Buttons (Nút chức năng):**
        *   View Options (Dropdown): Chứa các toggle hiển thị cột (Mã NV, Phòng ban, Ca...).
        *   Reset Filter: Nút làm mới bộ lọc.
        *   Fullscreen: Nút phóng to toàn màn hình.
        *   Configuration: Nút cài đặt (Modal popup).
        *   Primary Action: Nút hành động chính (VD: Xuất Excel) - Màu xanh (`btn-success`).

**Dòng 2: Filter Bar (Thanh Bộ lọc)**
*   **Vị trí:** Ngay dưới Header.
*   **Màu nền:** Xám nhạt (`bg-light`) để phân biệt với vùng dữ liệu.
*   **Bố cục (Flexbox):** `justify-content-between` (Căn 2 đầu).
    *   **Trái (Filters Group):** Các ô lọc (Công ty, Phòng ban, Nhân viên, Thời gian...).
    *   **Phải (Summary):** Hiển thị tổng số lượng bản ghi (VD: "Hiển thị: 30 nhân sự") - Màu xanh (`text-success`), in nghiêng.

---

## 3. UI Components (Thành phần Giao diện)

### 3.1. Inputs & Filters (Ô nhập liệu)
*   **Kiểu dáng:** Bo tròn mềm mại (`border-radius: 20px`).
*   **Hiệu ứng:** Đổ bóng nhẹ (`shadow-sm`), nền trắng (`bg-white`) nổi bật trên nền xám của Filter Bar.
*   **Label:** Label nhỏ (`small text-muted fw-bold`) nằm ngay trên ô input.

### 3.2. Buttons (Nút bấm)
*   **Style chung:** `btn-sm` (Nhỏ gọn), `shadow-sm` (Đổ bóng).
*   **Secondary Buttons:** `btn-light border` (Nền trắng/xám nhẹ, có viền).
*   **Primary Button:** `btn-success` (Màu xanh lá Excel) hoặc `btn-primary` (Xanh Frappe) tùy ngữ cảnh.

### 3.3. Scrollbars (Thanh cuộn) - *Quan trọng*
*   Phải tùy biến lại thanh cuộn mặc định để dễ thao tác trên màn hình lớn.
*   **Kích thước:** `width: 16px`, `height: 16px`.
*   **Màu sắc:** Track màu xám nhạt `#f0f0f0`, Thumb màu xám đậm `#bbb` có viền trắng tạo cảm giác nổi.

---

## 4. Grid Behavior (Hành vi Bảng dữ liệu)

### 4.1. Hiển thị (Visual)
*   **Row Height:** 40px (Chuẩn, đủ hiển thị thông tin mà không quá tốn diện tích).
*   **Text Align:**
    *   Cột Text/Tên: Căn trái (`text-left`).
    *   Cột Số liệu/Trạng thái/Ngày tháng: Căn giữa (`text-center`).
*   **Highlighting (Hiệu ứng di chuột):**
    *   **Row Hover:** Mặc định của AG Grid.
    *   **Column Hover:** Custom Highlight (Cả cột sáng lên màu xanh nhạt khi di chuột vào ô bất kỳ).

### 4.2. Màu sắc & Trạng thái (Color Coding)
*   **Weekend:** Cột T7/CN phải có màu nền nhạt phân biệt (VD: Hồng nhạt, Đỏ nhạt).
*   **Today:** Cột "Hôm nay" phải có màu nổi bật (VD: Xanh dương nhạt).
*   **Status Cells:** Ô dữ liệu được tô màu theo cấu hình (Configurable Color Map). Màu chữ nên tự động tương phản hoặc mặc định đen đậm.

### 4.3. Tính năng (Functional)
*   **Pinned Columns:** Luôn ghim các cột định danh (Mã NV, Tên NV, Phòng ban) bên trái.
*   **Dynamic Columns:** Số lượng cột Thay đổi theo dữ liệu (VD: Số ngày trong tháng, list sản phẩm...).
*   **Edit:** Click-to-edit (1 chạm) hoặc Double-click tùy nghiệp vụ.
*   **Auto-Save:** Lưu ngay khi thay đổi giá trị (OnCellChange).

---

## 5. Mobile Responsiveness (Đáp ứng thiết bị)
*   **Desktop First:** Ưu tiên thiết kế cho màn hình rộng (Desktop).
*   **Mobile Adaptation:**
    *   Ẩn bớt các thành phần không quan trọng (Legend, Text trên nút).
    *   Giữ lại các nút icon quan trọng.
    *   Scroll ngang cho bảng dữ liệu là bắt buộc.

---

## 6. Mẫu Code Snippet (CSS Chuẩn)

```css
/* Container Override */
.layout-main-section, .page-body, .content {
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
}

/* Custom Scrollbar */
::-webkit-scrollbar { width: 16px; height: 16px; }
::-webkit-scrollbar-track { background: #f0f0f0; border-left: 1px solid #ddd; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 3px; border: 2px solid #f0f0f0; }
::-webkit-scrollbar-thumb:hover { background: #888; }

/* Filter Rounded */
.form-select-sm, .form-control-sm {
    border-radius: 20px !important;
}
```
