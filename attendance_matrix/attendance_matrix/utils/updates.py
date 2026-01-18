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
    
    
    # Check if git is installed
    try:
        subprocess.check_output(["git", "--version"])
    except FileNotFoundError:
        return {"error": "Git chưa được cài đặt trên server. Vui lòng cài đặt Git để sử dụng tính năng cập nhật."}

    try:
        # Fetch remote
        subprocess.check_output(["git", "fetch", "origin", "main"], cwd=repo_dir, stderr=subprocess.STDOUT)
        
        # Check commit diff
        local_hash = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo_dir).strip().decode('utf-8')
        remote_hash = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=repo_dir).strip().decode('utf-8')
        
        if local_hash != remote_hash:
            # Get changelog
            changelog = ""
            try:
                # Try reading CHANGELOG.md from remote
                # We use git show to read the file content from the remote branch without checking it out
                raw_changelog = subprocess.check_output(
                    ["git", "show", "origin/main:CHANGELOG.md"], 
                    cwd=repo_dir
                ).decode('utf-8')
                
                # Extract the top section (Latest Version)
                # Assumes format: 
                # ## v1.0.1
                # - Feature A
                # ...
                # ## v1.0.0
                lines = raw_changelog.split('\n')
                params = []
                capture = False
                for line in lines:
                    if line.startswith('## '):
                        if capture: break # Stop at next header
                        capture = True
                        params.append(line)
                    elif capture:
                        params.append(line)
                
                if params:
                    changelog = "\n".join(params)
                    
            except Exception:
                # Fallback to git log if CHANGELOG.md missing or error
                pass

            if not changelog:
                changelog = subprocess.check_output(
                    ["git", "log", "HEAD..origin/main", "--pretty=format:%h - %s"], 
                    cwd=repo_dir
                ).strip().decode('utf-8')
            
            return {
                "update_available": True,
                "local_version": local_hash[:7],
                "remote_version": remote_hash[:7],
                "changelog": changelog
            }
        else:
            return {
                "update_available": False,
                "local_version": local_hash[:7]
            }
            
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
        
        # Triggering a reload of documents
        # frappe.reload_doc("attendance_matrix", "doctype", "Attendance Matrix Settings")
        
        # 1. Clear Cache Programmatically (Works even if bench command fails)
        frappe.cache().clear_all()
        
        # 2. Attempt to restart server
        restart_status = "Manual restart required"
        try:
             # Try bench restart (works if permission allows)
             # standard 'bench restart' might fail if run by web user vs frappe user
             process = subprocess.Popen(["bench", "restart"], cwd=repo_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
             # We assume it started. If it fails immediately, we might catch it? 
             # But usually it's async. 
             restart_status = "Server restarting..."
        except Exception:
             restart_status = "Vui lòng báo IT khởi động lại server."
        
        return {"status": "success", "message": _("Cập nhật thành công. Đã xóa Cache. {0}").format(restart_status)}
        
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
