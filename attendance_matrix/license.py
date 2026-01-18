import frappe
from frappe import _
import requests
from frappe.utils import get_url

import frappe
from frappe import _
import requests
from frappe.utils import get_url

# Verification Tag: v1.4.3 (Zip) Loaded

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

    # SCOPE CHECK: Only validate if accessing Attendance Matrix features
    # 1. Page View: /app/attendance-matrix
    # 2. API Calls: /api/method/attendance_matrix.*
    path = frappe.request.path
    if "attendance_matrix" not in path and "attendance-matrix" not in path:
        return



    # Check Cache
    status = frappe.cache().get_value(LICENSE_CACHE_KEY)
    
    if status == "Active":
        return
    elif status == "Inactive":
        frappe.throw(_("Vui lòng liên hệ MinionApp hotline +84989613608 để cấp hoặc gia hạn License. <a href='https://www.minionapp.fun' target='_blank'>www.minionapp.fun</a>"), frappe.PermissionError)
    else:
    # No cache, perform sync check (blocking)
        is_active, reason = check_remote_license()
        if not is_active:
            # Show the specific technical reason for debugging
            frappe.throw(_(f"Giấy phép không hợp lệ ({reason}).<br>Vui lòng liên hệ MinionApp hotline +84989613608. <a href='https://www.minionapp.fun' target='_blank'>www.minionapp.fun</a>"), frappe.PermissionError)

def check_remote_license():
    """
    Validates the license against the remote server.
    Returns (True, "OK") if Active, (False, "Reason") otherwise.
    """
    settings = frappe.get_single("Attendance Matrix Settings")
    server_url = getattr(settings, "license_server_url", None) or "https://erp.minionapp.fun"
    site_domain = get_url()

    try:
        # Get Version
        version = None
        try:
            import subprocess
            import os
            app_path = frappe.get_app_path("attendance_matrix")
            repo_dir = os.path.dirname(os.path.dirname(app_path))
            version = subprocess.check_output(["git", "describe", "--tags", "--always"], cwd=repo_dir).strip().decode('utf-8')
        except:
            pass

        # Helper to parse response
        def parse_response(resp):
            if resp.status_code == 200:
                result = resp.json()
                status = result.get("message", {}).get("status")
                if status == "Active":
                    frappe.cache().set_value(LICENSE_CACHE_KEY, "Active", expires_in_sec=LICENSE_CHECK_INTERVAL)
                    return True, "Active"
                else:
                    frappe.cache().delete_value(LICENSE_CACHE_KEY)
                    frappe.log_error(f"License Status Denied: {status} for {site_domain}", "Attendance Matrix License")
                    return False, f"Status: {status}"
            return None, None

        # 1. Try with FULL arguments (including version)
        try:
            payload = {
                "domain": site_domain,
                "app_name": "attendance_matrix",
                "version": version
            }
            response = requests.post(f"{server_url}/api/method/licence_manager.licence_manager.api.validate_domain", json=payload, timeout=10)
            
            # If 417 (Expectation Failed) or 500ish, it might be argument mismatch. Retry without version.
            if response.status_code == 417 or response.status_code >= 500:
                 # Retry LOWEST common denominator (just domain and app_name)
                 del payload["version"]
                 response = requests.post(f"{server_url}/api/method/licence_manager.licence_manager.api.validate_domain", json=payload, timeout=10)

            success, reason = parse_response(response)
            if success is not None:
                return success, reason

        except Exception:
            pass # Fallthrough explicitly to other paths or return error

        # 2. Try LEGACY path (if nested path failed 404)
        if response.status_code == 404:
             response = requests.post(f"{server_url}/api/method/licence_manager.api.validate_domain", json={
                "domain": site_domain,
                "app_name": "attendance_matrix"
            }, timeout=10)
             
             success, reason = parse_response(response)
             if success is not None:
                return success, reason
             
             return False, f"Server API 404 (Path Not Found)"
        
        frappe.log_error(f"License Check Failed ({response.status_code}): {response.text}", "Attendance Matrix License")
        return False, f"HTTP {response.status_code}"

    except Exception as e:
        frappe.log_error(f"License Check Error: {str(e)}", "Attendance Matrix License Error")
        return False, f"Error: {str(e)}"

def daily_license_check():
    """
    Background job to refresh license status daily.
    """
    check_remote_license()
