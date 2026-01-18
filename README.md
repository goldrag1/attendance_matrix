# Attendance Matrix

Excel-like Attendance Management for ERPNext v15.

## Installation

### 1. Get the App
```bash
bench get-app https://github.com/goldrag1/attendance_matrix
```

### 2. Install on Site
```bash
bench --site [your-site-name] install-app attendance_matrix
```

### 3. Migrate (Optional but recommended)
```bash
bench migrate
```

### 4. Important: Installation Best Practices
To ensure the **Auto-Update** feature works correctly without permission errors:
1.  **NEVER** run `bench` commands as `root`.
2.  **ALWAYS** login as `frappe` (or `frappeuser`) before running `bench get-app`.
    - This ensures all files are owned by the correct user, allowing the app to update itself smoothly.

## Usage

1.  **Quick Access**: Go to the **Attendance** list view and click the **"Chấm công nhanh"** button.
2.  **Direct Link**: Navigate to `/app/attendance-matrix` in your browser.
