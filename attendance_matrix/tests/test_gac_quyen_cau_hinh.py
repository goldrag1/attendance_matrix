"""Cổng gác cho các endpoint GHI của ma trận chấm công (fail-closed).

Đo trên prod tamdinh 08/09/2026 (chỉ đọc):
  - `save_attendance_settings` là `@frappe.whitelist()` không kiểm quyền gì: mọi tài khoản
    đăng nhập (190 user đang bật) đều gọi được, và nó ghi Property Setter lên DocType
    Attendance + xoá-ghi-lại toàn bộ bảng Ca / bảng Trạng thái DÙNG CHUNG cho cả site.
  - `set_employee_shift` ghi `Employee.default_shift` bằng `frappe.db.set_value` (bỏ qua
    phân quyền) và tạo `Shift Type` với ignore_permissions=True cho BẤT KỲ nhân viên nào,
    kể cả người ngoài phạm vi phòng ban mà người gọi được chấm công.
  - `perform_update` tải zip từ GitHub GHI ĐÈ mã nguồn app trên máy chủ rồi restart.

Cùng lớp lỗi fail-open mà v2.0.22 đã vá cho `get_permitted_departments`.

Chạy KHÔNG cần site (không đụng CSDL):
    cd apps/attendance_matrix && ../../env/bin/python -m unittest \
        attendance_matrix.tests.test_gac_quyen_cau_hinh -v
"""

import json
import unittest
from unittest import mock

import frappe

from attendance_matrix.attendance_matrix.page.attendance_matrix import (
    attendance_matrix as am,
)
from attendance_matrix.attendance_matrix.utils import updates as up


class _CaiDat:
    """Đủ hình dạng mà `save_attendance_settings` chạm tới, không hơn."""

    def __init__(self):
        self.bang = {"status_map": [], "shift_map": [], "overtime_types": []}
        self.da_luu = 0

    def set(self, ten, gia_tri):
        self.bang[ten] = list(gia_tri)

    def append(self, ten, dong):
        self.bang.setdefault(ten, []).append(dong)

    def save(self):
        self.da_luu += 1


class _O:
    def __init__(self, options=""):
        self.options = options


class _Meta:
    def get_field(self, _ten):
        return _O("Present\nAbsent")


STATUS_MAP = json.dumps([{"abbreviation": "X", "status": "Full ca", "payroll_status": "Present"}])
SHIFT_MAP = json.dumps([{"shift_name": "Ca hành chính", "start_time": "08:00", "end_time": "17:00"}])


class _Chan(Exception):
    """Thay cho frappe.throw khi chạy không có site."""


