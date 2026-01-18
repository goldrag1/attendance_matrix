# Attendance Matrix Walkthrough

The Attendance Matrix is a custom ERPNext tool designed to streamline mass attendance entry with an Excel-like interface.

## Key Features

### 1. The Grid (Matrix View)
- **Visual Statuses**: Cells are colored based on the configured Status Map (e.g., Green for Full Ca, Yellow for Half Day).
- **Date Highlights**:
    - **Today**: Sky Blue (`#E0F7FA`).
    - **Weekend**: Pink/Reddish.
    - **Holiday**: Red text/background.
- **Smart Sorting**: Default sorted by Employee Name.
- **Left Alignment**: Text columns (Dept, ID, Name) are left-aligned for readability.

### 2. UI Layout & Tools
- **Action Bar (Top)**:
    - **Legend**: Visual guide for Shift Colors.
    - **Key Actions**: Reset View, Toàn màn hình (Fullscreen), Cấu hình (Settings), Xuất Excel.
    - **Toggle**: "Hiện Mã" (Show Employee ID).
- **Filter Bar (Bottom)**: 
    - Dedicated row for filters: Company, Dept, Employee (Search), Shift, Time (Month/Year).
    - **Live Search**: Filters apply immediately or with slight debounce.
    - **Counter**: Shows number of employees matching filters.

### 4. Excel Export
- **Button**: "Xuất Excel" (Green Icon).
- **Format**: Downloads a fully styled `.xlsx` file.
- **Content**:
    - Mirrors the Grid colors.
    - Includes **Summary Columns** at the end (Counts of each status).
    - Uses proper **Date Format** (dd/mm/yyyy) for headers.

## Technical Notes
- **Frontend**: Vue.js 3 + AG Grid Community.
- **Backend**: Python (Frappe API).
- **Library**: `openpyxl` for Excel generation.
