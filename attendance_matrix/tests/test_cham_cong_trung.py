# Test hồi quy cho lỗi "một ô chấm công đẻ ra hai phiếu" (vé FB-2026-00030, prod tamdinh).
#
# Triệu chứng: người dùng gõ vào ô chấm công, giao diện tự lưu sau MỖI phím, và máy chủ
# nhận 4 lượt trong 40 ms rồi 5 lượt nữa 15 giây sau — cùng một payload. Lượt sau vấp
# `TimestampMismatchError` / "Điểm danh HR-ATT-… không tìm thấy", còn dữ liệu thì đẻ ra
# hai phiếu ĐÃ DUYỆT cho cùng (nhân viên, ngày), cách nhau 0,5 giây.
#
# Đo trên prod 04/09/2026: 48 cặp (nhân viên, ngày) có >1 phiếu docstatus<2 — 101 dòng,
# 53 dòng thừa; 33/48 cặp tạo cách nhau <2 giây; 14 cặp mâu thuẫn trạng thái. Của 8 tài
# khoản khác nhau, trải từ 11/2025 tới 03/09/2026 ⇒ lỗi đang sống, không phải một lần lỡ.
#
# Vì sao lỗi đẻ được hai phiếu: mọi đường ghi đều `doc.flags.ignore_validate = True` để
# lách `validate_status` gắn cứng của HRMS — cờ đó tắt LUÔN `validate_duplicate_record`.
# Và MariaDB ở đây chạy REPEATABLE-READ (đo prod 04/09) nên hai lượt song song đọc bằng
# `frappe.db.exists` đều KHÔNG thấy phiếu của nhau rồi cùng tạo mới.
#
# Chạy: cd <bench>/sites && ../env/bin/python -m unittest \
#   attendance_matrix.tests.test_cham_cong_trung -v
#
# LƯU Ý: hai ca song song phải COMMIT thật (một luồng không thấy giao dịch chưa commit của
# luồng kia), nên test này dọn bằng tay ở tearDownClass chứ không dựa vào rollback.

import json
import os
import threading
import unittest

import frappe

SITE = os.environ.get("AM_TEST_SITE", "tamdinh")
M = "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix"

NGAY_SONG_SONG = "2099-02-01"   # ngày không thể đụng dữ liệu chấm công thật
NGAY_GOM = "2099-02-02"
NGAY_LAP = "2099-02-03"
MOI_NGAY = (NGAY_SONG_SONG, NGAY_GOM, NGAY_LAP)


def setUpModule():
	if not frappe.db:
		frappe.init(site=SITE)
		frappe.connect()


def call(fn, **kwargs):
	return frappe.get_attr(M + "." + fn)(**kwargs)


def _luot_luu(site, employee, ngay, trang_thai, cong, ket_qua):
	"""Một lượt lưu ĐỘC LẬP (kết nối riêng) — mô phỏng lượt thứ hai của trình duyệt."""
	frappe.init(site=site)
	frappe.connect()
	try:
		cong.wait(timeout=15)  # hai luồng vào cùng lúc
		r = call("save_matrix_bulk", data=json.dumps([
			{"employee": employee, "date": ngay, "status": trang_thai}]), mode="attendance")
		frappe.db.commit()
		ket_qua.append(r)
	except Exception as e:  # noqa: BLE001 — báo về cho luồng chính, đừng nuốt
		frappe.db.rollback()
		ket_qua.append({"loi": f"{type(e).__name__}: {e}"})
	finally:
		frappe.destroy()


