import frappe
import subprocess
import os
from frappe import _

@frappe.whitelist()
def check_for_updates():
    """
    Checks if there are updates available by fetching from remote.
    Assumes the directory is a git repo, or initializes it if not.
    """
    app_path = frappe.get_app_path("attendance_matrix")
    # Go up one level to the app directory (folder containing setup.py)
    repo_dir = os.path.dirname(os.path.dirname(app_path))
    
    # Ensure it's a git repo
    setup_git_if_needed(repo_dir)
    
    try:
        # Fetch remote
        subprocess.check_output(["git", "fetch", "origin", "main"], cwd=repo_dir, stderr=subprocess.STDOUT)
        
        # Check commit diff
        local_hash = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo_dir).strip().decode('utf-8')
        remote_hash = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=repo_dir).strip().decode('utf-8')
        
        if local_hash != remote_hash:
            return {
                "update_available": True,
                "local_version": local_hash[:7],
                "remote_version": remote_hash[:7]
            }
        else:
            return {"update_available": False}
            
    except subprocess.CalledProcessError as e:
        frappe.log_error(f"Git Check Error: {e.output}", "Attendance Matrix Update")
        return {"error": str(e.output)}

@frappe.whitelist()
def perform_update():
    """
    Pulls the latest code and runs migrate.
    """
    app_path = frappe.get_app_path("attendance_matrix")
    repo_dir = os.path.dirname(os.path.dirname(app_path))
    
    setup_git_if_needed(repo_dir)
    
    try:
        # Reset hard to origin/main to force update (WARNING: loses local changes)
        subprocess.check_output(["git", "reset", "--hard", "origin/main"], cwd=repo_dir, stderr=subprocess.STDOUT)
        
        # Run migrate? Running bench commands from python is risky/complex due to env.
        # Instead, we can try to reload standard modules or just advise reboot.
        # But let's try to run a simple migrate command if possible, or just reload code.
        
        # Triggering a reload of documents might be safer than full bench migrate
        # frappe.reload_doc("attendance_matrix", "doctype", "Attendance Matrix Settings")
        # ... reload others ...
        
        return {"status": "success", "message": _("Code updated. Please restart server or reload bench to apply changes.")}
        
    except subprocess.CalledProcessError as e:
        frappe.log_error(f"Git Update Error: {e.output}", "Attendance Matrix Update")
        frappe.throw(_("Update failed: {0}").format(e.output.decode('utf-8')))

def setup_git_if_needed(repo_dir):
    """
    Checks if .git exists, if not, initializes and connects to remote.
    """
    git_dir = os.path.join(repo_dir, ".git")
    if not os.path.exists(git_dir):
        # Init
        subprocess.check_output(["git", "init"], cwd=repo_dir)
        # Add Remote (Public HTTPS)
        subprocess.check_output(["git", "remote", "add", "origin", "https://github.com/goldrag1/attendance_matrix.git"], cwd=repo_dir)
        # Fetch
        subprocess.check_output(["git", "fetch", "--all"], cwd=repo_dir)
        # Reset to main
        try:
             subprocess.check_output(["git", "reset", "--hard", "origin/main"], cwd=repo_dir)
             # Set upstream
             subprocess.check_output(["git", "branch", "--set-upstream-to=origin/main", "main"], cwd=repo_dir)
        except:
             pass
