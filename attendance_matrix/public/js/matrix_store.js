
export default {
    state: Vue.reactive({
        filters: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            company: "",
            department: "",
            employee: "",
            shift: "",
            overtime_type: "", // Added overtime filter
            active_only: true
        },
        employees: [],
        attendance: {}, // { employee_date: { status, hours, ... }}
        hours_log: {}, // { employee_date: number } — independent hourly-tracking store (Attendance Hours Log)
        holidays: [],
        meta: {}, // first_day, last_day
        filter_options: {
            companies: [],
            departments: [],
            fiscal_years: []
        },
        settings: {
            status_map: [],
            shift_map: []
        },
        permission_info: null, // User's department permission info
        loading: false,
        saving: false,
        dirty: new Set(), // Track changed employees
        loading: false,
        saving: false,
        dirty: new Set(), // Track changed employees
        showAbbreviations: true, // Toggle for Abbreviation Mode
        viewMode: "attendance" // 'attendance' | 'overtime' | 'hours'
    }),

    async init() {
        await this.loadData();
    },

    async loadData() {
        this.state.loading = true;

        // Validate month
        if (!this.state.filters.month || this.state.filters.month < 1) {
            this.state.filters.month = new Date().getMonth() + 1;
        }

        console.log("Store: Calling get_matrix_data...", this.state.filters); // DEBUG LOG

        try {
            const r = await frappe.call({
                method: "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.get_matrix_data",
                args: this.state.filters
            });

            console.log("Store: Received response", r); // DEBUG LOG
            const data = r.message;

            if (!data) {
                console.error("Store: No data received");
                frappe.msgprint("Không nhận được dữ liệu từ server");
                return;
            }

            console.log("Store: Setting State...", data.meta); // DEBUG LOG

            this.state.meta = data.meta || {};

            // Extract options
            if (data.meta && data.meta.filter_options) {
                this.state.filter_options = data.meta.filter_options;
            }

            this.state.attendance = data.attendance || {};
            this.state.holidays = data.holidays || [];
            this.state.attendance = data.attendance || {};
            this.state.holidays = data.holidays || [];
            this.state.settings = data.settings || { status_map: [], shift_map: [], overtime_types: [] }; // settings
            this.state.hours_log = data.hours_log || {}; // independent hourly-tracking data
            // Safety Init
            if (!this.state.settings.overtime_types) this.state.settings.overtime_types = [];
            this.state.permission_info = data.permission_info || null; // Permission info
            this.state.employees = data.employees || []; // Set employees LAST to trigger update
            this.state.dirty.clear();

            console.log("Store: State Updated. Employees:", this.state.employees.length); // DEBUG LOG

            if (this.state.employees.length === 0) {
                frappe.msgprint("Không tìm thấy nhân viên nào (Status='Active'). Kiểm tra lại dữ liệu Employee.");
            }

        } catch (e) {
            console.error(e);
            frappe.msgprint("Lỗi kết nối: " + (e.message || e));
        } finally {
            this.state.loading = false;
        }
    },

    updateCell(employee, dateStr, field, value) {
        const key = `${employee}_${dateStr}`;
        if (!this.state.attendance[key]) {
            this.state.attendance[key] = {
                employee: employee,
                date: dateStr,
                status: "",
                hours: 0
            };
        }

        this.state.attendance[key][field] = value;
        this.state.dirty.add(key);
    },

    // CHỐT ĐANG-BAY (04/09/2026) — vì sao có, đọc kỹ trước khi gỡ:
    // lưới gọi save() sau MỖI ô sửa (matrix_grid.js, "AUTO-SAVE"), và bản cũ không có chốt
    // nào cả: đo trên prod tamdinh, một phiên bắn `save_matrix_bulk` 4 lượt trong 40 ms rồi
    // 5 lượt nữa 15 giây sau, cùng một payload; 967/1036 lượt lưu (93%) nằm trong 207 chùm
    // cùng-một-giây. Máy chủ xử song song ⇒ một ô đẻ ra HAI phiếu công đã duyệt, và lượt đi
    // sau ăn TimestampMismatchError (vé FB-2026-00030).
    // Debounce KHÔNG đủ: hết thời gian chờ là bắn, mạng chậm thì lượt trước vẫn đang bay.
    // Ở đây: đang bay thì KHÔNG bắn lượt mới — chỉ ghi nhớ là còn ô bẩn; bay xong mới gửi
    // MỘT lượt gộp mọi ô bẩn phát sinh trong lúc chờ. Máy chủ vẫn có chốt riêng của nó
    // (đọc-khoá theo nhân viên × ngày) — cổng phải đứng ở CẢ hai phía.
    async save() {
        if (this._dangLuu) {
            this._conOBan = true;      // gộp vào lượt sau, đừng bắn chồng
            return this._dangLuu;
        }
        if (this.state.dirty.size === 0) {
            frappe.show_alert("Không có thay đổi nào");
            return;
        }
        this._dangLuu = this._luuMotLuot();
        try {
            return await this._dangLuu;
        } finally {
            this._dangLuu = null;
            if (this._conOBan) {
                this._conOBan = false;
                if (this.state.dirty.size > 0) this.save();
            }
        }
    },

    async _luuMotLuot() {
        this.state.saving = true;
        // Chốt danh sách ô gửi đi NGAY BÂY GIỜ. Bản cũ `dirty.clear()` khi thành công, tức
        // xoá luôn những ô người dùng vừa gõ TRONG LÚC lượt này đang bay — mất thầm lặng.
        const lo = Array.from(this.state.dirty);
        const changes = [];
        const mode = this.state.viewMode; // 'attendance' or 'overtime'

        lo.forEach(key => {
            const record = this.state.attendance[key];
            if (record) {
                let statusVal = record.status;
                if (mode === 'overtime') {
                    // Lưới ghi chuỗi tăng ca đã định dạng vào 'overtime_text'.
                    statusVal = record.overtime_text || "";
                } else if (mode === 'hours') {
                    // Chế độ chấm theo giờ: lưới ghi số giờ gõ vào 'hours_input'.
                    statusVal = (record.hours_input === undefined || record.hours_input === null) ? "" : record.hours_input;
                }

                changes.push({
                    employee: record.employee || key.split("_")[0],
                    date: record.date || key.split("_")[1],
                    status: statusVal // Backend expects 'status' key but treats it based on mode
                });
            }
        });

        try {
            const r = await frappe.call({
                method: "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.save_matrix_bulk",
                args: {
                    data: JSON.stringify(changes),
                    mode: mode
                }
            });

            if (r.message && r.message.errors && r.message.errors.length > 0) {
                // Build detailed error message
                let errorDetails = r.message.errors.map(e =>
                    `<li><strong>${e.employee}</strong> (${e.date}): ${e.error}</li>`
                ).join("");

                frappe.msgprint({
                    title: __("Lưu thất bại"),
                    indicator: "red",
                    message: `<p>Không thể lưu ${r.message.errors.length} dòng:</p><ul>${errorDetails}</ul>`
                });
                console.error(r.message.errors);
            } else {
                frappe.show_alert("Đã lưu thành công", 5);
                // Chỉ bỏ đúng những ô vừa gửi — ô gõ thêm trong lúc chờ vẫn còn bẩn và sẽ
                // đi trong lượt gộp ngay sau đây.
                lo.forEach(key => this.state.dirty.delete(key));
            }
        } catch (e) {
            frappe.msgprint("Lỗi khi lưu");
            console.error(e);
        } finally {
            this.state.saving = false;
        }
    },

    async saveSettings(newSettings) {
        // newSettings: { status_map: [], shift_map: [] }
        try {
            this.state.saving = true;


            // SANITIZATION: Deduplicate before sending
            // Keep the LAST occurrence if duplicates exist (so user's latest edit wins)
            const cleanStatus = Array.from(new Map(newSettings.status_map.map(item => [item.abbreviation, item])).values());
            const cleanShift = Array.from(new Map(newSettings.shift_map.map(item => [item.shift_name, item])).values());
            const cleanOvertime = Array.from(new Map(newSettings.overtime_types.map(item => [item.abbreviation, item])).values());

            const doc = {
                doctype: "Attendance Matrix Settings",
                status_map: cleanStatus,
                shift_map: cleanShift,
                overtime_types: cleanOvertime
            };

            await frappe.call({
                method: "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.save_attendance_settings",
                args: {
                    status_map: JSON.stringify(cleanStatus),
                    shift_map: JSON.stringify(cleanShift),
                    overtime_types: JSON.stringify(cleanOvertime)
                }
            });

            frappe.show_alert("Đã lưu cấu hình!");
            await this.loadData();

        } catch (e) {
            console.error(e);
            frappe.msgprint("Lỗi lưu cấu hình: " + (e.message || JSON.stringify(e)));
            throw e; // RETHROW so the UI knows to keep the modal open
        } finally {
            this.state.saving = false;
        }
    }
};
