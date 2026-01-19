
export default {
    state: Vue.reactive({
        filters: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            company: "",
            department: "",
            employee: "",
            shift: ""
        },
        employees: [],
        attendance: {}, // { employee_date: { status, hours, ... }}
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
        dirty: new Set() // Track changed employees
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
            this.state.settings = data.settings || { status_map: [], shift_map: [] }; // settings
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

    async save() {
        if (this.state.dirty.size === 0) {
            frappe.show_alert("Không có thay đổi nào");
            return;
        }

        this.state.saving = true;
        const changes = [];
        this.state.dirty.forEach(key => {
            const record = this.state.attendance[key];
            if (record) {
                changes.push({
                    employee: record.employee || key.split("_")[0],
                    date: record.date || key.split("_")[1],
                    status: record.status,
                    hours: record.hours
                });
            }
        });

        try {
            const r = await frappe.call({
                method: "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.save_matrix_bulk",
                args: { data: JSON.stringify(changes) }
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
                this.state.dirty.clear();
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

            const doc = {
                doctype: "Attendance Matrix Settings",
                status_map: cleanStatus,
                shift_map: cleanShift
            };

            await frappe.call({
                method: "attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.save_attendance_settings",
                args: {
                    status_map: JSON.stringify(cleanStatus),
                    shift_map: JSON.stringify(cleanShift)
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
