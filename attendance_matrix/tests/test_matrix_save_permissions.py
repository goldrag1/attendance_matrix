# Test hồi quy cho lỗi phát hiện 03/08/2026 trên prod tamdinh.
#
# Triệu chứng: "Error saving matrix for {...}" → PermissionError, 93 lần, 89 lần của một
# người trong 4 ngày. Người dùng chỉ thấy hộp thoại "undefined (undefined): undefined".
#
# Nguyên nhân: quyền chấm công của ma trận do get_permitted_departments() quyết định, và
# MỌI thao tác ghi trong save_matrix_bulk đều ignore_permissions=True — trừ cancel()/delete().
# Ai có User Permission "chỉ nhân viên của mình" (HR tự sinh cho mọi nhân viên) thì TẠO
# được ô trống cho người khác nhưng SỬA lại ô đã chấm thì lỗi. Hai chiều ngược nhau trên
# cùng một người, cùng một nhân viên — sai với bất kỳ chính sách phân quyền nào.
#
# Chạy: cd <bench>/sites && ../env/bin/python -m unittest \
#   attendance_matrix.tests.test_matrix_save_permissions -v

import json
import os
import unittest

import frappe

SITE = os.environ.get("AM_TEST_SITE", "tamdinh")
FUTURE_DATE = "2099-01-02"  # ngày không thể đụng dữ liệu chấm công thật
TEST_USER = "test.matrix.perm@example.invalid"

M = "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix"


def setUpModule():
	if not frappe.db:
		frappe.init(site=SITE)
		frappe.connect()


def tearDownModule():
	frappe.set_user("Administrator")
	frappe.db.rollback()


def call(fn, **kwargs):
	return frappe.get_attr(M + "." + fn)(**kwargs)


