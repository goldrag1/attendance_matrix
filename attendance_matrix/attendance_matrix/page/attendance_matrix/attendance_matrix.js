frappe.pages['attendance-matrix'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Bảng chấm công',
        single_column: true
    });

    // Hide standard Page Head to merge Title with Custom Actions
    $(page.wrapper).find('.page-head').hide();

    wrapper.attendance_matrix_wrapper = new AttendanceMatrixWrapper(wrapper, page);
}

class AttendanceMatrixWrapper {
    constructor(wrapper, page) {
        this.wrapper = wrapper;
        this.page = page;
        this.init();
    }

    init() {
        // Load Assets (Vue + AG Grid)
        // Adjust paths as needed. Using relative paths assuming assets are copied to public
        const assets = [
            "/assets/attendance_matrix/js/libs/vue.global.js",
            "/assets/attendance_matrix/js/libs/ag-grid-community.min.js",
            "/assets/attendance_matrix/css/ag-grid.css",
            "/assets/attendance_matrix/css/ag-theme-alpine.css",
            "/assets/attendance_matrix/css/attendance_matrix.css"
        ];

        frappe.require(assets, () => {
            this.launchVue();
        });
    }

    async launchVue() {
        const $container = $(this.wrapper).find('.layout-main-section');
        $container.html(frappe.render_template('attendance_matrix', {}));

        // Dynamically import our modules with cache buster
        const v = new Date().getTime() + "_debug_v2";
        let storeMod, gridMod;

        // Optimize Screen Real Estate
        $('.page-body').css({ 'max-width': '100%', 'margin': '0', 'padding': '0' });
        $('.layout-main-section').css({ 'max-width': '100%', 'padding': '0' });
        $('footer').hide(); // Hide footer if present to maximize height

        try {
            storeMod = await import(`/assets/attendance_matrix/js/matrix_store.js?v=${v}`);
            gridMod = await import(`/assets/attendance_matrix/js/matrix_grid.js?v=${v}`);
        } catch (e) {
            console.error("Failed to load Matrix JS modules", e);
            frappe.msgprint("Lỗi tải file JS (404 hoặc Syntax Error). Vui lòng check Console.");
            $container.html('<div class="alert alert-danger">Không thể tải thư viện JS. Hãy chạy bench build.</div>');
            return;
        }

        const store = storeMod.default;
        const grid = gridMod.default;

        // Check if AG Grid is loaded
        if (typeof agGrid === 'undefined') {
            frappe.msgprint("Thư viện AG Grid chưa được tải. Kiểm tra thư mục public/js/libs.");
            return;
        }

        const App = {
            data() {
                return {
                    isMounted: false,
                    store: store.state,
                    showSettings: false,
                    showGuide: false,
                    activeTab: "status",
                    tempSettings: { status_map: [], shift_map: [] },
                    filterTimeout: null,
                    appVersion: null,
                    updateAvailable: false,
                    isChecking: false
                }
            },
            watch: {
                'store.filters': {
                    handler() {
                        if (this.filterTimeout) clearTimeout(this.filterTimeout);
                        this.filterTimeout = setTimeout(() => {
                            this.reload();
                        }, 500);
                    },
                    deep: true
                },
                showSettings(val) {
                    if (val) {
                        // Clone settings to temp to avoid reactive mess until save
                        this.tempSettings = JSON.parse(JSON.stringify(store.state.settings));
                        // Ensure arrays exist
                        if (!this.tempSettings.status_map) this.tempSettings.status_map = [];
                        if (!this.tempSettings.shift_map) this.tempSettings.shift_map = [];

                        // Fix Time Format (HH:mm:ss -> HH:mm) for input type="time"
                        // Robustly handle '8:00:00' -> '08:00' and '17:00:00' -> '17:00'
                        const formatTime = (t) => {
                            if (!t) return "";
                            // If it already contains garbage like "8:00:", strip it
                            let parts = t.toString().split(':');
                            if (parts.length >= 2) {
                                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                            }
                            return t;
                        };

                        this.tempSettings.shift_map.forEach(s => {
                            s.start_time = formatTime(s.start_time);
                            s.end_time = formatTime(s.end_time);
                        });
                    }
                }
            },
            async mounted() {
                this.isMounted = true;
                await store.init();
                grid.init('#attendance-grid', store); // Pass store instance
                this.checkUpdates(false); // Silent check on load
            },
            methods: {
                checkUpdates(isInteractive) {
                    if (this.isChecking) return;
                    this.isChecking = true;

                    frappe.call({
                        method: "attendance_matrix.attendance_matrix.utils.updates.check_for_updates",
                        callback: (r) => {
                            this.isChecking = false;
                            if (r.message) {
                                // Smart Version Display: Ensure exactly one 'v' prefix
                                let ver = r.message.local_version || "";
                                ver = 'v' + ver.replace(/^v+/i, '');
                                this.appVersion = ver;

                                if (r.message.update_available) {
                                    this.updateAvailable = true;
                                    if (isInteractive) {
                                        this.showUpdateDialog(r.message);
                                    }
                                } else {
                                    this.updateAvailable = false;
                                    if (isInteractive) {
                                        frappe.msgprint(`Bạn đang dùng phiên bản mới nhất (${this.appVersion})`);
                                    }
                                }
                            }
                        },
                        error: () => {
                            this.isChecking = false;
                        }
                    });
                },
                showUpdateDialog(info) {
                    let d = new frappe.ui.Dialog({
                        title: 'Có phiên bản mới!',
                        fields: [
                            {
                                fieldtype: 'HTML',
                                fieldname: 'details',
                                options: `
                                    <div class="text-center mb-3">
                                        <h3 class="text-primary mb-1">${info.remote_version}</h3>
                                        <p class="text-muted small">Phiên bản hiện tại: ${info.local_version}</p>
                                    </div>
                                    <div class="alert alert-warning small">
                                        Tính năng mới / Thay đổi:
                                        <pre class="mt-2 bg-light p-2 rounded text-dark" style="max-height: 150px; overflow-y: auto;">${info.changelog || 'Không có mô tả chi tiết.'}</pre>
                                    </div>
                                    <p class="small text-muted mb-0"><i class="fa fa-info-circle"></i> Hệ thống sẽ tự động khởi động lại sau khi cập nhật.</p>
                                `
                            }
                        ],
                        primary_action_label: `Cập nhật ngay (v${info.remote_version})`,
                        primary_action: () => {
                            d.hide();
                            frappe.call({
                                method: "attendance_matrix.attendance_matrix.utils.updates.perform_update",
                                freeze: true,
                                freeze_message: "Đang cập nhật & Khởi động lại...",
                                callback: (r) => {
                                    if (r.message && r.message.status === "success") {
                                        let msg = r.message.message;
                                        frappe.msgprint({
                                            title: 'Đang xử lý',
                                            message: msg,
                                            indicator: 'orange'
                                        });

                                        // Start polling for server back up
                                        this.waitForServer();
                                    }
                                },
                                error: (r) => {
                                    // If status is 502/504 or network error, it means server is likely restarting
                                    console.log("Update outcome:", r);
                                    frappe.msgprint({
                                        title: 'Đang khởi động lại',
                                        message: "Hệ thống đang khởi động lại. Vui lòng chờ kết nối...",
                                        indicator: 'orange'
                                    });
                                    this.waitForServer();
                                }
                            });
                        },
                        secondary_action_label: 'Bỏ qua',
                        secondary_action: () => {
                            d.hide();
                        }
                    });
                    d.show();
                },
                waitForServer() {
                    // Poll the server every 1 second
                    const interval = setInterval(() => {
                        fetch('/api/method/ping')
                            .then(response => {
                                if (response.ok) {
                                    clearInterval(interval);
                                    frappe.msgprint({
                                        title: 'Kết nối thành công',
                                        message: 'Hệ thống đã sẵn sàng. Đang tải lại...',
                                        indicator: 'green'
                                    });
                                    setTimeout(() => window.location.reload(), 1000);
                                }
                            })
                            .catch(err => {
                                // Still down, keep waiting
                                console.log("Waiting for server...", err);
                            });
                    }, 1000);
                },
                reload() {
                    store.loadData();
                },
                async saveSettings() {
                    // Client-side Validation
                    for (let s of this.tempSettings.shift_map) {
                        if (!s.shift_name || !s.start_time || !s.end_time) {
                            frappe.msgprint("Lỗi: Vui lòng nhập đầy đủ Tên ca, Giờ vào và Giờ ra.");
                            return; // Stop here, modal stays OPEN
                        }
                    }

                    try {
                        await store.saveSettings(this.tempSettings);
                        // Only close if successful (store will throw if error)
                        this.showSettings = false;
                    } catch (e) {
                        // Error handled in store, but we keep modal open
                        // We can show a specific alert if needed, but store usually shows msgprint
                        console.error("Save failed, keeping modal open", e);
                    }
                },
                confirmDelete(listName, index) {
                    frappe.confirm(
                        '<b>Cảnh báo:</b> Hành động này sẽ <b>XÓA NGAY LẬP TỨC</b> dữ liệu khỏi hệ thống và không thể hoàn tác.<br>Bạn có chắc chắn muốn xóa?',
                        async () => {
                            // 1. Remove from UI
                            this.tempSettings[listName].splice(index, 1);

                            // 2. Save immediately to DB (Backend sync will handle deletion)
                            await store.saveSettings(this.tempSettings);

                            // 3. Re-sync tempSettings with fresh data from Store (which was reloaded by saveSettings)
                            // This ensures we have valid IDs and consistent state
                            this.tempSettings = JSON.parse(JSON.stringify(store.state.settings));
                            if (!this.tempSettings.status_map) this.tempSettings.status_map = [];
                            if (!this.tempSettings.shift_map) this.tempSettings.shift_map = [];

                            frappe.show_alert("Đã xóa vĩnh viễn dòng dữ liệu.");
                        }
                    );
                },
                confirmDeleteAll(listName) {
                    frappe.confirm(
                        '<b>Cảnh báo nguy hiểm:</b> Bạn có chắc chắn muốn <b>XÓA SẠCH TOÀN BỘ</b> danh sách này không?<br>Dữ liệu sẽ bị mất vĩnh viễn.',
                        async () => {
                            this.tempSettings[listName] = [];
                            await store.saveSettings(this.tempSettings);

                            // Re-sync
                            this.tempSettings = JSON.parse(JSON.stringify(store.state.settings));
                            if (!this.tempSettings.status_map) this.tempSettings.status_map = [];
                            if (!this.tempSettings.shift_map) this.tempSettings.shift_map = [];

                            frappe.show_alert("Đã xóa sạch toàn bộ danh sách.");
                        }
                    );
                },
                exportExcel() {
                    let filters = this.store.filters;
                    const params = new URLSearchParams({
                        month: filters.month || "",
                        year: filters.year || "",
                        department: filters.department || "",
                        company: filters.company || "",
                        employee: filters.employee || "",
                        shift: filters.shift || ""
                    }).toString();
                    const url = `/api/method/attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.export_attendance_excel?${params}`;
                    window.open(url, '_blank');
                },
                resetView() {
                    this.store.filters.department = "";
                    this.store.filters.shift = "";
                    this.store.filters.employee = "";
                    frappe.show_alert("Đã đặt lại bộ lọc");
                    this.reload();
                },
                toggleFullscreen() {
                    const el = document.getElementById('attendance-matrix-app');
                    if (!document.fullscreenElement) {
                        el.requestFullscreen().catch(err => {
                            frappe.msgprint(`Lỗi Fullscreen: ${err.message}`);
                        });
                        // Add class to ensure white background
                        el.classList.add('bg-white');
                    } else {
                        document.exitFullscreen();
                        el.classList.remove('bg-white');
                    }
                }
            },
            template: `
                <div class="attendance-matrix-app d-flex flex-column bg-white" style="height: calc(100vh - 65px); overflow: hidden;">
                    <!-- 1. Unified Header (Title + Legend + Actions) -->
                    <div class="d-flex flex-wrap justify-content-between align-items-center px-3 py-3 border-bottom bg-white flex-shrink-0 gap-3">
                         <!-- Title (Left) -->
                         <div class="d-flex align-items-center gap-3">
                             <h4 class="mb-0 fw-bold text-dark" style="font-weight: 700;">Bảng chấm công</h4>
                             <!-- Update Badge -->
                             <div v-if="appVersion" class="d-flex align-items-center gap-1 cursor-pointer" @click="checkUpdates(true)" title="Click to check for updates">
                                 <span class="badge text-uppercase tracking-wider shadow-sm" 
                                       :class="updateAvailable ? 'bg-danger text-white' : 'bg-light text-muted border'">
                                     {{ appVersion }} <i v-if="updateAvailable" class="fa fa-exclamation-circle ms-1"></i>
                                 </span>
                             </div>
                         </div>

                         <!-- Interactive Area (Right: Legend + Buttons) -->
                         <div class="d-flex align-items-center gap-3 ms-auto" style="min-width: 0;">
                             <!-- Legend -->
                             <div class="d-flex align-items-center gap-2 d-none d-xl-flex">
                                <span class="text-muted small fw-bold text-uppercase tracking-wider">Mã:</span>
                                <div class="d-flex gap-2 align-items-center">
                                    <div v-for="s in store.settings.status_map" :key="s.abbreviation" class="d-flex align-items-center gap-1">
                                        <span class="badge border text-dark shadow-sm d-flex align-items-center justify-content-center" 
                                              :style="{backgroundColor: s.color || '#fff', minWidth: '24px', height: '24px', fontSize: '11px'}" 
                                              :title="s.status">
                                            {{ s.abbreviation }}
                                        </span>
                                        <span class="small text-muted">{{ s.status }}</span>
                                    </div>
                                </div>
                             </div>
                             <div class="vr d-none d-xl-block mx-2"></div>

                             <!-- Actions -->
                             <div class="d-flex align-items-center gap-2">
                                <!-- View Dropdown -->
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-light border shadow-sm dropdown-toggle" type="button" data-toggle="dropdown">
                                        <i class="fa fa-eye text-muted"></i> <span class="d-none d-lg-inline ms-1">Hiển thị</span>
                                    </button>
                                    <div class="dropdown-menu dropdown-menu-right shadow p-2" style="min-width: 200px;">
                                        <h6 class="dropdown-header text-uppercase small font-weight-bold">Cột hiển thị</h6>
                                        <div class="dropdown-item px-2 rounded">
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showIds" checked onchange="if(window.attendanceGridApi) window.attendanceGridApi.setColumnVisible('name', this.checked)">
                                                <label class="custom-control-label" for="showIds">Mã Nhân viên</label>
                                            </div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showDepts" checked onchange="if(window.attendanceGridApi) window.attendanceGridApi.setColumnVisible('department', this.checked)">
                                                <label class="custom-control-label" for="showDepts">Phòng ban</label>
                                            </div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showShifts" checked onchange="if(window.attendanceGridApi) window.attendanceGridApi.setColumnVisible('default_shift', this.checked)">
                                                <label class="custom-control-label" for="showShifts">Ca mặc định</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button class="btn btn-sm btn-light border shadow-sm" @click="resetView" title="Reset Filters">
                                    <i class="fa fa-refresh text-muted"></i> <span class="d-none d-lg-inline ms-1">Reset</span>
                                </button>
                                <button class="btn btn-sm btn-light border shadow-sm" @click="toggleFullscreen" title="Toàn màn hình">
                                    <i class="fa fa-expand text-muted"></i>
                                </button>
                                <button class="btn btn-sm btn-light border shadow-sm" @click="showSettings=true" title="Cấu hình Ca và Mã">
                                    <i class="fa fa-cog text-muted"></i> <span class="d-none d-xl-inline ms-1">Cấu hình Ca và Mã</span>
                                </button>
                                <button class="btn btn-sm btn-success shadow-sm" @click="exportExcel">
                                    <i class="fa fa-file-excel-o"></i> <span class="d-none d-md-inline ms-1">Xuất Excel</span>
                                </button>
                             </div>
                         </div>
                    </div>

                    <!-- 2. Filter Bar (Bottom) -->
                    <div class="d-flex justify-content-between align-items-start px-3 py-2 bg-light border-bottom flex-shrink-0">
                         <!-- Left: Filters Group -->
                        <div class="d-flex flex-wrap align-items-start gap-3">
                             <!-- Filter Item: Cong Ty -->
                            <div class="d-flex flex-column" style="min-width: 160px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">Công ty</label>
                                <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.company" style="border-radius: 20px;">
                                    <option value="">-- Tất cả --</option>
                                    <option v-for="c in store.filter_options.companies" :value="c">{{ c }}</option>
                                </select>
                            </div>

                            <!-- Filter Item: Phong Ban -->
                            <div class="d-flex flex-column" style="min-width: 160px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">Phòng ban</label>
                                <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.department" style="border-radius: 20px;">
                                    <option value="">-- Tất cả --</option>
                                    <option v-for="d in store.filter_options.departments" :value="d">{{ d }}</option>
                                </select>
                            </div>

                             <!-- Filter Item: Nhan Vien -->
                            <div class="d-flex flex-column" style="min-width: 160px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">Nhân viên</label>
                                <div class="position-relative">
                                    <input type="text" class="form-control form-control-sm border-0 shadow-sm ps-3" v-model="store.filters.employee" placeholder="Nhập tên..." list="emp-list" style="border-radius: 20px;">
                                    <i class="fa fa-search text-muted position-absolute" style="right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px;"></i>
                                </div>
                                <datalist id="emp-list">
                                    <option v-for="e in store.employees" :value="e.employee_name"></option>
                                </datalist>
                            </div>

                             <!-- Filter Item: Chinh Ca -->
                            <div class="d-flex flex-column" style="min-width: 120px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">Chỉnh Ca</label>
                                 <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.shift" style="border-radius: 20px;">
                                    <option value="">-- Tất cả --</option>
                                    <option v-for="s in store.settings.shift_map" :value="s.shift_name">{{ s.shift_name }}</option>
                                </select>
                            </div>

                             <!-- Filter Item: Thang / Nam -->
                            <div class="d-flex flex-column" style="min-width: 140px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">Tháng / Năm</label>
                                <div class="d-flex gap-1">
                                    <select class="form-select form-select-sm bg-white border-0 shadow-sm px-2" v-model="store.filters.month" style="flex: 1; border-radius: 20px;">
                                        <option v-for="m in 12" :value="m">T{{ m }}</option>
                                    </select>
                                    <select class="form-select form-select-sm bg-white border-0 shadow-sm px-2" v-model="store.filters.year" style="flex: 1; border-radius: 20px;">
                                        <option v-for="y in store.filter_options.fiscal_years" :value="y">{{ y }}</option>
                                        <option v-if="!store.filter_options.fiscal_years.includes(new Date().getFullYear().toString())" :value="new Date().getFullYear()">{{ new Date().getFullYear() }}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Right: Employee Count -->
                        <div class="d-flex align-items-center pt-4 flex-shrink-0 ms-3" v-if="store.employees.length > 0">
                             <span class="small text-success fw-bold fst-italic">
                                Hiển thị: {{ store.employees.length }} nhân sự
                            </span>
                        </div>
                    </div>

                    <div id="attendance-grid" class="ag-theme-alpine w-100 flex-grow-1" style="min-height: 0;"></div>

                     <!-- Settings Modal -->
                     <div v-if="showSettings" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);" tabindex="-1">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Cấu hình Chấm công</h5>
                                    <button type="button" class="close" @click="showSettings = false" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <!-- Tabs -->
                                    <ul class="nav nav-tabs mb-3">
                                        <li class="nav-item">
                                            <a class="nav-link" :class="{active: activeTab==='status'}" href="#" @click.prevent="activeTab='status'">Trạng thái</a>
                                        </li>
                                        <li class="nav-item">
                                            <a class="nav-link" :class="{active: activeTab==='shift'}" href="#" @click.prevent="activeTab='shift'">Ca làm việc</a>
                                        </li>
                                    </ul>

                                    <!-- Status Tab -->
                                    <div v-if="activeTab==='status'">
                                        <div class="alert alert-info small py-1 mb-2">
                                            <i class="fa fa-info-circle"></i> <b>Quy đổi Lương (Payroll Status):</b> 
                                            Là trạng thái chuẩn của ERPNext dùng để tính lương (VD: Present, Absent...). 
                                            Bạn có thể đặt tên hiển thị tùy ý (VD: "Đi thị trường") nhưng phải quy đổi về trạng thái chuẩn này.
                                        </div>
                                        <table class="table table-bordered table-sm">
                                            <thead><tr><th>Trạng thái</th><th>Quy đổi Lương</th><th>Viết tắt</th><th>Màu (Hex)</th><th>#</th></tr></thead>
                                            <tbody>
                                                <tr v-for="(row, idx) in tempSettings.status_map" :key="idx">
                                                    <td><input v-model="row.status" class="form-control form-control-sm"></td>
                                                    <td>
                                                        <select v-model="row.payroll_status" class="form-select form-select-sm">
                                                            <option value="Present">Present</option>
                                                            <option value="Absent">Absent</option>
                                                            <option value="On Leave">On Leave</option>
                                                            <option value="Half Day">Half Day</option>
                                                            <option value="Work From Home">Work From Home</option>
                                                        </select>
                                                    </td>
                                                    <td><input v-model="row.abbreviation" class="form-control form-control-sm"></td>
                                                    <td><input type="color" v-model="row.color" class="form-control form-control-sm form-control-color"></td>
                                                    <td><button class="btn btn-danger btn-xs" @click="confirmDelete('status_map', idx)">X</button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div class="d-flex justify-content-between">
                                            <button class="btn btn-sm btn-light" @click="tempSettings.status_map.push({status:'', abbreviation:'', color:'#ffffff'})">+ Thêm dòng</button>
                                            <button class="btn btn-sm btn-danger text-white" @click="confirmDeleteAll('status_map')">Reset / Xóa toàn bộ</button>
                                        </div>
                                    </div>

                                    <!-- Shift Tab -->
                                    <div v-if="activeTab==='shift'">
                                        <table class="table table-bordered table-sm">
                                            <thead><tr><th>Tên Ca</th><th>Vào</th><th>Ra</th><th>#</th></tr></thead>
                                            <tbody>
                                                <tr v-for="(row, idx) in tempSettings.shift_map" :key="idx">
                                                    <td><input v-model="row.shift_name" class="form-control form-control-sm"></td>
                                                    <td><input type="time" v-model="row.start_time" class="form-control form-control-sm"></td>
                                                    <td><input type="time" v-model="row.end_time" class="form-control form-control-sm"></td>
                                                    <td><button class="btn btn-danger btn-xs" @click="confirmDelete('shift_map', idx)">X</button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div class="d-flex justify-content-between">
                                            <button class="btn btn-sm btn-light" @click="tempSettings.shift_map.push({shift_name:'', start_time:'', end_time:''})">+ Thêm dòng</button>
                                            <button class="btn btn-sm btn-danger text-white" @click="confirmDeleteAll('shift_map')">Reset / Xóa toàn bộ</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" @click="showSettings = false">Đóng</button>
                                    <button type="button" class="btn btn-primary" @click="saveSettings">Lưu cấu hình</button>
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>
            `
        };

        const app = Vue.createApp(App);
        window.attendanceMatrixApp = app.mount('#attendance-matrix-app');
    }
}
