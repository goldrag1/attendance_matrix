"""Tên bản ghi chấm công có thể biến mất GIỮA một lượt lưu — đừng để nó hỏng cả dòng.

Nhánh sửa bản ghi ĐÃ DUYỆT trong `save_matrix_data` xoá rồi tạo lại, nên tên tra được ở
đầu lượt có thể không còn khi tới `get_doc`. Đo prod tamdinh 27/08 08:54: 3 lượt liền
ném `DoesNotExistError: Điểm danh HR-ATT-2026-23383/23384 không tìm thấy`, ID 23381–23385
biến mất khỏi bảng, và người dùng đọc câu đó như dữ liệu hỏng — họ chưa bao giờ gõ cái tên
ấy. (Dữ liệu cuối cùng vẫn đúng: 23386/23387 tồn tại, Present.)

Hai điều khoá lại: (1) tên đã mất thì coi như CHƯA CÓ, đi tiếp nhánh tạo mới; (2) nếu vẫn
mất ở chỗ tải thì câu báo phải nói VIỆC PHẢI LÀM, không phải phun tên nội bộ.
"""

import os
import re
import sys
import unittest
from unittest import mock

_GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_TEP = os.path.join(_GOC, "attendance_matrix", "page", "attendance_matrix", "attendance_matrix.py")


class TestTaiChamCongBienMat(unittest.TestCase):
    def setUp(self):
        self.src = open(_TEP, encoding="utf-8").read()

    def test_tra_xong_con_kiem_lai_su_ton_tai(self):
        """Ngay sau khi tra tên phải có bước xác nhận nó CÒN, trước khi dùng."""
        m = re.search(r'existing = frappe\.db\.exists\("Attendance".*?\n(.*?)if mode ==', self.src, re.S)
        self.assertIsNotNone(m, "không tìm thấy đoạn tra bản ghi")
        self.assertIn("not frappe.db.exists(\"Attendance\", existing)", m.group(1))
        self.assertIn("existing = None", m.group(1))

    def test_moi_cho_tai_deu_qua_MOT_cua(self):
        """Ba chỗ tải trước đây gọi thẳng get_doc — một chỗ quên là lỗi quay lại."""
        self.assertEqual(self.src.count('frappe.get_doc("Attendance", existing)'), 0)
        self.assertEqual(self.src.count("_tai_cham_cong(existing)"), 3)

    def test_cau_bao_noi_viec_phai_lam_khong_phun_ten_noi_bo(self):
        i = self.src.index("def _tai_cham_cong")
        than = self.src[i: self.src.index("\n@frappe.whitelist()", i)]
        self.assertIn("Tải lại bảng công", than)
        self.assertNotIn("{ten}", than)
        self.assertIn("DoesNotExistError", than)
