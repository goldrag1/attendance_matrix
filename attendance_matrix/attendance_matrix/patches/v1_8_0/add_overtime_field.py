import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    custom_fields = {
        "Attendance": [
            {
                "fieldname": "matrix_overtime_section",
                "fieldtype": "Section Break",
                "label": "Matrix Overtime Logs",
                "insert_after": "authorization_status"
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