class ChamCongKhongDuocTrung(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		frappe.set_user("Administrator")
		emps = frappe.get_all("Employee", filters={"status": "Active"}, limit=1, pluck="name")
		if not emps:
			raise unittest.SkipTest("Site cần ít nhất 1 nhân viên đang làm việc")
		cls.emp = emps[0]
		settings = frappe.get_single("Attendance Matrix Settings")
		cls.status = settings.status_map[0].status
		cls.payroll_status = settings.status_map[0].payroll_status or "Present"
		cls._don()

	@classmethod
	def tearDownClass(cls):
		cls._don()

	@classmethod
	def _don(cls):
		frappe.set_user("Administrator")
		for ngay in MOI_NGAY:
			for ten in frappe.get_all("Attendance", filters={"attendance_date": ngay}, pluck="name"):
				doc = frappe.get_doc("Attendance", ten)
				doc.flags.ignore_permissions = True
				if doc.docstatus == 1:
					doc.cancel()
				doc.delete(ignore_permissions=True)
		frappe.db.commit()

	def setUp(self):
		frappe.set_user("Administrator")

	def _con_song(self, ngay):
		frappe.db.rollback()  # ảnh chụp MỚI: REPEATABLE-READ giấu commit của luồng khác
		return frappe.get_all("Attendance", filters={
			"employee": self.emp, "attendance_date": ngay, "docstatus": ["<", 2]},
			fields=["name", "creation", "custom_matrix_status", "docstatus"], order_by="creation")

	def _tao_phieu(self, ngay):
		doc = frappe.get_doc({
			"doctype": "Attendance", "employee": self.emp, "attendance_date": ngay,
			"status": self.payroll_status, "custom_matrix_status": self.status, "docstatus": 1,
		})
		doc.flags.ignore_validate = True
		doc.insert(ignore_permissions=True)
		return doc.name

	# ------------------------------------------------------------------ ca 1
	def test_hai_luot_song_song_chi_de_ra_MOT_phieu(self):
		"""Đúng hình dạng lỗi trên prod: hai lượt lưu cùng payload, chồng nhau."""
		cong = threading.Barrier(2)
		ket_qua = []
		luong = [threading.Thread(target=_luot_luu,
			args=(SITE, self.emp, NGAY_SONG_SONG, self.status, cong, ket_qua)) for _ in range(2)]
		for t in luong:
			t.start()
		for t in luong:
			t.join(timeout=90)
		self.assertEqual(len(ket_qua), 2, f"Cả hai lượt phải chạy xong: {ket_qua}")

		song = self._con_song(NGAY_SONG_SONG)
		self.assertEqual(len(song), 1,
			f"Một ô chỉ được có MỘT phiếu công; đang có {len(song)}: {song} | kết quả: {ket_qua}")
		self.assertEqual(song[0].custom_matrix_status, self.status)

	# ------------------------------------------------------------------ ca 2
	def test_o_dang_co_hai_phieu_thi_luu_lai_gom_ve_mot(self):
		"""Hình dạng dữ liệu prod đang có (48 ô): người dùng chấm lại ô đó thì phải
		còn đúng một phiếu — nhánh cũ chỉ thấy MỘT phiếu nên sửa xong vẫn còn trùng."""
		self._tao_phieu(NGAY_GOM)
		self._tao_phieu(NGAY_GOM)
		frappe.db.commit()
		self.assertEqual(len(self._con_song(NGAY_GOM)), 2, "Tiền đề: ô này đang có 2 phiếu")

		r = call("save_matrix_bulk", data=json.dumps([
			{"employee": self.emp, "date": NGAY_GOM, "status": self.status}]), mode="attendance")
		frappe.db.commit()
		self.assertEqual(r["errors"], [], "Chấm lại một ô đang trùng không được báo lỗi")

		song = self._con_song(NGAY_GOM)
		self.assertEqual(len(song), 1, f"Phải gom về MỘT phiếu, đang còn {len(song)}: {song}")

	# ------------------------------------------------------------------ ca 3
	def test_luu_lai_y_nguyen_gia_tri_cu_thi_khong_dung_vao_phieu(self):
		"""Tự lưu bắn lại cùng giá trị là chuyện thường (mỗi phím một lượt). Lượt trùng
		phải là VIỆC KHÔNG LÀM GÌ, chứ không phải huỷ + xoá + tạo lại — chính vòng
		huỷ-tạo đó là cỗ máy đẻ phiếu trùng và đẻ TimestampMismatchError."""
		call("save_matrix_bulk", data=json.dumps([
			{"employee": self.emp, "date": NGAY_LAP, "status": self.status}]), mode="attendance")
		frappe.db.commit()
		truoc = self._con_song(NGAY_LAP)
		self.assertEqual(len(truoc), 1, "Tiền đề: lượt đầu tạo đúng 1 phiếu")

		call("save_matrix_bulk", data=json.dumps([
			{"employee": self.emp, "date": NGAY_LAP, "status": self.status}]), mode="attendance")
		frappe.db.commit()
		sau = self._con_song(NGAY_LAP)
		self.assertEqual(len(sau), 1, f"Vẫn phải đúng 1 phiếu, đang có {len(sau)}")
		# So bằng `creation`, KHÔNG bằng tên: Frappe trả lại số thứ tự khi xoá bản ghi cuối
		# (`revert_series_if_last`) nên phiếu tạo lại thường trùng tên phiếu vừa xoá — đo
		# 04/09/2026, tên giống hệt trong khi bản ghi đã bị huỷ + xoá + tạo mới.
		self.assertEqual(str(sau[0].creation), str(truoc[0].creation),
			"Lưu lại cùng giá trị mà phiếu đổi ngày tạo = đã huỷ+xoá+tạo lại một lần vô ích")


if __name__ == "__main__":
	unittest.main()