class MatrixSavePermissions(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		frappe.set_user("Administrator")
		emps = frappe.get_all("Employee", filters={"status": "Active"}, limit=2, pluck="name")
		if len(emps) < 2:
			raise unittest.SkipTest("Site cần ít nhất 2 nhân viên đang làm việc")
		cls.target_emp, cls.actor_emp = emps[0], emps[1]

		settings = frappe.get_single("Attendance Matrix Settings")
		cls.status = settings.status_map[0].status
		cls.payroll_status = settings.status_map[0].payroll_status or "Present"
		cls.other_status = settings.status_map[1].status if len(settings.status_map) > 1 else cls.status

		# Người chấm công: vai HR User (ma trận coi là chấm được TOÀN công ty) nhưng có
		# User Permission bó vào nhân viên của chính họ — đúng hình dạng gây lỗi trên prod.
		if not frappe.db.exists("User", TEST_USER):
			u = frappe.get_doc({
				"doctype": "User", "email": TEST_USER, "first_name": "Test Matrix Perm",
				"send_welcome_email": 0, "enabled": 1, "user_type": "System User",
			}).insert(ignore_permissions=True)
			u.add_roles("HR User", "Employee")
		# Dọn trước khi dựng: từ v2.0.24 `save_matrix_bulk` ghi sổ theo từng ô (để không ôm
		# khoá dòng sang ô sau), nên một lượt chạy đứt gánh giữa chừng KHÔNG còn được
		# rollback cuốn đi — bộ đồ nghề phải tự dọn rác của lượt trước, nếu không lượt sau
		# chết ở "User permission already exists" và đọc y như mã hỏng.
		for _cu in frappe.get_all("User Permission", filters={"user": TEST_USER}, pluck="name"):
			frappe.delete_doc("User Permission", _cu, force=True, ignore_permissions=True)
		cls.up = frappe.get_doc({
			"doctype": "User Permission", "user": TEST_USER, "allow": "Employee",
			"for_value": cls.actor_emp, "apply_to_all_doctypes": 1,
		}).insert(ignore_permissions=True)

		# Ô đã chấm sẵn (đã duyệt) của NGƯỜI KHÁC — đúng thứ mà sửa lại thì hỏng.
		for _cu in frappe.get_all("Attendance", filters={"attendance_date": FUTURE_DATE}, pluck="name"):
			_d = frappe.get_doc("Attendance", _cu)
			_d.flags.ignore_permissions = True
			if _d.docstatus == 1:
				_d.cancel()
			_d.delete(ignore_permissions=True)
		att = frappe.get_doc({
			"doctype": "Attendance", "employee": cls.target_emp,
			"attendance_date": FUTURE_DATE, "status": cls.payroll_status,
			"custom_matrix_status": cls.status, "docstatus": 1,
		})
		att.flags.ignore_validate = True
		att.insert(ignore_permissions=True)
		cls.attendance = att.name

	@classmethod
	def tearDownClass(cls):
		frappe.set_user("Administrator")
		for name in frappe.get_all("Attendance", filters={"attendance_date": FUTURE_DATE}, pluck="name"):
			doc = frappe.get_doc("Attendance", name)
			doc.flags.ignore_permissions = True
			if doc.docstatus == 1:
				doc.cancel()
			doc.delete(ignore_permissions=True)
		for name in frappe.get_all("User Permission", filters={"user": TEST_USER}, pluck="name"):
			frappe.delete_doc("User Permission", name, force=True, ignore_permissions=True)
		if frappe.db.exists("User", TEST_USER):
			frappe.delete_doc("User", TEST_USER, force=True, ignore_permissions=True)
		# GHI SỔ, không rollback: từ v2.0.24 hàm lưu ghi sổ theo từng ô, nên bản ghi dựng ở
		# setUpClass đã nằm thật trong cơ sở dữ liệu — `rollback()` ở đây chỉ huỷ chính mấy
		# lệnh xoá vừa gọi và để rác sống tiếp (đo 04/09/2026: lượt chạy sau chết ở
		# "User permission already exists").
		frappe.db.commit()

	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_matrix_coi_nguoi_nay_cham_duoc_toan_cong_ty(self):
		"""Tiền đề: quyền của ma trận nói người này chấm được, nên mọi thất bại phía dưới
		là lỗi kỹ thuật chứ không phải chặn quyền cố ý."""
		frappe.set_user(TEST_USER)
		self.assertIsNone(call("get_permitted_departments"),
			"Vai HR User phải được ma trận cho chấm toàn công ty")

	def test_sua_o_da_cham_cua_nguoi_khac(self):
		"""LỖI GỐC: cancel()/delete() thiếu ignore_permissions → sửa ô đã duyệt thì hỏng."""
		frappe.set_user(TEST_USER)
		r = call("save_matrix_bulk", data=json.dumps([{
			"employee": self.target_emp, "date": FUTURE_DATE, "status": self.other_status,
		}]), mode="attendance")
		self.assertEqual(r["errors"], [], "Sửa ô đã chấm của người khác không được báo lỗi")
		frappe.set_user("Administrator")
		saved = frappe.get_all("Attendance",
			filters={"employee": self.target_emp, "attendance_date": FUTURE_DATE, "docstatus": 1},
			fields=["custom_matrix_status"])
		self.assertEqual(len(saved), 1, "Phải còn đúng 1 bản ghi sau khi sửa")
		self.assertEqual(saved[0].custom_matrix_status, self.other_status)

	def test_xoa_o_da_cham_cua_nguoi_khac(self):
		"""Cùng lỗi ở nhánh xoá (gửi trạng thái rỗng)."""
		frappe.set_user("Administrator")
		if not frappe.get_all("Attendance", filters={"employee": self.target_emp, "attendance_date": FUTURE_DATE}):
			att = frappe.get_doc({
				"doctype": "Attendance", "employee": self.target_emp, "attendance_date": FUTURE_DATE,
				"status": self.payroll_status, "custom_matrix_status": self.status, "docstatus": 1,
			})
			att.flags.ignore_validate = True
			att.insert(ignore_permissions=True)
		frappe.set_user(TEST_USER)
		r = call("save_matrix_bulk", data=json.dumps([{
			"employee": self.target_emp, "date": FUTURE_DATE, "status": "",
		}]), mode="attendance")
		self.assertEqual(r["errors"], [], "Xoá ô đã chấm của người khác không được báo lỗi")
		frappe.set_user("Administrator")
		self.assertEqual(
			frappe.get_all("Attendance", filters={"employee": self.target_emp, "attendance_date": FUTURE_DATE}),
			[], "Ô phải được xoá hẳn")

	def test_nhan_vien_thuong_van_bi_chan(self):
		"""Bản vá cho cancel()/delete() đi qua tầng quyền của Frappe, nên tầng chặn duy nhất
		còn lại là get_permitted_departments(). Test này canh nó: người không thuộc HR và
		không có User Permission phòng vẫn KHÔNG được sửa công của người khác
		(đúng luật fail-closed chốt 19/06/2026)."""
		plain = "test.matrix.plain@example.invalid"
		frappe.set_user("Administrator")
		if not frappe.db.exists("User", plain):
			u = frappe.get_doc({
				"doctype": "User", "email": plain, "first_name": "Test Plain",
				"send_welcome_email": 0, "enabled": 1, "user_type": "System User",
			}).insert(ignore_permissions=True)
			u.add_roles("Employee")
		self.addCleanup(lambda: frappe.delete_doc("User", plain, force=True, ignore_permissions=True))

		frappe.set_user(plain)
		self.assertEqual(call("get_permitted_departments"), [],
			"Nhân viên thường phải KHÔNG có phòng nào được chấm")
		r = call("save_matrix_bulk", data=json.dumps([{
			"employee": self.target_emp, "date": FUTURE_DATE, "status": self.other_status,
		}]), mode="attendance")
		self.assertTrue(r["errors"], "Nhân viên thường vẫn phải bị chặn")
		self.assertEqual(r["success"], [], "Không được ghi gì cả")

	def test_moi_dong_loi_deu_doc_duoc_khong_hien_undefined(self):
		"""Giao diện đọc e.employee / e.date / e.error — nhánh except từng nhét CHUỖI vào
		đây nên người dùng thấy 'undefined (undefined): undefined'."""
		frappe.set_user(TEST_USER)
		r = call("save_matrix_bulk", data=json.dumps([{
			"employee": "NHAN-VIEN-KHONG-CO-THAT", "date": FUTURE_DATE, "status": self.status,
		}]), mode="attendance")
		self.assertTrue(r["errors"], "Nhân viên không tồn tại thì phải báo lỗi")
		for e in r["errors"]:
			self.assertIsInstance(e, dict, "Mỗi dòng lỗi phải là đối tượng, không phải chuỗi")
			for k in ("employee", "date", "error"):
				self.assertIn(k, e, f"Thiếu khoá '{k}' → giao diện sẽ hiện undefined")
			self.assertTrue(str(e["error"]).strip(), "Nội dung lỗi không được rỗng")


if __name__ == "__main__":
	unittest.main()
