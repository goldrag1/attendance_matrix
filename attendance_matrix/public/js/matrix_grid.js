// import store from './matrix_store.js'; // REMOVED to avoid split instance
let store;
let gridApi; // Local reference if needed

export default {
    gridApi: null,

    init(selector, storeInstance) {
        store = storeInstance; // Inject store

        // Create Style Tag for Column Highlight
        let hoverStyle = document.getElementById('matrix-column-hover-style');
        if (!hoverStyle) {
            hoverStyle = document.createElement('style');
            hoverStyle.id = 'matrix-column-hover-style';
            document.head.appendChild(hoverStyle);
        }

        const gridOptions = {
            columnDefs: [],
            rowData: [],
            defaultColDef: {
                resizable: true, // Allow resizing
                sortable: true,
                suppressKeyboardEvent: this.suppressKeyboardEvent,
                wrapHeaderText: true, // Enable wrapping
                autoHeaderHeight: true // Enable auto height
            },
            rowHeight: 40,
            headerHeight: null, // Let autoHeaderHeight work
            singleClickEdit: true,
            stopEditingWhenCellsLoseFocus: true,
            onCellValueChanged: this.onCellValueChanged.bind(this),
            onCellMouseOver: (params) => {
                const colId = params.column.getId();
                // Light Blue Highlight (similar to row hover)
                hoverStyle.innerHTML = `.ag-theme-alpine .ag-row .ag-cell[col-id="${colId}"] { background-color: rgba(220, 238, 255, 0.5) !important; }`;
            },
            onCellMouseOut: () => {
                hoverStyle.innerHTML = "";
            }
        };

        const eGridDiv = document.querySelector(selector);
        this.gridApi = agGrid.createGrid(eGridDiv, gridOptions);
        window.attendanceGridApi = this.gridApi; // Expose to window for external controls (like filters/excel output)

        console.log("Grid Init Complete");

        // React to store changes
        Vue.watch(() => store.state.employees, () => { console.log('Employees changed'); this.updateGrid(); });
        Vue.watch(() => store.state.meta, () => { console.log('Meta changed'); this.updateGrid(); }, { deep: true });
        Vue.watch(() => store.state.viewMode, () => { console.log('ViewMode changed'); this.updateGrid(); });

        // Initial Render (Prevent race condition if data loaded before grid init)
        this.updateGrid();
    },

    suppressKeyboardEvent(params) {
        // Allow standard navigation
        return false;
    },

    updateGrid() {
        console.log("Updating Grid...", store.state.meta);
        if (!store.state.meta.first_day) {
            console.warn("Meta first_day missing", store.state.meta);
            return;
        }

        const cols = this.buildColumns();
        const rows = store.state.employees;

        console.log("Columns:", cols.length, "Rows:", rows.length);

        if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', cols);
            this.gridApi.setGridOption('rowData', rows);
        }
    },

    buildColumns() {
        const meta = store.state.meta;
        if (!meta.first_day) return [];

        const viewMode = store.state.viewMode || 'attendance';
        const isOvertime = viewMode === 'overtime';
        const isHours = viewMode === 'hours';

        // Fixed Columns
        const cols = [
            {
                headerName: __("Department"),
                field: "department",
                pinned: "left",
                width: 150,
                cellStyle: { 'text-align': 'left' }
            },
            {
                headerName: __("Employee ID"),
                field: "name",
                pinned: "left",
                width: 100,
                cellStyle: { 'text-align': 'left' }
            },
            {
                headerName: __("Employee Name"),
                field: "employee_name",
                pinned: "left",
                width: 200,
                cellRenderer: p => `<b>${p.value}</b>`,
                cellStyle: { 'text-align': 'left' }
            },
            {
                headerName: __("Status"),
                field: "status",
                pinned: "left",
                width: 100,
                hide: store.state.filters.active_only,
                cellStyle: (params) => {
                    // Visual cues for non-active status
                    if (params.value !== 'Active') {
                        return { 'color': 'red', 'font-weight': 'bold', 'text-align': 'left' };
                    }
                    return { 'color': 'green', 'text-align': 'left' };
                }
            },
            {
                headerName: __("Shift"),
                field: "default_shift",
                pinned: "left",
                width: 120,
                cellStyle: { 'text-align': 'left' },
                hide: viewMode === 'overtime', // Hide Shift in OT mode
                editable: viewMode !== 'overtime', // Disable editing if hidden (safety)
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: store.state.settings.shift_map.map(s => s.shift_name)
                },
                onCellValueChanged: (params) => {
                    if (params.newValue !== params.oldValue && viewMode !== 'overtime') {
                        // Use custom method to handle Auto-Creation of Shift Type
                        frappe.call({
                            method: 'attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.set_employee_shift',
                            args: {
                                employee: params.data.name,
                                shift_name: params.newValue
                            },
                            callback: (r) => {
                                if (!r.exc) {
                                    frappe.show_alert(__("Shift updated: {0}", [params.newValue]));
                                }
                            }
                        });
                    }
                }
            },
            {
                headerName: __("Overtime Type"), // New Column
                field: "overtime_type_selector",
                pinned: "left",
                width: 130,
                cellStyle: { 'text-align': 'left', 'font-weight': 'bold' },
                hide: viewMode !== 'overtime', // Only show in OT mode
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: (function () {
                        const types = store.state.settings.overtime_types.map(ot => ot.overtime_name);
                        return [...types, __("Mixed")];
                    })()
                },
                valueGetter: (params) => {
                    // Logic:
                    // 1. Manual Override (temp_ot_prefs) has highest priority.
                    // 2. Scan data:
                    //    - If 0 data -> Default to First Configured Type.
                    //    - If 1 type found -> Use that type.
                    //    - If >1 types found -> "Mixed".

                    const empId = params.data.name;

                    // 1. Check Manual Override
                    if (store.state.temp_ot_prefs && store.state.temp_ot_prefs[empId]) {
                        return store.state.temp_ot_prefs[empId];
                    }

                    // 2. Scan Data
                    const otParams = store.state.settings.overtime_types || [];
                    if (otParams.length === 0) return "";

                    const meta = store.state.meta;
                    if (!meta.first_day) return otParams[0].overtime_name; // Default

                    const distinctTypes = new Set();
                    const start = new Date(meta.first_day);

                    for (let i = 0; i < meta.days_in_month; i++) {
                        // Reconstruct date key
                        const d = new Date(start);
                        d.setDate(start.getDate() + i);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;

                        const key = `${empId}_${dateStr}`;
                        const record = store.state.attendance[key];

                        if (record && record.overtime && record.overtime.length > 0) {
                            record.overtime.forEach(ot => distinctTypes.add(ot.type));
                        }
                    }

                    if (distinctTypes.size === 0) {
                        return otParams[0].overtime_name; // Default
                    } else if (distinctTypes.size === 1) {
                        return Array.from(distinctTypes)[0];
                    } else {
                        return __("Mixed");
                    }
                },
                valueSetter: (params) => {
                    const newVal = params.newValue;
                    if (newVal === params.oldValue) return false;

                    // Helper to save preference
                    const empId = params.data.name;
                    if (!store.state.temp_ot_prefs) store.state.temp_ot_prefs = {};
                    store.state.temp_ot_prefs[empId] = newVal;

                    return true; // value changed
                }
            },
        ];

        // Dynamic Day Columns
        // Dynamic Day Columns
        // Use standard JS Date to avoid Frappe util issues
        const start = new Date(meta.first_day);
        const days = meta.days_in_month;

        for (let i = 0; i < days; i++) {
            // Create new date instance for current day
            const d = new Date(start);
            d.setDate(start.getDate() + i);

            // Format YYYY-MM-DD manually to be safe
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const dayOfWeek = d.getDay();
            // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

            // Excel Header Format: "1 Sat", "2 Sun"
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            // Use newline for wrapping
            const headerName = `${d.getDate()} \n ${dayNames[dayOfWeek]}`;

            // Check Holiday
            const isHoliday = store.state.holidays.find(h => h.holiday_date === dateStr);

            let headerClass = "text-center";
            let cellClass = "text-center";

            if (dayOfWeek === 0) { headerClass += " sunday-header"; cellClass += " sunday-col"; }
            else if (dayOfWeek === 6) { headerClass += " saturday-header"; cellClass += " saturday-col"; }

            // Check Today
            const today = new Date();
            if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                headerClass += " today-header";
                cellClass += " today-col";
            }

            if (isHoliday) { headerClass += " holiday-header"; cellClass += " holiday-col"; }

            cols.push({
                headerName: headerName,
                field: dateStr,
                width: 70, // Slightly wider for OT text
                headerClass: headerClass,
                cellClass: (isOvertime || isHours) ? cellClass : (params) => {
                    // ATTENDANCE MODE: Existing Color Logic
                    const val = params.value;
                    if (val) {
                        const settings = store.state.settings.status_map || [];
                        const config = settings.find(s => s.status === val || s.abbreviation === val);
                        if (config && config.color) {
                            return "text-center";
                        }
                    }
                    return cellClass;
                },
                cellStyle: isOvertime ? (params) => {
                    // OVERTIME MODE: Just visual feedback for non-empty
                    if (params.value) return { 'background-color': '#e3f2fd', 'font-weight': 'bold' };
                    return null;
                } : isHours ? (params) => {
                    // HOURS MODE: light tint for filled cells
                    if (params.value !== '' && params.value !== null && params.value !== undefined) {
                        return { 'background-color': '#f1f8e9', 'font-weight': 'bold', 'text-align': 'center' };
                    }
                    return null;
                } : (params) => {
                    // ATTENDANCE MODE: Existing Color Logic
                    const val = params.value;
                    if (!val) return null;
                    const settings = store.state.settings.status_map || [];
                    const config = settings.find(s => s.status === val || s.abbreviation === val);
                    if (config && config.color) {
                        return {
                            'background-color': config.color,
                            'color': '#000',
                            'font-weight': '500'
                        };
                    }
                    return null;
                },
                editable: true,
                cellRenderer: (isOvertime || isHours) ? null : params => {
                    const val = params.value;
                    if (!val) return "";
                    // Abbreviation Logic
                    if (store.state.showAbbreviations) {
                        const settings = store.state.settings.status_map || [];
                        const config = settings.find(s => s.status === val || s.abbreviation === val);
                        if (config && config.status === val && config.abbreviation) {
                            return config.abbreviation;
                        }
                    }
                    return val;
                },
                valueGetter: (params) => {
                    const key = `${params.data.name}_${dateStr}`;
                    const record = store.state.attendance[key];

                    if (isHours) {
                        // HOURS MODE: prefer in-progress edit (hours_input), else canonical hours_log
                        if (record && Object.prototype.hasOwnProperty.call(record, 'hours_input')) {
                            return (record.hours_input === null || record.hours_input === undefined) ? "" : record.hours_input;
                        }
                        const v = (store.state.hours_log || {})[key];
                        return (v === undefined || v === null) ? "" : v;
                    }

                    if (viewMode === 'overtime') {
                        // Construct String from record.overtime array
                        // Array of { type: "Overtime Name", hours: 2.0 }
                        // Desired: "OT1: 2; OT2: 1"
                        if (record && record.overtime && record.overtime.length > 0) {
                            // Use Abbr if available AND showAbbreviations is ON
                            const otParams = store.state.settings.overtime_types || [];
                            const showAbbr = store.state.showAbbreviations; // Check the global toggle

                            const parts = record.overtime.map(ot => {
                                const config = otParams.find(c => c.overtime_name === ot.type);
                                // Logic: If config exists AND (showAbbr is true OR config has no abbr), use abbr?
                                // Usually: If showAbbr is true, use abbr. If false, use full name.
                                let label = ot.type;
                                if (config && config.abbreviation && showAbbr) {
                                    label = config.abbreviation;
                                }
                                return `${label}: ${ot.hours}`;
                            });
                            return parts.join('; ');
                        }
                        return "";
                    } else {
                        // Attendance Mode
                        return record ? record.status : "";
                    }
                },
                valueSetter: (params) => {
                    const newVal = params.newValue;
                    if (newVal === params.oldValue) return false;

                    let finalVal = newVal ? newVal.trim() : "";

                    if (isHours) {
                        // HOURS SETTER: store a clamped number (or '' to clear) in hours_input
                        let num = "";
                        if (finalVal !== "") {
                            const parsed = parseFloat(finalVal);
                            if (!isNaN(parsed)) {
                                num = parsed < 0 ? 0 : (parsed > 24 ? 24 : parsed);
                            }
                        }
                        store.updateCell(params.data.name, dateStr, 'hours_input', num);
                    } else if (viewMode === 'overtime') {
                        // OVERTIME SETTER
                        // 1. Optimistic Update of proper structure
                        const key = `${params.data.name}_${dateStr}`;
                        if (!store.state.attendance[key]) store.updateCell(params.data.name, dateStr, 'overtime', []);

                        // Parse String -> List
                        const otParams = store.state.settings.overtime_types || [];
                        const otMap = {}; // Abbr -> Name
                        const nameToAbbr = {}; // Name -> Abbr
                        otParams.forEach(p => {
                            otMap[p.abbreviation.toLowerCase()] = p.overtime_name;
                            nameToAbbr[p.overtime_name] = p.abbreviation;
                        });

                        const newOvertimeList = [];
                        let resultingText = finalVal;

                        if (finalVal) {
                            // SMART INPUT CHECK
                            // If user typed just a number (e.g. "5" or "5.5")
                            const isJustNumber = /^-?\d*(\.\d+)?$/.test(finalVal);

                            if (isJustNumber) {
                                // Get Current Preference
                                const empId = params.data.name;
                                let prefType = null;
                                if (store.state.temp_ot_prefs && store.state.temp_ot_prefs[empId]) {
                                    prefType = store.state.temp_ot_prefs[empId];
                                } else if (otParams.length > 0) {
                                    prefType = otParams[0].overtime_name;
                                }

                                if (prefType && prefType !== __("Mixed")) {
                                    // User wants this specific type
                                    // Auto-format! "5" -> "OT1: 5"
                                    const qtyNum = parseFloat(finalVal);
                                    if (qtyNum > 0) {
                                        newOvertimeList.push({ type: prefType, hours: qtyNum });
                                        // Update the text to be proper format
                                        const abbr = nameToAbbr[prefType] || prefType;
                                        resultingText = `${abbr}: ${qtyNum}`;
                                    }
                                } else {
                                    // Mixed mode or No Config: Treat as raw, or default?
                                    // If Mixed, we can't guess. 
                                    if (otParams.length === 1) {
                                        // Fallback if only 1 exists
                                        const qtyNum = parseFloat(finalVal) || 0;
                                        newOvertimeList.push({ type: otParams[0].overtime_name, hours: qtyNum });
                                    }
                                }
                            } else {
                                // Complex String, e.g. "OT1: 2; OT2: 1"
                                // Also handle space format: "PT 5" -> "PT: 5"
                                let finalParsedVal = finalVal;

                                // Quick fix for "Abbr Space Quantity" IF it's a single entry without colons or semicolons
                                if (!finalVal.includes(':') && !finalVal.includes(';') && finalVal.includes(' ')) {
                                    const spParts = finalVal.trim().split(/\s+/);
                                    if (spParts.length === 2) {
                                        // Assume "Abbr Quantity"
                                        const potentialAbbr = spParts[0];
                                        const potentialQty = parseFloat(spParts[1]);
                                        if (!isNaN(potentialQty)) {
                                            // Validate Abbr
                                            const realName = otMap[potentialAbbr.toLowerCase()];
                                            if (realName) {
                                                finalParsedVal = `${potentialAbbr}: ${potentialQty}`;
                                            }
                                        }
                                    }
                                }

                                const parts = finalParsedVal.split(';');
                                let distinctTypes = new Set();

                                parts.forEach(p => {
                                    if (p.includes(':')) {
                                        let [key, qty] = p.split(':');
                                        key = key.trim().toLowerCase();
                                        const qtyNum = parseFloat(qty.trim()) || 0;

                                        const realName = otMap[key]; // Find by abbr
                                        if (realName) {
                                            newOvertimeList.push({ type: realName, hours: qtyNum });
                                            distinctTypes.add(realName);
                                        }
                                    } else {
                                        // Single value fallback?
                                        if (otParams.length === 1) {
                                            const qtyNum = parseFloat(p.trim()) || 0;
                                            newOvertimeList.push({ type: otParams[0].overtime_name, hours: qtyNum });
                                            distinctTypes.add(otParams[0].overtime_name);
                                        }
                                    }
                                });

                                // AUTO-DETECT MIXED
                                if (distinctTypes.size > 1) {
                                    const empId = params.data.name;
                                    if (!store.state.temp_ot_prefs) store.state.temp_ot_prefs = {};
                                    store.state.temp_ot_prefs[empId] = __("Mixed");
                                    // Refresh the OT Type column for this row
                                    params.api.refreshCells({ rowNodes: [params.node], columns: ['overtime_type_selector'] });
                                }
                            }
                        }

                        // Update Store Local
                        store.updateCell(params.data.name, dateStr, 'overtime', newOvertimeList);
                        // Store the smart-formatted text so it displays correctly immediately
                        store.updateCell(params.data.name, dateStr, 'overtime_text', resultingText);

                    } else {
                        // ATTENDANCE SETTER
                        // Smart Input Map (Abbreviation -> Status)
                        const settings = store.state.settings.status_map || [];
                        const found = settings.find(s =>
                            s.abbreviation.toLowerCase() === finalVal.toLowerCase() ||
                            s.status.toLowerCase() === finalVal.toLowerCase()
                        );

                        if (found) {
                            finalVal = found.status;
                        }
                        store.updateCell(params.data.name, dateStr, 'status', finalVal);
                    }

                    // Force refresh to show formatted value
                    params.api.refreshCells({ rowNodes: [params.node], columns: [params.column] });
                    // HOURS MODE: refresh whole row so the "Tổng chấm theo giờ" summary updates live
                    if (isHours) {
                        params.api.refreshCells({ rowNodes: [params.node], force: true });
                    }

                    // AUTO-SAVE: Trigger save immediately
                    store.save();

                    return true;
                }
            });
        }

        // Summary Columns (Yellow in Excel) - DYNAMIC based on Settings
        // Summary Columns Logic
        if (viewMode === 'overtime') {
            // OVERTIME SUMMARY
            const configuredTypes = store.state.settings.overtime_types || [];

            // 1. Scan for Legacy Types in Data
            const foundTypes = new Set();
            const attendanceInfo = store.state.attendance || {};

            Object.values(attendanceInfo).forEach(record => {
                if (record && record.overtime && Array.isArray(record.overtime)) {
                    record.overtime.forEach(ot => {
                        if (ot.type) foundTypes.add(ot.type);
                    });
                }
            });

            // 2. Merge Lists: Configured + Found (Legacy)
            const combinedTypesMap = new Map();

            // Add Configured First
            configuredTypes.forEach(ct => {
                combinedTypesMap.set(ct.overtime_name, {
                    name: ct.overtime_name,
                    abbr: ct.abbreviation,
                    isLegacy: false
                });
            });

            // Add Found (Legacy) if not existing
            foundTypes.forEach(ft => {
                if (!combinedTypesMap.has(ft)) {
                    combinedTypesMap.set(ft, {
                        name: ft,
                        abbr: ft, // Default abbr to full name for legacy
                        isLegacy: true
                    });
                }
            });

            const finalTypeList = Array.from(combinedTypesMap.values());
            console.log("DEBUG: building OT cols. Types:", finalTypeList);

            if (finalTypeList.length === 0) {
                // Nothing to show
            } else {
                finalTypeList.forEach(ot => {
                    cols.push({
                        headerName: ot.name,
                        headerTooltip: ot.isLegacy ? `${ot.name} (${__('Legacy Data')})` : `${ot.name} (${ot.abbr})`,
                        width: 80,
                        valueGetter: p => this.sumOvertime(p.data.name, ot.name),
                        cellStyle: {
                            'background-color': ot.isLegacy ? '#fff3e0' : '#e3f2fd', // Orange tint for Legacy
                            'text-align': 'center',
                            'font-weight': 'bold',
                            'border-left': '1px solid #ddd'
                        }
                    });
                });
            }

        } else if (!isHours) {
            // ATTENDANCE SUMMARY
            const statusMap = store.state.settings.status_map || [];

            // 1. Scan for Legacy Statuses in Data
            const foundStatuses = new Set();
            const attendanceInfo = store.state.attendance || {};

            Object.values(attendanceInfo).forEach(record => {
                if (record && record.status) {
                    foundStatuses.add(record.status);
                }
            });

            // 2. Merge Lists
            const combinedStatusMap = new Map();

            // Add Configured First
            statusMap.forEach(s => {
                combinedStatusMap.set(s.status, {
                    name: s.status,
                    abbr: s.abbreviation,
                    color: s.color,
                    isLegacy: false
                });
            });

            // Add Found (Legacy)
            foundStatuses.forEach(fs => {
                if (!combinedStatusMap.has(fs)) {
                    combinedStatusMap.set(fs, {
                        name: fs,
                        abbr: fs, // Default abbr to name
                        color: '#fff3e0', // Default Legacy Color (Orange-ish)
                        isLegacy: true
                    });
                }
            });

            const finalStatusList = Array.from(combinedStatusMap.values());

            if (finalStatusList.length === 0) {
                // Fallback Defaults if absolutely nothing exists
                ['Present', 'Half Day', 'On Leave', 'Absent'].forEach(status => {
                    cols.push({
                        headerName: status,
                        width: 70,
                        valueGetter: p => this.countStatus(p.data.name, [status]),
                        cellStyle: { 'background-color': '#ffffcc', 'text-align': 'center', 'font-weight': 'bold' }
                    });
                });
            } else {
                finalStatusList.forEach(st => {
                    cols.push({
                        headerName: st.name,
                        headerTooltip: st.isLegacy ? `${st.name} (${__('Legacy Data')})` : `${st.name} (${st.abbr})`,
                        width: 70,
                        valueGetter: p => this.countStatus(p.data.name, [st.name]),
                        cellStyle: {
                            'background-color': st.isLegacy ? '#fff3e0' : (st.color || '#ffffcc'),
                            'text-align': 'center',
                            'font-weight': 'bold',
                            'border-left': '1px solid #ddd'
                        }
                    });
                });
            }
        }

        // "Tổng chấm theo giờ" — shown in BOTH Điểm danh (attendance) and Chấm theo giờ (hours) modes, not Overtime.
        if (!isOvertime) {
            cols.push({
                headerName: __("Tổng chấm theo giờ"),
                headerTooltip: __("Tổng số giờ chấm theo giờ trong tháng"),
                width: 110,
                valueGetter: p => this.sumHours(p.data.name),
                cellStyle: {
                    'background-color': '#e8f5e9',
                    'text-align': 'center',
                    'font-weight': 'bold',
                    'border-left': '1px solid #ddd'
                }
            });
        }

        return cols;
    },

    countStatus(employee, statuses) {
        // Iterate all days in meta to count
        let count = 0;
        const meta = store.state.meta;
        if (!meta.first_day) return 0;
        const start = new Date(meta.first_day);
        for (let i = 0; i < meta.days_in_month; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const key = `${employee}_${dateStr}`;
            const record = store.state.attendance[key];
            if (record && statuses.includes(record.status)) {
                count++;
            }
        }
        return count;
    },

    sumOvertime(employee, otTypeName) {
        let total = 0.0;
        const meta = store.state.meta;
        if (!meta.first_day) return 0;
        const start = new Date(meta.first_day);

        for (let i = 0; i < meta.days_in_month; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const key = `${employee}_${dateStr}`;
            const record = store.state.attendance[key];

            if (record && record.overtime) {
                const entry = record.overtime.find(ot => ot.type === otTypeName);
                if (entry) {
                    total += parseFloat(entry.hours) || 0;
                }
            }
        }
        return parseFloat(total.toFixed(2)); // Nice formatting
    },

    sumHours(employee) {
        // Sum the monthly hourly-tracking total for one employee.
        // Prefer in-progress edits (hours_input) over canonical hours_log so the total updates live.
        let total = 0.0;
        const meta = store.state.meta;
        if (!meta.first_day) return 0;
        const start = new Date(meta.first_day);
        const hoursLog = store.state.hours_log || {};

        for (let i = 0; i < meta.days_in_month; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const key = `${employee}_${dateStr}`;

            let v;
            const record = store.state.attendance[key];
            if (record && Object.prototype.hasOwnProperty.call(record, 'hours_input')) {
                v = parseFloat(record.hours_input);
            } else {
                v = parseFloat(hoursLog[key]);
            }
            if (!isNaN(v)) total += v;
        }
        return parseFloat(total.toFixed(2));
    },

    onCellValueChanged(event) {
        // Handled in valueSetter usually, but can do extra UI refreshes here
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: [event.column] });
    }
};
