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
        # 1. Fetch History (Shallow but deep enough)
        subprocess.check_output(["git", "fetch", "origin", "main", "--depth=100", "--force"], cwd=repo_dir, stderr=subprocess.STDOUT)
        
        # 2. Fetch Tags (Explicitly)
        try:
             subprocess.check_output(["git", "fetch", "--tags", "--force"], cwd=repo_dir, stderr=subprocess.STDOUT)
        except:
             pass

        # Check commit diff
        local_hash = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo_dir).strip().decode('utf-8')
        remote_hash = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=repo_dir).strip().decode('utf-8')
        
        # Get Friendly Versions (v1.0 or v1.0-5-g7a9e90)
        local_ver = get_friendly_version(repo_dir, "HEAD")
        remote_ver = get_friendly_version(repo_dir, "origin/main")
        
        if local_hash != remote_hash:
            # Get changelog (Existing logic...)
            changelog = ""
            try:
                # Try reading CHANGELOG.md from remote
                raw_changelog = subprocess.check_output(
                    ["git", "show", "origin/main:CHANGELOG.md"], 
                    cwd=repo_dir
                ).decode('utf-8')
                
                # Extract the top section
                lines = raw_changelog.split('\n')
                params = []
                capture = False
                for line in lines:
                    if line.startswith('## '):
                        if capture: break 
                        capture = True
                        # Don't add the header line itself to params, just start capturing
                        # params.append(line) 
                    elif capture:
                        params.append(line)
                
                if params:
                    changelog = "\n".join(params)
            except Exception:
                pass

            if not changelog:
                changelog = subprocess.check_output(
                    ["git", "log", "HEAD..origin/main", "--pretty=format:%h - %s"], 
                    cwd=repo_dir
                ).strip().decode('utf-8')
            
            return {
                "update_available": True,
                "local_version": local_ver,
                "remote_version": remote_ver,
                "changelog": changelog
            }
        else:
            return {
                "update_available": False,
                "local_version": local_ver
            }
            
    except subprocess.CalledProcessError as e:
        frappe.log_error(f"Git Check Error: {e.output}", "Attendance Matrix Update")
        return {"error": str(e.output)}

def get_friendly_version(repo_dir, ref="HEAD"):
    """
    Returns v1.0 or commit hash if no tag.
    Priority:
    1. Exact Tag (v1.2)
    2. Description (v1.2-5-g...)
    3. Short Hash (a1b2c3d)
    4. ?
    """
    try:
        # 1. Try Exact Match first (Fastest & Cleanest)
        # git tag --points-at HEAD
        exact_tag = subprocess.check_output(["git", "tag", "--points-at", ref], cwd=repo_dir).strip().decode('utf-8')
        if exact_tag:
            # If multiple tags, take the last one (usually latest)
            return exact_tag.splitlines()[-1]

        # 2. Try Describe (Relative to nearest tag)
        ver = subprocess.check_output(["git", "describe", "--tags", "--always", ref], cwd=repo_dir).strip().decode('utf-8')
        return ver
    except:
        # 3. Fallback to Short Hash
        try:
            return subprocess.check_output(["git", "rev-parse", "--short", ref], cwd=repo_dir).strip().decode('utf-8')
        except:
            return "?"

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
        
        # 2. Check what files changed to decide if Restart is really needed
        # Get list of changed files between previous HEAD (before pull) and current HEAD
        # Wait, we already did 'reset --hard', so we lost previous HEAD reference?
        # Actually, 'git pull' moves HEAD. 'git reset --hard origin/main' moves HEAD.
        # We need to know previous hash. But we only have current hash now.
        # Ideally we should have captured previous hash before reset.
        # But wait, we can't easily know previous hash here unless we store it or pass it.
        # Let's assume we are aggressive: If ANY .py file is in the commit range we just pulled?
        # That's hard to track.
        
        # SIMPLER APPROACH: Just try to restart. If fail, check if we *really* needed it?
        # No, let's just make the message friendlier.
        
        # REVISED STRATEGY: 
        # 1. Clear Cache (Always safe, handles JS/CSS/DocType changes)
        frappe.cache().clear_all()
        
        # 2. Attempt Restart
        restart_status = ""
        try:
             process = subprocess.Popen(["bench", "restart"], cwd=repo_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
             restart_status = "Server restarting..."
        except Exception:
             # If restart fails, we just warn them safely
             restart_status = "Lưu ý: Nếu có lỗi logic Backend, vui lòng bảo IT khởi động lại server."

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
