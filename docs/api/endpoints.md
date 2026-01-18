# API Documentation

## Attendance Matrix

### GET /api/method/attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.get_matrix_data
- **Description**: Fetch grid data for the matrix.
- **Parameters**: 
    - `month` (int), `year` (int)
    - `department`, `company`, `employee`, `shift` (Filters)
- **Response**: 
    - `employees`: List of employee objects.
    - `attendance`: Dict of `{EmpID_Date: {status, hours}}`.
    - `holidays`: List of holidays in range.
    - `meta`: Date range metadata.
    - `settings`: Color configuration.

### POST /api/method/attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.save_matrix_bulk
- **Description**: Save changes from the grid.
- **Body**: 
    - `data`: JSON string of list `[{employee, date, status}, ...]`.
- **Logic**:
    - If `status` is empty -> Delete record (Cancel if submitted).
    - If `status` exists -> Create or Update.
    - **Overwrite Rule**: If existing doc is `Submitted`, it is Cancelled & Deleted, then a new one is Created.

### GET /api/method/attendance_matrix.attendance_matrix.page.attendance_matrix.attendance_matrix.export_attendance_excel
- **Description**: Download styled Excel file.
- **Parameters**: Same as `get_matrix_data`.
- **Response**: Binary .xlsx file.
