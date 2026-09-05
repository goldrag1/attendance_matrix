# Ô "Ca" trên ma trận gửi shift_name RỖNG phải được đỡ, không TypeError 500.
#
# Ca thật 05/09/2026 (tamdinh, FB-2026-00035/36): bảng ca trong Cấu hình Chấm công trống
# nên ô chọn ag-Grid không có giá trị; người dùng rời ô → JS gọi set_employee_shift(employee)
# không kèm shift_name → "missing 1 required positional argument" → 500, không câu nào nói
# phải làm gì. 144 nhân viên, 0 người có ca mặc định, tính năng chạm 1 lần/30 ngày = lượt hỏng.
#
# Chạy: cd <bench>/sites && AM_TEST_SITE=<site> ../env/bin/python -m unittest \
#   attendance_matrix.tests.test_set_employee_shift -v
import os
import unittest

import frappe

SITE = os.environ.get("AM_TEST_SITE", "tamdinh")
M = "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix"


def setUpModule():
	if not frappe.db:
		frappe.init(site=SITE)
		frappe.connect()
	frappe.set_user("Administrator")


class TestSetEmployeeShift(unittest.TestCase):
	def setUp(self):
		from attendance_matrix.attendance_matrix.page.attendance_matrix import attendance_matrix as am
		self.am = am
		self.emp = frappe.get_all("Employee", filters={"status": "Active"}, pluck="name", limit_page_length=1)
		if not self.emp:
			self.skipTest("site không có nhân viên Active")
		self.emp = self.emp[0]
		self.truoc = frappe.db.get_value("Employee", self.emp, "default_shift")
		self.settings = frappe.get_single("Attendance Matrix Settings")
		self.map_truoc = [d.as_dict() for d in self.settings.shift_map]

	def tearDown(self):
		frappe.db.rollback()

	def _bang_ca(self, rows):
		s = frappe.get_single("Attendance Matrix Settings")
		s.set("shift_map", [])
		for r in rows:
			s.append("shift_map", r)
		s.flags.ignore_permissions = True
		s.save()

	def test_rong_va_bang_ca_trong_thi_noi_ai_sua_o_dau(self):
		self._bang_ca([])
		with self.assertRaises(frappe.ValidationError) as cm:
			self.am.set_employee_shift(self.emp, None)
		self.assertIn("Cấu hình Chấm công", str(cm.exception))
		self.assertIn("Attendance Matrix Settings", str(cm.exception))
		# Thiếu hẳn tham số (cách frappe.call gửi khi JS đưa undefined) cũng phải ra CÂU, không TypeError.
		with self.assertRaises(frappe.ValidationError):
			self.am.set_employee_shift(self.emp)

	def test_rong_va_co_bang_ca_thi_bo_ca_mac_dinh(self):
		self._bang_ca([{"shift_name": "Ca KT", "start_time": "07:30:00", "end_time": "15:30:00"}])
		frappe.db.set_value("Employee", self.emp, "default_shift", None)
		self.assertEqual(self.am.set_employee_shift(self.emp, ""), "OK")
		self.assertFalse(frappe.db.get_value("Employee", self.emp, "default_shift"))

	def test_ca_co_trong_bang_thi_tao_shift_type_va_gan(self):
		ten = "Ca KT 05-09"
		self._bang_ca([{"shift_name": ten, "start_time": "07:30:00", "end_time": "15:30:00"}])
		frappe.db.delete("Shift Type", {"name": ten})
		self.assertEqual(self.am.set_employee_shift(self.emp, ten), "OK")
		self.assertTrue(frappe.db.exists("Shift Type", ten))
		self.assertEqual(frappe.db.get_value("Employee", self.emp, "default_shift"), ten)
