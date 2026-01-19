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
                headerName: __("Shift"),
                field: "default_shift",
                pinned: "left",
                width: 120,
                cellStyle: { 'text-align': 'left' },
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: store.state.settings.shift_map.map(s => s.shift_name)
                },
                onCellValueChanged: (params) => {
                    if (params.newValue !== params.oldValue) {
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
                width: 60,
                headerClass: headerClass,
                cellClass: (params) => {
                    // Check if we have a specific color rule for this cell
                    const val = params.value;
                    if (val) {
                        const settings = store.state.settings.status_map || [];
                        const config = settings.find(s => s.status === val || s.abbreviation === val);
                        if (config && config.color) {
                            return "text-center"; // Don't apply weekend class
                        }
                    }
                    return cellClass; // Apply default calculated class (sunday-col, etc)
                },
                cellStyle: (params) => {
                    const val = params.value;
                    if (!val) return null;

                    // Lookup color from settings
                    const settings = store.state.settings.status_map || [];
                    // Match by Status Name OR Abbreviation (since we display Custom Status which is mapped to Status Name in settings)
                    const config = settings.find(s => s.status === val || s.abbreviation === val);

                    if (config && config.color) {
                        return {
                            'background-color': config.color,
                            'color': '#000', // Ensure text is visible (could improve with contrast check later)
                            'font-weight': '500'
                        };
                    }
                    return null;
                },
                editable: true,
                cellRenderer: params => {
                    const val = params.value;
                    if (!val) return "";

                    // Check Abbreviation Mode
                    if (store.state.showAbbreviations) {
                        const settings = store.state.settings.status_map || [];
                        const config = settings.find(s => s.status === val || s.abbreviation === val);
                        // If current value is Full Status, try to return Abbr. 
                        // If current value is Abbr, return it.
                        // Actually val from DB is always expected to be Full Status (or what was saved).
                        // logic: find config where status == val. If found, return abbr.
                        if (config && config.status === val && config.abbreviation) {
                            return config.abbreviation;
                        }
                    }
                    return val;
                },
                valueGetter: (params) => {
                    const key = `${params.data.name}_${dateStr}`;
                    const record = store.state.attendance[key];
                    return record ? record.status : "";
                },
                valueSetter: (params) => {
                    const newVal = params.newValue;
                    if (newVal === params.oldValue) return false;

                    let finalVal = newVal ? newVal.trim() : "";

                    // Smart Input Map (Abbreviation -> Status)
                    // Case insensitive check
                    const settings = store.state.settings.status_map || [];
                    const found = settings.find(s =>
                        s.abbreviation.toLowerCase() === finalVal.toLowerCase() ||
                        s.status.toLowerCase() === finalVal.toLowerCase()
                    );

                    if (found) {
                        finalVal = found.status;
                    }

                    store.updateCell(params.data.name, dateStr, 'status', finalVal);

                    // Force refresh to show formatted value
                    params.api.refreshCells({ rowNodes: [params.node], columns: [params.column] });

                    // AUTO-SAVE: Trigger save immediately
                    store.save();

                    return true;
                }
            });
        }

        // Summary Columns (Yellow in Excel) - DYNAMIC based on Settings
        const statusMap = store.state.settings.status_map || [];

        // Dictionary to group if needed. Here we just take unique abbreviations.
        const uniqueStatuses = [...new Set(statusMap.map(s => s.status).filter(Boolean))]; // CHANGED: Map STATUS not Abbr

        if (uniqueStatuses.length === 0) {
            // Fallback Defaults
            ['Present', 'Half Day', 'On Leave', 'Absent'].forEach(status => {
                cols.push({
                    headerName: status,
                    width: 70,
                    valueGetter: p => this.countStatus(p.data.name, [status]),
                    cellStyle: { 'background-color': '#ffffcc', 'text-align': 'center', 'font-weight': 'bold' }
                });
            });
        } else {
            uniqueStatuses.forEach(status => {
                // Find config for color/name
                const config = statusMap.find(s => s.status === status);
                const abbr = config ? config.abbreviation : status;

                cols.push({
                    headerName: status, // REQUIREMENT: Full Status Name in Header
                    headerTooltip: `${status} (${abbr})`,
                    width: 70,
                    valueGetter: p => this.countStatus(p.data.name, [status]),
                    cellStyle: {
                        'background-color': (config && config.color) ? config.color : '#ffffcc',
                        'text-align': 'center',
                        'font-weight': 'bold',
                        'border-left': '1px solid #ddd'
                    }
                });
            });
        }

        return cols;
    },

    countStatus(employee, statuses) {
        // Iterate all days in meta to count
        let count = 0;
        const meta = store.state.meta;
        if (!meta.first_day) return 0;

        // This is expensive if recalculated every frame for every cell.
        // AG Grid valueGetter is okay.

        // Improve: iterate store.state.attendance keys starting with employee
        // But keys are unstructured.

        // Better: iterate days
        // Better: iterate days
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

    onCellValueChanged(event) {
        // Handled in valueSetter usually, but can do extra UI refreshes here
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: [event.column] });
    }
};
