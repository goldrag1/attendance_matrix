# Attendance Matrix - Product Roadmap

## Vision / Tầm nhìn
Biến Attendance Matrix thành giải pháp quản lý nhân sự toàn diện, tự động hóa và tích hợp sâu với ERPNext.

---

## Phase 1: Auto-Attendance (v2.0) 🤖

**Mục tiêu:** Tự động chấm công cho user dựa trên hoạt động nghiệp vụ ERPNext

**Lý do:**
- Người dùng làm nghiệp vụ (Sales Order, Delivery Note, etc.) = Đang đi làm
- Tiết kiệm thời gian cho HR, không phải chấm thủ công
- Minh bạch, có log rõ ràng

**Kế hoạch:**
- [ ] Tạo hook `doc_events` bắt các DocType quan trọng (Sales Order, Delivery Note, Stock Entry, etc.)
- [ ] Khi user submit doc -> Check nếu chưa có Attendance hôm nay -> Tự động tạo Attendance status "Present"
- [ ] Thêm field `auto_marked` trong Attendance để phân biệt tự động vs thủ công
- [ ] Cấu hình trong Settings: Bật/tắt tính năng, chọn DocTypes trigger

**ETA:** Q2/2026

---

## Phase 2: Overtime Tracking (v2.5) ⏰

**Mục tiêu:** Tích hợp chấm làm thêm giờ (OT) vào hệ thống

**Kế hoạch:**
- [ ] Thêm cột OT Hours vào Attendance Matrix grid
- [ ] Tạo DocType "Overtime Log" để quản lý chi tiết
- [ ] Tích hợp với Shift Type để tính OT tự động (giờ vượt ca)
- [ ] Quy tắc OT: OT ngày thường, OT cuối tuần, OT ngày lễ (hệ số khác nhau)
- [ ] Báo cáo OT theo nhân viên/phòng ban/kỳ

**ETA:** Q3/2026

---

## Phase 3: Payroll Integration (v3.0) 💰

**Mục tiêu:** Tích hợp với module Payroll của ERPNext

**Kế hoạch:**
- [ ] Kết nối Attendance Matrix với Salary Structure
- [ ] Thêm các Salary Component dựa trên chấm công:
  - Ngày công thực tế
  - Tiền OT (theo hệ số)
  - Trừ lương nghỉ không phép
  - Phụ cấp chuyên cần
- [ ] Tự động điền vào Salary Slip khi tạo Payroll Entry
- [ ] Dashboard tổng hợp: Chấm công → Lương

**ETA:** Q4/2026

---

## Future Ideas / Ý tưởng xa hơn

- 📱 Mobile App: Chấm công bằng GPS + Face Recognition
- 📊 Dashboard: Biểu đồ thống kê, Missing Attendance alerts
- 🔗 Biometric Integration: Kết nối máy chấm công vân tay
- 📅 Leave Integration: Tự động điền Leave khi có Leave Application approved

---

*Last updated: 2026-01-19*