class GacQuyenCauHinh(unittest.TestCase):
    def setUp(self):
        self.cai_dat = _CaiDat()
        self.property_setter_da_goi = []
        self.set_value_da_goi = []
        self.cau_chan = []

        def _throw(msg, exc=None, title=None, **_kw):
            self.cau_chan.append(str(msg))
            raise _Chan(str(msg))

        self.p = [
            mock.patch.object(frappe, "throw", side_effect=_throw),
            mock.patch.object(frappe, "get_single", return_value=self.cai_dat),
            mock.patch.object(frappe, "get_meta", return_value=_Meta()),
            mock.patch.object(frappe, "clear_cache"),
            mock.patch.object(frappe, "log_error"),
            mock.patch.object(frappe, "msgprint"),
            mock.patch.object(
                frappe, "make_property_setter",
                side_effect=lambda *a, **k: self.property_setter_da_goi.append((a, k))),
        ]
        for p in self.p:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in self.p])
        # frappe.session.user chỉ đọc được khi đã init site -> giả lập.
        self.session = mock.patch.object(
            frappe, "session", mock.Mock(user="nguoi.thuong@tamdinh.vn"))
        self.session.start()
        self.addCleanup(self.session.stop)

    def _gia_lap_db(self, *, vai_co_quyen=("System Manager",), phong_nhan_vien="Kế toán"):
        db = mock.Mock()
        db.get_all.return_value = list(vai_co_quyen)
        db.get_value.return_value = phong_nhan_vien
        db.exists.return_value = True
        db.set_value.side_effect = lambda *a, **k: self.set_value_da_goi.append(a)
        return mock.patch.object(frappe, "db", db)

    # ---------- save_attendance_settings ----------

    def test_khong_co_quyen_thi_khong_ghi_gi_ca(self):
        with self._gia_lap_db(), mock.patch.object(frappe, "has_permission", return_value=False):
            with self.assertRaises(_Chan):
                am.save_attendance_settings(STATUS_MAP, SHIFT_MAP)
        self.assertEqual(self.cai_dat.da_luu, 0, "không được lưu cấu hình")
        self.assertEqual(self.property_setter_da_goi, [],
                         "cổng phải chặn TRƯỚC khi ghi Property Setter lên DocType Attendance")

    def test_cau_tu_choi_sua_niem_tin_va_noi_ai_lam_duoc(self):
        with self._gia_lap_db(vai_co_quyen=("System Manager",)), \
                mock.patch.object(frappe, "has_permission", return_value=False):
            with self.assertRaises(_Chan):
                am.save_attendance_settings(STATUS_MAP, SHIFT_MAP)
        cau = self.cau_chan[0]
        self.assertIn("cả công ty", cau, "phải sửa niềm tin: đây là cấu hình dùng chung")
        self.assertIn("Việc phải làm", cau)
        self.assertIn("System Manager", cau, "phải nói vai nào làm được")

    def test_co_quyen_thi_luu_binh_thuong(self):
        with self._gia_lap_db(), mock.patch.object(frappe, "has_permission", return_value=True):
            kq = am.save_attendance_settings(STATUS_MAP, SHIFT_MAP)
        self.assertEqual(kq, "OK")
        self.assertEqual(self.cai_dat.da_luu, 1)
        self.assertEqual(len(self.cai_dat.bang["shift_map"]), 1)
        self.assertEqual(self.cai_dat.bang["shift_map"][0]["shift_name"], "Ca hành chính")

    # ---------- set_employee_shift ----------

    def test_doi_ca_nguoi_ngoai_pham_vi_bi_chan(self):
        with self._gia_lap_db(phong_nhan_vien="Kế toán"), \
                mock.patch.object(am, "get_permitted_departments", return_value=["Kho"]):
            with self.assertRaises(_Chan):
                am.set_employee_shift("HR-EMP-00001", "Ca hành chính")
        self.assertEqual(self.set_value_da_goi, [], "không được đổi ca mặc định của người ngoài phạm vi")

    def test_khong_duoc_cap_phong_nao_thi_bi_chan(self):
        with self._gia_lap_db(phong_nhan_vien="Kho"), \
                mock.patch.object(am, "get_permitted_departments", return_value=[]):
            with self.assertRaises(_Chan):
                am.set_employee_shift("HR-EMP-00001", "Ca hành chính")
        self.assertEqual(self.set_value_da_goi, [])

    def test_doi_ca_trong_pham_vi_van_chay(self):
        with self._gia_lap_db(phong_nhan_vien="Kho"), \
                mock.patch.object(am, "get_permitted_departments", return_value=["Kho"]):
            kq = am.set_employee_shift("HR-EMP-00001", "Ca hành chính")
        self.assertEqual(kq, "OK")
        self.assertEqual(len(self.set_value_da_goi), 1)

    def test_toan_cong_ty_van_doi_ca_duoc(self):
        with self._gia_lap_db(phong_nhan_vien="Kho"), \
                mock.patch.object(am, "get_permitted_departments", return_value=None):
            kq = am.set_employee_shift("HR-EMP-00001", "Ca hành chính")
        self.assertEqual(kq, "OK")
        self.assertEqual(len(self.set_value_da_goi), 1)

    # ---------- perform_update ----------

    def test_nguoi_thuong_khong_ghi_de_duoc_ma_nguon(self):
        with self._gia_lap_db(), mock.patch.object(frappe, "has_permission", return_value=False), \
                mock.patch.object(up.requests, "get") as tai:
            with self.assertRaises(_Chan):
                up.perform_update()
        tai.assert_not_called()

    def test_quan_tri_van_cap_nhat_duoc(self):
        """Chiều NGƯỢC LẠI: người có quyền phải đi qua cổng, không bị chặn oan."""
        with self._gia_lap_db(), mock.patch.object(frappe, "has_permission", return_value=True), \
                mock.patch.object(up, "_", lambda s: s), \
                mock.patch.object(up.requests, "get", side_effect=RuntimeError("mạng")) as tai:
            with self.assertRaises(_Chan):
                up.perform_update()   # chết ở bước TẢI (đã qua cổng), không phải ở cổng
        tai.assert_called()
        self.assertNotIn("không có quyền", self.cau_chan[-1])

    # ---------- một khuôn câu từ chối, không chép nhiều bản ----------

    def test_chi_co_MOT_ham_dung_cau_tu_choi(self):
        import inspect

        from attendance_matrix.attendance_matrix.utils import quyen

        nguon_endpoint = inspect.getsource(am) + inspect.getsource(up)
        self.assertEqual(nguon_endpoint.count("Việc phải làm:"), 0,
                         "câu từ chối phải dựng trong MỘT helper dùng chung, không chép vào từng endpoint")
        self.assertEqual(inspect.getsource(quyen).count("Việc phải làm:"), 1,
                         "khuôn câu từ chối phải nằm đúng một chỗ trong utils/quyen.py")
        # Bộ vai "toàn công ty" cũng chỉ được khai một chỗ.
        self.assertEqual(nguon_endpoint.count('"HR Manager", "HR User"'), 0,
                         "danh sách vai toàn công ty khai ở utils/quyen.py, không chép vào endpoint")


if __name__ == "__main__":
    unittest.main()
