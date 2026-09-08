"""Cổng gác dùng chung cho các endpoint GHI của app chấm công.

MỘT khuôn câu từ chối cho mọi cổng: sửa NIỀM TIN đã gây ra hành động trước, rồi mới tả
trạng thái, rồi nói VIỆC PHẢI LÀM và AI làm được. Chép khuôn này vào từng endpoint là
cách chắc chắn để hai chỗ nói hai kiểu — có test khoá lại (test_gac_quyen_cau_hinh).

Vai "toàn công ty" của ma trận chấm công khai ở ĐÂY, một chỗ, để cổng gác và câu từ
chối không bao giờ nói khác `get_permitted_departments`.
"""

import frappe

# Vai được chấm công / xem công cho TOÀN công ty (v2.0.22 đặt ra bộ này).
VAI_TOAN_CONG_TY = ("System Manager", "HR Manager", "HR User")


def vai_co_quyen(doctype, ptype="write"):
    """Vai nào ĐANG có quyền <ptype> trên <doctype>, đọc từ bảng phân quyền của site.

    Không đúc cứng tên vai vào mã: khách sửa phân quyền trong Role Permission Manager thì
    cổng gác lẫn câu từ chối đi theo. Frappe: có bất kỳ dòng `Custom DocPerm` nào thì bộ
    đó THAY THẾ `DocPerm` của app, nên phải hỏi Custom trước.
    """
    vai = frappe.db.get_all("Custom DocPerm", filters={"parent": doctype, ptype: 1}, pluck="role")
    if not vai:
        vai = frappe.db.get_all("DocPerm", filters={"parent": doctype, ptype: 1}, pluck="role")
    return sorted(set(vai))


def chan(*, tieu_de, niem_tin, hien_trang, phai_lam, ai_lam_duoc=()):
    """Chặn và nói câu người đọc dùng được. Luôn ném PermissionError.

    `ai_lam_duoc` là DANH SÁCH VAI (không phải một màn): người bị chặn thường không mở
    được màn phân quyền, nên câu phải chỉ họ đi nhờ ai chứ không chỉ vào một nút họ
    không bấm được.
    """
    ai = ", ".join(ai_lam_duoc) if ai_lam_duoc else "quản trị hệ thống (System Manager)"
    frappe.throw(
        f"{niem_tin}<br><br>{hien_trang}<br><br>"
        f"<b>Việc phải làm:</b> {phai_lam}<br>"
        f"<b>Người làm được:</b> tài khoản có vai {ai}.",
        frappe.PermissionError,
        title=tieu_de,
    )
