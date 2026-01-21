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
                return {"error": _("Cannot connect to GitHub (Status: {0})").format(r.status_code)}
        except Exception as e:
             return {"error": _("Network Connection Error: {0}").format(str(e))}

        def parse_version(v):
            try:
                # Remove 'v', split by '.', map to int
                return tuple(map(int, v.lower().replace('v', '').split('.')))
            except:
                return (0, 0, 0)

        # 3. Compare with Semantic Versioning logic
        if parse_version(remote_ver) > parse_version(local_ver):
            # Fetch Changelog
            changelog = _("Cannot load change history.")
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
                        changelog = _("New Version: {0}").format(remote_ver)
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
    Downloads Zip from GitHub (specific commit), extracts and overwrites local files.
    """
    try:
        app_path = frappe.get_app_path("attendance_matrix")
        target_dir = os.path.dirname(app_path) # apps/attendance_matrix/

        # 1. Get Latest Commit SHA to bypass Cache
        # GitHub 'archive/main.zip' is often cached. We need options/main or archive/{sha}.zip
        # Using public API to get latest sha
        commit_url = "https://api.github.com/repos/goldrag1/attendance_matrix/commits/main"
        sha = "main" # Fallback
        try:
            c_res = requests.get(commit_url, timeout=5)
            if c_res.status_code == 200:
                sha = c_res.json().get("sha")
            else:
                frappe.log_error(f"Could not get commit SHA: {c_res.status_code}", "Update Debug")
        except Exception as e:
             frappe.log_error(f"Could not get commit SHA: {str(e)}", "Update Debug")
        
        zip_url = f"{GITHUB_URL}/archive/{sha}.zip"

        # 2. Download Zip
        r = requests.get(zip_url, stream=True, timeout=60)
        if r.status_code != 200:
             frappe.throw(_("Cannot download update file (Status: {0})").format(r.status_code))

        # 3. Extract to Memory
        z = zipfile.ZipFile(io.BytesIO(r.content))
        
        # Git Zip structure: 'attendance_matrix-{sha}' (or 'attendance_matrix-main' if using main)
        # We need to be dynamic about the root folder name
        root_folder = z.namelist()[0].split('/')[0] 
        
        for file_info in z.infolist():
            if file_info.filename.endswith('/'): continue # Skip directories
            
            # Remove the top folder from path
            rel_path = file_info.filename[len(root_folder)+1:] 
            
            if not rel_path: continue

            # Construct full destination path
            dest_path = os.path.join(target_dir, rel_path)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # Write file (Overwrite)
            with open(dest_path, "wb") as f:
                f.write(z.read(file_info))

        # 4. Post Update Actions - Build assets and clear cache
        import subprocess
        
        bench_dir = os.path.dirname(os.path.dirname(target_dir))  # frappe-bench folder
        
        # Run bench build to rebuild JS/CSS assets
        build_status = ""
        try:
            # Resolve bench command
            bench_cmd = "bench"
            possible_paths = [
                os.path.join(bench_dir, "env", "bin", "bench"), # Linux
                os.path.join(bench_dir, "env", "Scripts", "bench") # Windows
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    bench_cmd = p
                    break
            
            # Check if shutil.which finds it if we didn't find absolute path
            if bench_cmd == "bench" and not shutil.which("bench"):
                 # Determine fallback based on OS if possible, or just warn
                 pass

            # Adding --force to be sure
            result = subprocess.run(
                [bench_cmd, "build", "--app", "attendance_matrix", "--force"],
                cwd=bench_dir,
                capture_output=True,
                text=True,
                timeout=300 # Increase timeout for build
            )
            if result.returncode == 0:
                build_status = _("Assets built successfully.")
            else:
                build_status = _("Asset build warning: {0}").format(result.stderr[:200] if result.stderr else "Unknown")
        except Exception as e:
            build_status = _("Asset build skipped: {0}").format(str(e))
        
        frappe.clear_cache()
        
        restart_status = ""
        try:
             # Try restart if permissions allow
             subprocess.Popen(["bench", "restart"], cwd=bench_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
             restart_status = _("Server is restarting...")
        except:
             restart_status = _("Please restart server manually if backend errors occur.")
        
        return {"status": "success", "message": _("Update successful! (Commit: {0}) {1} Cache cleared. {2}").format(sha[:7], build_status, restart_status)}

    except Exception as e:
        frappe.log_error(f"Zip Update Error: {str(e)}", "Attendance Matrix Update")
        frappe.throw(_("Update failed: {0}").format(str(e)))
