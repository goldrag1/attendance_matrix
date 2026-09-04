# CHỈ ĐỌC — liệt kê các ô chấm công đang có NHIỀU HƠN MỘT phiếu công còn sống.
#
# VÌ SAO CÓ FILE NÀY (04/09/2026): giao diện tự lưu sau mỗi phím gõ, máy chủ xử song song,
# nên một ô (nhân viên × ngày) đẻ ra hai phiếu ĐÃ DUYỆT. Bản vá v2.0.24 bịt đường sinh
# thêm, nhưng dữ liệu cũ vẫn còn — đo prod tamdinh 04/09/2026: 48 cặp, 101 dòng, 53 dòng
# thừa; 33/48 cặp tạo cách nhau <2 giây; 14 cặp mâu thuẫn trạng thái.
#
# Chủ đầu tư đã chốt: CHỈ VÁ MÃ, KHÔNG đụng 53 dòng lịch sử. File này để RÀ, cho người có
# thẩm quyền đọc rồi tự quyết từng cặp. Nó KHÔNG ghi, KHÔNG xoá, KHÔNG commit — và không
# nên biến nó thành công cụ xoá hàng loạt: 14 cặp mâu thuẫn trạng thái là quyết định
# nghiệp vụ (ngày đó người ta nghỉ hay đi làm?), máy không trả lời thay được.
#
# Chạy (chỉ đọc, an toàn trên prod):
#   scripts/site-probe.sh tamdinh scripts/liet_ke_cham_cong_trung.py     # bench steel-slot-11
#   cd <bench>/sites && ../env/bin/python -c "import frappe;frappe.init(site='tamdinh');\
#       frappe.connect();exec(open('<đường dẫn file này>').read())"
#
# Đọc cột "GIU/BO": đó là GỢI Ý (giữ phiếu mới nhất) — không phải quyết định. Cặp nào
# mâu thuẫn trạng thái thì cột đó bỏ trống, phải hỏi người chấm công ngày hôm đó.

import frappe


def _cap_trung():
	return frappe.db.sql("""
		select employee, attendance_date, count(*) so_phieu
		from `tabAttendance`
		where docstatus < 2
		group by employee, attendance_date
		having so_phieu > 1
		order by attendance_date, employee
	""", as_dict=True)


def run():
	cap = _cap_trung()
	if not cap:
		print("Không còn ô nào có hơn một phiếu công.")
		return

	tong_dong = tong_thua = mau_thuan = 0
	print(f"{'NHÂN VIÊN':<16} {'NGÀY':<12} {'PHIẾU':<22} {'TRẠNG THÁI':<18} {'NGƯỜI TẠO':<28} {'TẠO LÚC':<20} GIU/BO")
	print("-" * 130)
	for c in cap:
		dong = frappe.db.sql("""
			select name, docstatus, status, custom_matrix_status, owner, creation
			from `tabAttendance`
			where employee = %s and attendance_date = %s and docstatus < 2
			order by creation, name
		""", (c.employee, c.attendance_date), as_dict=True)
		tong_dong += len(dong)
		tong_thua += len(dong) - 1
		khac_nhau = len({(d.status, d.custom_matrix_status or "") for d in dong}) > 1
		if khac_nhau:
			mau_thuan += 1
		for i, d in enumerate(dong):
			if khac_nhau:
				y = "?? hỏi người chấm"
			else:
				y = "GIỮ" if i == len(dong) - 1 else "bỏ được"
			print(f"{c.employee:<16} {str(c.attendance_date):<12} {d.name:<22} "
			      f"{(d.custom_matrix_status or d.status or ''):<18} {(d.owner or ''):<28} "
			      f"{str(d.creation)[:19]:<20} {y}")
		print("-" * 130)

	print(f"\nTỔNG: {len(cap)} ô trùng · {tong_dong} dòng · {tong_thua} dòng thừa · "
	      f"{mau_thuan} ô MÂU THUẪN trạng thái (không tự quyết được).")
	print("Script này không sửa gì. Muốn dọn: mở từng phiếu trên màn Điểm danh và quyết từng cặp.")


run()
