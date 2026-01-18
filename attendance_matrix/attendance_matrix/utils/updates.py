import frappe
import os
import requests
import zipfile
import shutil
import io
from frappe import _

GITHUB_URL = "https://github.com/goldrag1/attendance_matrix"
ZIP_URL = f"{GITHUB_URL}/archive/refs/heads/main.zip"
VERSION_URL = f"https://raw.githubusercontent.com/goldrag1/attendance_matrix/main/VERSION"
CHANGELOG_URL = f"https://raw.githubusercontent.com/goldrag1/attendance_matrix/main/CHANGELOG.md"

@frappe.whitelist()
def check_for_updates():
    """
    Checks if there are updates available by comparing local and remote VERSION file.
    Does NOT use Git.
    """
    try:
        app_path = frappe.get_app_path("attendance_matrix")
        repo_dir = os.path.dirname(app_path)

        # 1. Get Local Version
        local_ver = "?"
        version_file = os.path.join(repo_dir, "VERSION")
        if os.path.exists(version_file):
            with open(version_file, "r") as f:
                local_ver = f.read().strip()

        # 2. Get Remote Version via HTTP
        try:
            r = requests.get(VERSION_URL, timeout=5)
            if r.status_code == 200:
                remote_ver = r.text.strip()
            else:
                return {"error": f"Không thể kết nối đến GitHub (Status: {r.status_code})"}
        except Exception as e:
             return {"error": f"Lỗi kết nối mạng: {str(e)}"}

        # 3. Compare
        if local_ver != remote_ver:
            # Fetch Changelog
            changelog = "Không thể tải lịch sử thay đổi."
            try:
                c = requests.get(CHANGELOG_URL, timeout=5)
                if c.status_code == 200:
                    # Extract top section (simplistic approach: read until next '## v')
                    lines = c.text.split('\n')
                    params = []
                    capture = False
                    for line in lines:
                        if line.startswith('## '):
                            if capture: break 
                            capture = True 
                        elif capture:
                            params.append(line)
                    if params:
                        changelog = "\n".join(params)
                    else:
                        changelog = "Phiên bản mới: " + remote_ver
            except:
                pass

            return {
                "update_available": True,
                "local_version": local_ver,
                "remote_version": remote_ver,
                "changelog": changelog
            }
        else:
             return {
                "update_available": False,
                "local_version": local_ver,
                "remote_version": remote_ver
            }

    except Exception as e:
        frappe.log_error(f"Check Update Error: {str(e)}", "Attendance Matrix Update")
        return {"error": str(e)}

@frappe.whitelist()
def perform_update():
    """
    Downloads Zip from GitHub, extracts and overwrites local files.
    """
    try:
        app_path = frappe.get_app_path("attendance_matrix")
        target_dir = os.path.dirname(app_path) # apps/attendance_matrix/

        # 1. Download Zip
        r = requests.get(ZIP_URL, stream=True, timeout=30)
        if r.status_code != 200:
             frappe.throw(f"Không thể tải file cập nhật (Status: {r.status_code})")

        # 2. Extract to Memory
        z = zipfile.ZipFile(io.BytesIO(r.content))
        
        # Git Zip usually has a top folder 'attendance_matrix-main'
        # We need to extract contents of that folder to 'target_dir'
        
        root_folder = z.namelist()[0].split('/')[0] # e.g., 'attendance_matrix-main'
        
        for file_info in z.infolist():
            if file_info.filename.endswith('/'): continue # Skip directories
            
            # Remove the top folder from path
            # e.g. 'attendance_matrix-main/attendance_matrix/hooks.py' -> 'attendance_matrix/hooks.py'
            rel_path = file_info.filename[len(root_folder)+1:] 
            
            if not rel_path: continue

            # Construct full destination path
            dest_path = os.path.join(target_dir, rel_path)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # Write file (Overwrite)
            with open(dest_path, "wb") as f:
                f.write(z.read(file_info))

        # 3. Post Update Actions
        frappe.clear_cache()
        
        restart_status = ""
        try:
             # Try restart if permissions allow
             subprocess.Popen(["bench", "restart"], cwd=target_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
             restart_status = "Server đang khởi động lại..."
        except:
             restart_status = "Vui lòng khởi động lại server nếu có lỗi Backend."
        
        return {"status": "success", "message": _("Cập nhật thành công lên phiên bản mới nhất! {0}").format(restart_status)}

    except Exception as e:
        frappe.log_error(f"Zip Update Error: {str(e)}", "Attendance Matrix Update")
        frappe.throw(_("Lỗi cập nhật: {0}").format(str(e)))
