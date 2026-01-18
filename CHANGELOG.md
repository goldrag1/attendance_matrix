# Changelog

## [Unreleased] - 2026-01-17
### Added
- **Excel Export**: Fully styled export using `openpyxl`.
    - Supports Status colors.
    - Weekend/Holiday highlighting (Pink/Red).
    - Summary columns for status counts.
    - Standard Date headers (dd/mm/yyyy).
- **Backend Logic**:
    - `export_attendance_excel` API.
    - Auto-deletion of Attendance when status is cleared.
    - "Overwrite Submitted" logic: Cancels and deletes old Submitted documents to allow matrix updates.
- **UI/UX**:
    - "Today" column highlighting (Sky Blue).
    - Help text for "Payroll Status" configuration.
    - Left alignment for Name/Dept columns.
    - Responsive toolbar layout with better spacing.

### Fixed
- **Cannot Update After Submit**: Fixed by implementing Cancel->Delete->Create flow.
- **Value Missing Error**: Fixed by handling empty status as deletion.
- **Layout Cramping**: Fixed by adjusting flex gaps and header heights.
- **Weekend Coloring**: Fixed prioritization logic (Data Color > Today > Holiday > Weekend).
