import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    # 1. Clean up old fields to avoid duplicates/confusion
    old_fields = ["overtime_logs", "overtime_settings_section"]
    for fieldname in old_fields:
        # Check if custom field exists
        field_name = frappe.db.get_value("Custom Field", {"dt": "Attendance", "fieldname": fieldname})
        if field_name:
            frappe.delete_doc("Custom Field", field_name, ignore_missing=True)

    # 2. Create New Fields
    custom_fields = {
        "Attendance": [
            {
                "fieldname": "matrix_overtime_section",
                "fieldtype": "Section Break",
                "label": "Matrix Overtime Logs",
                "insert_after": "early_exit" 
            },
            {
                "fieldname": "matrix_overtime_logs",
                "fieldtype": "Table",
                "label": "Overtime Logs (Matrix)",
                "options": "Attendance Overtime Log",
                "insert_after": "matrix_overtime_section"
            }
        ]
    }
    create_custom_fields(custom_fields, update=True)
