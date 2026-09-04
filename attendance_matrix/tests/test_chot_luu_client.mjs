/* Chốt ĐANG-BAY của `matrix_store.save()` — chạy bằng node, không cần Frappe.
 *
 *   node attendance_matrix/tests/test_chot_luu_client.mjs
 *   node attendance_matrix/tests/test_chot_luu_client.mjs <đường dẫn matrix_store.js khác>
 *
 * Vì sao có: lưới gọi `store.save()` sau MỖI ô sửa. Bản trước 04/09/2026 không có chốt nào,
 * nên gõ nhanh 4 ô là 4 lượt `save_matrix_bulk` chồng nhau, cùng payload (đo prod: 4 lượt
 * trong 40 ms; 93% lượt lưu nằm trong chùm cùng-một-giây) — máy chủ xử song song rồi đẻ ra
 * hai phiếu công cho một ô.
 *
 * Ca này khoá HÀNH VI, không khoá cách viết: mấy ô sửa trong lúc một lượt đang bay phải gộp
 * vào ĐÚNG MỘT lượt gửi sau, và không ô nào được rơi mất.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const TEP = process.argv[2] || path.join(
	path.dirname(new URL(import.meta.url).pathname), "..", "public", "js", "matrix_store.js");

// ---- khung giả tối thiểu quanh store -------------------------------------------------
const luot = [];                    // mỗi phần tử = payload một lượt gọi máy chủ
let giaiPhong = [];                 // hàm mở khoá cho từng lượt (giữ lượt "đang bay")
globalThis.Vue = { reactive: (o) => o };
globalThis.__ = (s) => s;
globalThis.frappe = {
	show_alert() {},
	msgprint() {},
	call({ args }) {
		luot.push(JSON.parse(args.data));
		return new Promise((res) => giaiPhong.push(() => res({ message: { success: [], errors: [] } })));
	},
};

const store = (await import(pathToFileURL(TEP).href)).default;

const o = (emp, ngay, tt) => { store.updateCell(emp, ngay, "status", tt); };
const nhipCho = () => new Promise((r) => setTimeout(r, 0));

// ---- kịch bản: gõ 1 ô, rồi gõ thêm 3 ô trong lúc lượt đầu đang bay -------------------
o("HR-EMP-001", "2026-09-01", "Có mặt");
store.save();
await nhipCho();
assert.equal(luot.length, 1, "lượt đầu phải bắn ngay");

o("HR-EMP-001", "2026-09-02", "Có mặt");
store.save();
o("HR-EMP-001", "2026-09-03", "Có mặt");
store.save();
o("HR-EMP-002", "2026-09-01", "Nghỉ");
store.save();
await nhipCho();
assert.equal(luot.length, 1,
	`đang bay thì KHÔNG được bắn thêm lượt nào — đang có ${luot.length} lượt`);

// lượt đầu về đích -> phải có ĐÚNG MỘT lượt gộp cho 3 ô gõ thêm
giaiPhong.shift()();
await nhipCho(); await nhipCho(); await nhipCho();
assert.equal(luot.length, 2, `chỉ được thêm ĐÚNG MỘT lượt gộp — đang có ${luot.length}`);
assert.equal(luot[1].length, 3, `lượt gộp phải mang đủ 3 ô, đang mang ${luot[1].length}`);

giaiPhong.shift()();
await nhipCho(); await nhipCho(); await nhipCho();
assert.equal(luot.length, 2, "hết ô bẩn thì thôi, không bắn lượt rỗng");
assert.equal(store.state.dirty.size, 0, "gửi xong thì không còn ô bẩn nào");

console.log("OK — 2 lượt gửi cho 4 ô, không lượt nào chồng, không ô nào rơi mất");
