frappe.pages['attendance-matrix'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Attendance Matrix'),
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
            "/assets/attendance_matrix/css/libs/ag-grid-custom.css",
            "/assets/attendance_matrix/css/libs/ag-theme-alpine-custom.css",
            "/assets/attendance_matrix/css/attendance_matrix.css"
        ];

        frappe.require(assets, () => {
            console.log("Attendance Matrix v1.7.4 Loaded Successfully");
            this.launchVue();
        });
    }

    async launchVue() {
        const $container = $(this.wrapper).find('.layout-main-section');
        $container.html(frappe.render_template('attendance_matrix', {
            loading_text: __('Loading Attendance Matrix...')
        }));

        // Dynamically import our modules with cache buster
        const v = new Date().getTime() + "_debug_v2";
        let storeMod, gridMod;

        // Optimize Screen Real Estate
        // NOTE: We now use CSS scoped to body[data-route="attendance-matrix"] in attendance_matrix.css
        // This prevents side effects on other pages.
        $('footer').hide(); // Hide footer if present to maximize height

        try {
            storeMod = await import(`/assets/attendance_matrix/js/matrix_store.js?v=${v}`);
            gridMod = await import(`/assets/attendance_matrix/js/matrix_grid.js?v=${v}`);
        } catch (e) {
            console.error("Failed to load Matrix JS modules", e);
            frappe.msgprint(__("Error loading JS files (404 or Syntax Error). Please check Console."));
            $container.html('<div class="alert alert-danger">' + __("Cannot load JS libraries. Please run bench build.") + '</div>');
            return;
        }

        const store = storeMod.default;
        const grid = gridMod.default;

        // Check if AG Grid is loaded
        if (typeof agGrid === 'undefined') {
            frappe.msgprint(__("AG Grid library not loaded. Check public/js/libs folder."));
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

                    draggingIndex: -1,
                    draggingList: null
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
                        if (!this.tempSettings.overtime_types) this.tempSettings.overtime_types = [];

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
                                        frappe.msgprint(__("You are using the latest version ({0})", [this.appVersion]));
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
                        title: __('New Version Available!'),
                        fields: [
                            {
                                fieldtype: 'HTML',
                                fieldname: 'details',
                                options: `
                                    <div class="text-center mb-3">
                                        <h3 class="text-primary mb-1">${info.remote_version}</h3>
                                        <p class="text-muted small">${__("Current Version")}: ${info.local_version}</p>
                                    </div>
                                    <div class="alert alert-warning small">
                                        ${__("New Features / Changes")}:
                                        <pre class="mt-2 bg-light p-2 rounded text-dark" style="max-height: 150px; overflow-y: auto;">${info.changelog || __('No details available.')}</pre>
                                    </div>
                                    <p class="small text-muted mb-0"><i class="fa fa-info-circle"></i> ${__("System will restart automatically after update.")}</p>
                                `
                            }
                        ],
                        primary_action_label: __('Update Now') + ` (v${info.remote_version})`,
                        primary_action: () => {
                            d.hide();
                            frappe.call({
                                method: "attendance_matrix.attendance_matrix.utils.updates.perform_update",
                                freeze: true,
                                freeze_message: __("Updating & Restarting..."),
                                callback: (r) => {
                                    if (r.message && r.message.status === "success") {
                                        let msg = r.message.message;
                                        frappe.msgprint({
                                            title: __('Processing'),
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
                                        title: __('Restarting'),
                                        message: __("System is restarting. Please wait for connection..."),
                                        indicator: 'orange'
                                    });
                                    this.waitForServer();
                                }
                            });
                        },
                        secondary_action_label: __('Skip'),
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
                                        title: __('Connection Successful'),
                                        message: __('System is ready. Reloading...'),
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

                    // 1. Validate Status Map
                    for (let s of this.tempSettings.status_map) {
                        if (!s.status || !s.abbreviation) {
                            frappe.msgprint(__("Error: Please enter both Status Name and Abbreviation for all status rows."));
                            return;
                        }
                    }

                    // 2. Validate Overtime Types
                    if (this.tempSettings.overtime_types) {
                        for (let ot of this.tempSettings.overtime_types) {
                            if (!ot.overtime_name || !ot.abbreviation) {
                                frappe.msgprint(__("Error: Please enter both Overtime Name and Abbreviation for all overtime type rows."));
                                return;
                            }
                        }
                    }

                    // 3. Validate Shift MAP
                    for (let s of this.tempSettings.shift_map) {
                        if (!s.shift_name || !s.start_time || !s.end_time) {
                            frappe.msgprint(__("Error: Please enter Shift Name, Start Time and End Time."));
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
                        '<b>' + __('Warning') + ':</b> ' + __('This action will <b>DELETE IMMEDIATELY</b> data from the system and cannot be undone.<br>Are you sure you want to delete?'),
                        async () => {
                            // 1. Remove from UI
                            this.tempSettings[listName].splice(index, 1);

                            // 2. Save immediately to DB (Backend sync will handle deletion)
                            await store.saveSettings(this.tempSettings);

                            // 3. Re-sync tempSettings with fresh data from Store (which was reloaded by saveSettings)
                            // This ensures we have valid IDs and consistent state
                            // This ensures we have valid IDs and consistent state
                            this.tempSettings = JSON.parse(JSON.stringify(store.state.settings));
                            if (!this.tempSettings.status_map) this.tempSettings.status_map = [];
                            if (!this.tempSettings.shift_map) this.tempSettings.shift_map = [];
                            if (!this.tempSettings.overtime_types) this.tempSettings.overtime_types = [];

                            frappe.show_alert(__("Permanently deleted data row."));
                        }
                    );
                },
                confirmDeleteAll(listName) {
                    frappe.confirm(
                        '<b>' + __('Danger Warning') + ':</b> ' + __('Are you sure you want to <b>DELETE ALL</b> from this list?<br>Data will be lost permanently.'),
                        async () => {
                            this.tempSettings[listName] = [];
                            await store.saveSettings(this.tempSettings);

                            // Re-sync
                            // Re-sync
                            this.tempSettings = JSON.parse(JSON.stringify(store.state.settings));
                            if (!this.tempSettings.status_map) this.tempSettings.status_map = [];
                            if (!this.tempSettings.shift_map) this.tempSettings.shift_map = [];
                            if (!this.tempSettings.overtime_types) this.tempSettings.overtime_types = [];

                            frappe.show_alert(__("Deleted entire list."));
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
                        shift: filters.shift || "",
                        employee: filters.employee || "",
                        shift: filters.shift || "",
                        abbreviation_mode: this.store.showAbbreviations ? 1 : 0,
                        mode: this.store.viewMode
                    }).toString();
                    const url = `/api/method/attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.export_attendance_excel?${params}`;
                    window.open(url, '_blank');
                },
                resetView() {
                    this.store.filters.department = "";
                    this.store.filters.shift = "";
                    this.store.filters.employee = "";
                    frappe.show_alert(__("Filters reset"));
                    this.reload();
                },
                toggleFullscreen() {
                    const el = document.getElementById('attendance-matrix-app');
                    if (!document.fullscreenElement) {
                        el.requestFullscreen().catch(err => {
                            frappe.msgprint(__("Fullscreen Error: {0}", [err.message]));
                        });
                        // Add class to ensure white background
                        el.classList.add('bg-white');
                    } else {
                        document.exitFullscreen();
                        el.classList.remove('bg-white');
                    }
                },
                toggleColumn(colId, event) {
                    if (window.attendanceGridApi) {
                        window.attendanceGridApi.setColumnVisible(colId, event.target.checked);
                    }
                },
                redrawGrid() {
                    if (window.attendanceGridApi) {
                        window.attendanceGridApi.redrawRows();
                    }
                },
                // DRAG AND DROP HANDLERS
                onDragStart(listName, index, event) {
                    this.draggingIndex = index;
                    this.draggingList = listName;
                    event.dataTransfer.effectAllowed = 'move';
                    event.target.classList.add('dragging');
                },
                onDragEnd(event) {
                    this.draggingIndex = -1;
                    this.draggingList = null;
                    event.target.classList.remove('dragging');
                    document.querySelectorAll('.dragging-over').forEach(el => el.classList.remove('dragging-over'));
                },
                onDragEnter(listName, index, event) {
                    if (this.draggingList !== listName) return;
                    if (index === this.draggingIndex) return;

                    // Simple visual cue logic could go here, but Vue transition-group is better.
                    // Since we use simple tables, strictly reordering arrays is easiest.
                    // To prevent jitter, we only reorder on Drop or strictly throttle dragover.
                    // But native HTML5 dnd with live reorder requires careful handling.
                    // Let's implement "Drop to Reorder" style for simplicity and stability.
                    // Or "Swap on Enter" which gives immediate feedback.

                    const list = this.tempSettings[listName];
                    const item = list.splice(this.draggingIndex, 1)[0];
                    list.splice(index, 0, item);
                    this.draggingIndex = index; // Update index to new position
                }
            },
            template: `
                <div class="attendance-matrix-app d-flex flex-column bg-white">
                    <component :is="'style'">
                        .scrollable-table-container {
                            max-height: 60vh;
                            overflow-y: auto;
                            border: 1px solid #dee2e6;
                        }
                        .drag-handle {
                            cursor: move;
                            color: #aaa;
                        }
                        .drag-handle:hover {
                            color: #333;
                        }
                        tr.dragging {
                            opacity: 0.5;
                            background: #f0f0f0;
                        }
                    </component>

                    <!-- 1. Unified Header (Title + Legend + Actions) -->
                    <div class="d-flex flex-wrap justify-content-between align-items-center px-3 py-3 border-bottom bg-white flex-shrink-0 gap-3">
                         <!-- Title (Left) -->
                         <div class="d-flex align-items-center gap-3">
                             <h4 class="mb-0 fw-bold text-dark" style="font-weight: 700;">{{ __('Attendance Matrix') }}</h4>
                             <!-- Update Badge -->
                             <div v-if="appVersion" class="d-flex align-items-center gap-1 cursor-pointer" @click="checkUpdates(true)" title="Click to check for updates">
                                 <span class="badge text-uppercase tracking-wider shadow-sm" 
                                       :class="updateAvailable ? 'bg-danger text-white' : 'bg-light text-muted border'">
                                     {{ appVersion }} <i v-if="updateAvailable" class="fa fa-exclamation-circle ms-1"></i>
                                 </span>
                             </div>
                         </div>
                         
                         <!-- View Switcher (Tabs) -->
                         <div class="d-flex bg-light rounded p-1 mx-3" style="border: 1px solid #e5e7eb;">
                             <button class="btn btn-sm px-3 fw-bold" 
                                 :class="store.viewMode==='attendance' ? 'btn-primary shadow-sm text-white' : 'text-muted btn-light border-0'"
                                 style="min-width: 100px; transition: all 0.2s;"
                                 @click="store.viewMode='attendance'; redrawGrid()">
                                 {{ __('Attendance') }}
                             </button>
                             <button class="btn btn-sm px-3 fw-bold" 
                                 :class="store.viewMode==='overtime' ? 'btn-danger shadow-sm text-white' : 'text-muted btn-light border-0'"
                                 style="min-width: 100px; transition: all 0.2s;"
                                 @click="store.viewMode='overtime'; redrawGrid()">
                                 {{ __('Overtime') }}
                             </button>
                             <button class="btn btn-sm px-3 fw-bold"
                                 :class="store.viewMode==='hours' ? 'btn-success shadow-sm text-white' : 'text-muted btn-light border-0'"
                                 style="min-width: 110px; transition: all 0.2s;"
                                 @click="store.viewMode='hours'; redrawGrid()">
                                 {{ __('Chấm theo giờ') }}
                             </button>
                         </div>

                         <!-- Interactive Area (Right: Legend + Buttons) -->
                         <div class="d-flex align-items-center gap-3 ms-auto" style="min-width: 0;">
                             <!-- Legend (Attendance) -->
                             <div class="d-flex align-items-center gap-2 d-none d-xl-flex" v-if="store.viewMode === 'attendance'">
                                <span class="text-muted small fw-bold text-uppercase tracking-wider">{{ __('Code') }}:</span>
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

                             <!-- Legend (Overtime) -->
                             <div class="d-flex align-items-center gap-2 d-none d-xl-flex" v-else-if="store.viewMode === 'overtime'">
                                <span class="text-muted small fw-bold text-uppercase tracking-wider">{{ __('Overtime Codes') }}:</span>
                                <div class="d-flex gap-3 align-items-center">
                                    <div v-for="ot in store.settings.overtime_types" :key="ot.abbreviation" class="d-flex align-items-center gap-1">
                                        <span class="badge bg-light text-primary border shadow-sm" style="font-size: 11px;">
                                            {{ ot.abbreviation }}
                                        </span>
                                        <span class="small text-muted fw-bold">{{ ot.overtime_name }}</span>
                                    </div>
                                    <span v-if="!store.settings.overtime_types || store.settings.overtime_types.length === 0" class="small text-muted italic">
                                        ({{ __('No types defined') }})
                                    </span>
                                </div>
                             </div>

                             <!-- Legend (Hours) -->
                             <div class="d-flex align-items-center gap-2 d-none d-xl-flex" v-else>
                                <span class="text-muted small fw-bold">{{ __('Nhập số giờ làm mỗi ngày (vd 8 hoặc 6.5)') }}</span>
                             </div>
                             <div class="vr d-none d-xl-block mx-2"></div>

                             <!-- Actions -->
                             <div class="d-flex align-items-center gap-2">
                                <!-- View Dropdown -->
                                 <div class="dropdown">
                                    <button class="btn btn-sm btn-light border shadow-sm dropdown-toggle" type="button" data-toggle="dropdown">
                                        <i class="fa fa-eye text-muted"></i> <span class="d-none d-lg-inline ms-1">{{ __('Show') }}</span>
                                    </button>
                                    <div class="dropdown-menu dropdown-menu-right shadow p-2" style="min-width: 200px;">
                                        <h6 class="dropdown-header text-uppercase small font-weight-bold">{{ __('Display Columns') }}</h6>
                                        <div class="dropdown-item px-2 rounded">
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showIds" checked @change="toggleColumn('name', $event)">
                                                <label class="custom-control-label" for="showIds">{{ __('Employee ID') }}</label>
                                            </div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showDepts" checked @change="toggleColumn('department', $event)">
                                                <label class="custom-control-label" for="showDepts">{{ __('Department') }}</label>
                                            </div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showShifts" checked @change="toggleColumn('default_shift', $event)">
                                                <label class="custom-control-label" for="showShifts">{{ __('Default Shift') }}</label>
                                            </div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="activeOnly" v-model="store.filters.active_only">
                                                <label class="custom-control-label" for="activeOnly">{{ __('Only Active Employees') }}</label>
                                            </div>
                                            <div class="dropdown-divider"></div>
                                            <div class="custom-control custom-checkbox">
                                                <input class="custom-control-input" type="checkbox" id="showAbbr" v-model="store.showAbbreviations" @change="redrawGrid">
                                                <label class="custom-control-label" for="showAbbr">{{ __('Show Abbreviations') }}</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button class="btn btn-sm btn-light border shadow-sm" @click="resetView" :title="__('Reset Filters')">
                                    <i class="fa fa-refresh text-muted"></i> <span class="d-none d-lg-inline ms-1">{{ __('Reset') }}</span>
                                </button>
                                <button class="btn btn-sm btn-light border shadow-sm" @click="toggleFullscreen" :title="__('Fullscreen')">
                                    <i class="fa fa-expand text-muted"></i>
                                </button>
                                <button class="btn btn-sm btn-light border shadow-sm" @click="showSettings=true" title="Config Shifts and Codes">
                                    <i class="fa fa-cog text-muted"></i> <span class="d-none d-xl-inline ms-1">{{ __('Configuration') }}</span>
                                </button>
                                <button class="btn btn-sm btn-success shadow-sm" @click="exportExcel">
                                    <i class="fa fa-file-excel-o"></i> <span class="d-none d-md-inline ms-1">{{ __('Export Excel') }}</span>
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
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Company') }}</label>
                                <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.company" style="border-radius: 20px;">
                                    <option value="">-- {{ __('All') }} --</option>
                                    <option v-for="c in store.filter_options.companies" :value="c">{{ c }}</option>
                                </select>
                            </div>

                            <!-- Filter Item: Phong Ban -->
                            <div class="d-flex flex-column" style="min-width: 160px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Department') }}</label>
                                <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.department" style="border-radius: 20px;">
                                    <option value="">-- {{ __('All') }} --</option>
                                    <option v-for="d in store.filter_options.departments" :value="d">{{ d }}</option>
                                </select>
                            </div>

                             <!-- Filter Item: Nhan Vien -->
                            <div class="d-flex flex-column" style="min-width: 160px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Employee') }}</label>
                                <div class="position-relative">
                                    <input type="text" class="form-control form-control-sm border-0 shadow-sm ps-3" v-model="store.filters.employee" :placeholder="__('Search...')" list="emp-list" style="border-radius: 20px;">
                                    <i class="fa fa-search text-muted position-absolute" style="right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px;"></i>
                                </div>
                                <datalist id="emp-list">
                                    <option v-for="e in store.employees" :value="e.employee_name"></option>
                                </datalist>
                            </div>

                            <!-- Filter Item: Shift (Attendance Mode) -->
                            <div class="d-flex flex-column" style="min-width: 120px;" v-if="store.viewMode !== 'overtime'">
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Shift') }}</label>
                                 <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.shift" style="border-radius: 20px;">
                                    <option value="">-- {{ __('All') }} --</option>
                                    <option v-for="s in store.settings.shift_map" :value="s.shift_name">{{ s.shift_name }}</option>
                                </select>
                            </div>

                            <!-- Filter Item: Overtime Type (Overtime Mode) -->
                            <div class="d-flex flex-column" style="min-width: 120px;" v-if="store.viewMode === 'overtime'">
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Overtime Types') }}</label>
                                 <select class="form-select form-select-sm bg-white border-0 shadow-sm" v-model="store.filters.overtime_type" style="border-radius: 20px;">
                                    <option value="">-- {{ __('All') }} --</option>
                                    <option v-for="ot in store.settings.overtime_types" :value="ot.overtime_name">{{ ot.overtime_name }}</option>
                                </select>
                            </div>

                             <!-- Filter Item: Thang / Nam -->
                            <div class="d-flex flex-column" style="min-width: 140px;">
                                <label class="small text-muted fw-bold mb-1 ms-1">{{ __('Month / Year') }}</label>
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

                        <!-- Right: Employee Count & Permission Info -->
                        <div class="d-flex align-items-center pt-4 flex-shrink-0 ms-3" v-if="store.employees.length > 0">
                             <span class="small text-success fw-bold fst-italic me-3">
                                {{ __('Showing') }}: {{ store.employees.length }} {{ __('employees') }}
                            </span>
                            <!-- Permission Badge -->
                            <span v-if="store.permission_info" class="badge" 
                                  style="background-color: #ffe4ec; color: #6b4c5a; border: 1px solid #f8c8d8;"
                                  :title="store.permission_info.has_full_access ? __('Full Access') : __('Department Restricted')">
                                <i :class="store.permission_info.has_full_access ? 'fa fa-unlock' : 'fa fa-lock'"></i>
                                {{ store.permission_info.has_full_access ? __('All Departments') : (store.permission_info.permitted_departments ? store.permission_info.permitted_departments.join(', ') : __('All Departments')) }}
                            </span>
                        </div>
                    </div>

                    <div id="attendance-grid" class="ag-theme-alpine w-100 flex-grow-1" style="min-height: 0;"></div>

                     <!-- Settings Modal -->
                     <div v-if="showSettings" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);" tabindex="-1">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">{{ __('Configuration') }}</h5>
                                    <button type="button" class="close" @click="showSettings = false" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <!-- Tabs -->
                                    <ul class="nav nav-tabs mb-3">
                                        <li class="nav-item">
                                            <a class="nav-link" :class="{active: activeTab==='status'}" href="#" @click.prevent="activeTab='status'">{{ __('Status') }}</a>
                                        </li>
                                        <li class="nav-item">
                                            <a class="nav-link" :class="{active: activeTab==='shift'}" href="#" @click.prevent="activeTab='shift'">{{ __('Shift') }}</a>
                                        </li>
                                        <li class="nav-item">
                                            <a class="nav-link" :class="{active: activeTab==='overtime'}" href="#" @click.prevent="activeTab='overtime'">{{ __('Overtime Types') }}</a>
                                        </li>
                                    </ul>

                                    <!-- Status Tab -->
                                    <div v-if="activeTab==='status'" class="scrollable-table-container">
                                        <div class="alert alert-info small py-1 mb-2">
                                            <i class="fa fa-info-circle"></i> <b>{{ __('Payroll Status Conversion') }}:</b> 
                                            {{ __("Standard ERPNext status for payroll (Present, Absent, etc.). You can name the display status (e.g., 'Field Work') but must map it to a standard status.") }}
                                        </div>
                                        <table class="table table-bordered table-sm mb-0">
                                            <thead><tr><th style="width: 30px;"></th><th>{{ __('Status') }}</th><th>{{ __('Payroll Status') }}</th><th>{{ __('Abbr') }}</th><th>{{ __('Color') }} (Hex)</th><th>#</th></tr></thead>
                                            <tbody>
                                                <tr v-for="(row, idx) in tempSettings.status_map" :key="idx" 
                                                    draggable="true"
                                                    @dragstart="onDragStart('status_map', idx, $event)"
                                                    @dragend="onDragEnd"
                                                    @dragenter="onDragEnter('status_map', idx, $event)">
                                                    <td class="text-center align-middle drag-handle"><i class="fa fa-bars"></i></td>
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
                                        <div class="d-flex justify-content-between p-2 sticky-bottom bg-white border-top">
                                            <button class="btn btn-sm btn-light" @click="tempSettings.status_map.push({status:'', abbreviation:'', color:'#ffffff'})">+ {{ __('Add Row') }}</button>
                                            <button class="btn btn-sm btn-danger text-white" @click="confirmDeleteAll('status_map')">{{ __('Reset / Delete All') }}</button>
                                        </div>
                                    </div>

                                    <!-- Shift Tab -->
                                    <div v-if="activeTab==='shift'" class="scrollable-table-container">
                                        <table class="table table-bordered table-sm mb-0">
                                            <thead><tr><th style="width: 30px;"></th><th>{{ __('Shift Name') }}</th><th>{{ __('Start') }}</th><th>{{ __('End') }}</th><th>#</th></tr></thead>
                                            <tbody>
                                                <tr v-for="(row, idx) in tempSettings.shift_map" :key="idx"
                                                    draggable="true"
                                                    @dragstart="onDragStart('shift_map', idx, $event)"
                                                    @dragend="onDragEnd"
                                                    @dragenter="onDragEnter('shift_map', idx, $event)">
                                                    <td class="text-center align-middle drag-handle"><i class="fa fa-bars"></i></td>
                                                    <td><input v-model="row.shift_name" class="form-control form-control-sm"></td>
                                                    <td><input type="time" v-model="row.start_time" class="form-control form-control-sm"></td>
                                                    <td><input type="time" v-model="row.end_time" class="form-control form-control-sm"></td>
                                                    <td><button class="btn btn-danger btn-xs" @click="confirmDelete('shift_map', idx)">X</button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div class="d-flex justify-content-between p-2 sticky-bottom bg-white border-top">
                                            <button class="btn btn-sm btn-light" @click="tempSettings.shift_map.push({shift_name:'', start_time:'', end_time:''})">+ {{ __('Add Row') }}</button>
                                            <button class="btn btn-sm btn-danger text-white" @click="confirmDeleteAll('shift_map')">{{ __('Reset / Delete All') }}</button>
                                        </div>
                                    </div>
                                    
                                    <!-- Overtime Tab -->
                                    <div v-if="activeTab==='overtime'" class="scrollable-table-container">
                                        <div class="alert alert-info small py-1 mb-2">
                                            <i class="fa fa-info-circle"></i> <b>{{ __('Overtime Types') }}:</b> 
                                            {{ __("Define overtime codes (e.g. OT1, OT2) and their names. These will be used for shorthand entry.") }}
                                        </div>
                                        <table class="table table-bordered table-sm mb-0">
                                            <thead><tr><th style="width: 30px;"></th><th>{{ __('Name') }}</th><th>{{ __('Abbreviation') }}</th><th>#</th></tr></thead>
                                            <tbody>
                                                <tr v-for="(row, idx) in tempSettings.overtime_types" :key="idx"
                                                    draggable="true"
                                                    @dragstart="onDragStart('overtime_types', idx, $event)"
                                                    @dragend="onDragEnd"
                                                    @dragenter="onDragEnter('overtime_types', idx, $event)">
                                                    <td class="text-center align-middle drag-handle"><i class="fa fa-bars"></i></td>
                                                    <td><input v-model="row.overtime_name" class="form-control form-control-sm" placeholder="e.g. Normal Overtime"></td>
                                                    <td><input v-model="row.abbreviation" class="form-control form-control-sm" placeholder="e.g. OT1"></td>
                                                    <td><button class="btn btn-danger btn-xs" @click="confirmDelete('overtime_types', idx)">X</button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div class="d-flex justify-content-between p-2 sticky-bottom bg-white border-top">
                                            <button class="btn btn-sm btn-light" @click="tempSettings.overtime_types.push({overtime_name:'', abbreviation:''})">+ {{ __('Add Row') }}</button>
                                            <button class="btn btn-sm btn-danger text-white" @click="confirmDeleteAll('overtime_types')">{{ __('Reset / Delete All') }}</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" @click="showSettings = false">{{ __('Close') }}</button>
                                    <button type="button" class="btn btn-primary" @click="saveSettings">{{ __('Save Configuration') }}</button>
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
