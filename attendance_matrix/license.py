import frappe
import requests
from frappe import _
from frappe.utils import get_url

LICENSE_CACHE_KEY = "attendance_matrix_license_status"
LICENSE_CHECK_INTERVAL = 24 * 60 * 60 # 24 hours

def validate_license_hook():
    """
    Hook to validate license on every request.
    Uses cached status to avoid hitting the server on every request.
    """
    # Allow access to login, static assets, and background jobs
    if frappe.request.path.startswith("/assets") or \
       frappe.request.path.startswith("/api/method/login") or \
       frappe.request.path.startswith("/api/method/logout") or \
       frappe.session.user == "Guest":
        return

    # Skip validation for Administrator to avoid lockout (Optional, maybe remove for strictness)
    if frappe.session.user == "Administrator":
        return

    # Check Cache
    status = frappe.cache().get_value(LICENSE_CACHE_KEY)
    
    if status == "Active":
        return
    elif status == "Inactive":
        frappe.throw(_("License Invalid for this domain. Please contact support."), frappe.PermissionError)
    else:
        # No cache, perform sync check (blocking)
        is_active = check_remote_license()
        if not is_active:
            frappe.throw(_("Unable to validate license. Please connect to the internet or contact support."), frappe.PermissionError)

def check_remote_license():
    """
    Validates the license against the remote server.
    Returns True if Active, False otherwise.
    """
    settings = frappe.get_single("Attendance Matrix Settings")
    server_url = settings.license_server_url or "https://erp.minionapp.fun"
    site_domain = get_url()

    try:
        response = requests.post(f"{server_url}/api/method/licence_manager.api.validate_domain", json={
            "domain": site_domain,
            "app_name": "attendance_matrix"
        }, timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            # Expecting response like: {"message": {"status": "Active"}}
            status = result.get("message", {}).get("status")
            
            if status == "Active":
                frappe.cache().set_value(LICENSE_CACHE_KEY, "Active", expires_in_sec=LICENSE_CHECK_INTERVAL)
                return True
            else:
                frappe.cache().set_value(LICENSE_CACHE_KEY, "Inactive", expires_in_sec=LICENSE_CHECK_INTERVAL)
                return False
        else:
            # Server error, fail open or closed? Here failing closed (safe).
            frappe.log_error(f"License Check Failed: {response.text}", "Attendance Matrix License")
            return False

    except Exception as e:
        frappe.log_error(f"License Check Error: {str(e)}", "Attendance Matrix License Error")
        return False

def daily_license_check():
    """
    Background job to refresh license status daily.
    """
    check_remote_license()
