# Skill: Long-term Project Memory (Beads)

## Purpose
Kỹ năng này cho phép Agent sử dụng công cụ CLI `bd` để duy trì bộ nhớ dài hạn, lập kế hoạch dự án và theo dõi trạng thái công việc dưới dạng đồ thị phụ thuộc (dependency graph).

## Khi nào sử dụng
- Khi bắt đầu một phiên làm việc mới để lấy lại ngữ cảnh (Context).
- Khi người dùng giao một yêu cầu lớn cần chia nhỏ.
- Khi hoàn thành một tính năng hoặc sửa xong một lỗi.

## Các lệnh điều khiển (Tools)
Agent được phép thực thi các lệnh sau thông qua terminal:
- `bd ready`: Kiểm tra các tác vụ có thể thực hiện ngay lập tức.
- `bd status --graph`: Xem toàn bộ bản đồ công việc hiện tại.
- `bd create "mô tả" [-d "dependency-id"]`: Tạo tác vụ mới và thiết lập sự phụ thuộc.
- `bd finish`: Đánh dấu hoàn thành tác vụ đang thực hiện.
- `bd sense`: Quét mã nguồn để cập nhật các thay đổi vào bộ nhớ.

## Quy trình làm việc (Workflow)
1. **Khởi động**: Luôn chạy `bd ready` để biết mình đang ở đâu.
2. **Lập kế hoạch**: Nếu nhiệm vụ phức tạp, hãy dùng `bd create` để phân rã thành các sub-tasks trước khi code.
3. **Thực thi**: Code từng phần nhỏ dựa trên danh sách `ready`.
4. **Hạ cánh (Landing)**: Sau khi hoàn thành, dùng `bd finish` để lưu lại "kinh nghiệm" vào bộ nhớ vĩnh cửu.