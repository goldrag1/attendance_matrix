# Implementation Plan - Advanced Excel Export

## Goal Description
Implement a backend-driven Excel export feature that replicates the visual styling of the Attendance Matrix UI. This ensures the downloaded file contains colored cells for statuses, specialized formatting for weekends/holidays, and a clean layout.

## User Review Required
None.

## Proposed Changes

### Backend
#### [attendance_matrix.py](c:\apps\attendance_matrix\attendance_matrix\attendance_matrix\page\attendance_matrix\attendance_matrix.py)
- Import `openpyxl` and `frappe.response`.
- Implement `export_attendance_excel(month, year, ...)` logic:
    - Reuse `get_matrix_data` to fetch raw data.
    - Create a new Workbook using `openpyxl`.
    - **Header Construction:**
        - Row 1: "Mã NV", "Tên NV", "Ca", [Dates 01...31]
        - Apply Header Styles (Bold, Gray Background, Border).
        - Highlight Headers for Weekends (Pink) and Holidays (Red).
    - **Data Rows:**
        - Iterate employees.
        - Iterate dates.
        - Fill Cell Value: `data[emp_date]['status']`
    - **Styling Rules (Cell Level):**
        - **Status Color:** Lookup `status_map` (from Settings).
          - If Status Match -> Fill Cell with Hex Color.
        - **Weekend/Holiday:**
          - If Cell is EMPTY and Date is Weekend -> Fill Pink (`FFF5F5` / `FFE6E6`).
          - If Cell is EMPTY and Date is Today -> Fill Blue (`E0F7FA`).
    - Return file via `frappe.response['file_content']`.

### Frontend
#### [attendance_matrix.js](c:\apps\attendance_matrix\attendance_matrix\attendance_matrix\page\attendance_matrix\attendance_matrix.js)
- Update `exportExcel` method:
    - Construct URL with current filters (`store.filters`).
    - Use `window.open(url)` to trigger the download from the new backend endpoint.

## Verification Plan
### Manual Verification
- Filter by a specific Dept/Month.
- Click "Xuất Excel".
- Open the downloaded `.xlsx` file.
- **Check Visuals:**
    - Are headers bold and colored?
    - Are Weekends pinkish?
    - Are Status cells (Full ca, nua ca) colored correctly according to settings?
    - Is the "Today" column blue (if applicable)?
