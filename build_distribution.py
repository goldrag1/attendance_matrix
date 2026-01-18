import os
import shutil
from distutils.core import setup
from distutils.extension import Extension
from Cython.Build import cythonize
from Cython.Distutils import build_ext

# --- CONFIGURATION ---
APP_NAME = "attendance_matrix"
EXCLUDE_FILES = [
    "hooks.py",
    "patches.py", # Sometimes needed as source
    "install.py", # Sometimes needed as source
]
# Files that MUST remain as .py for Frappe to recognise them or for other reasons
ALWAYS_KEEP_SOURCE = [
    "__init__.py",
    "hooks.py",
]

# --- HELPER FUNCTIONS ---
def get_extensions(root_dir):
    extensions = []
    for root, dirs, files in os.walk(root_dir):
        for filename in files:
            if not filename.endswith(".py"):
                continue
            
            if filename in EXCLUDE_FILES:
                continue
                
            filepath = os.path.join(root, filename)
            
            # Construct module path (e.g., attendance_matrix.doctype.foo)
            relpath = os.path.relpath(filepath, ".")
            module_name = relpath.replace(os.sep, ".").replace(".py", "")
            
            print(f"Adding to compile: {module_name} ({filepath})")
            extensions.append(Extension(module_name, [filepath]))
    return extensions

def clean_source_files(root_dir):
    print("\n[Cleaning] Removing original source files...")
    for root, dirs, files in os.walk(root_dir):
        for filename in files:
            if filename.endswith(".py"):
                if filename in ALWAYS_KEEP_SOURCE:
                    print(f"Skipping (KEEP): {filename}")
                    continue
                
                filepath = os.path.join(root, filename)
                
                # Check if compiled file exists (basic check)
                # On Windows .pyd, on Linux .so
                base_name = filename.rsplit(".", 1)[0]
                has_compiled = False
                for ext in [".so", ".pyd"]:
                    # Compiled files often have extra tags like .cpython-310-x86_64-linux-gnu.so
                    # So we look for files starting with the name
                    for f in os.listdir(root):
                        if f.startswith(base_name) and f.endswith(ext):
                            has_compiled = True
                            break
                    if has_compiled: break

                if has_compiled:
                    print(f"Removing: {filepath}")
                    os.remove(filepath)
                else:
                    print(f"WARNING: Compiled file not found for {filepath}, keeping source.")
    
    # Remove build folder
    if os.path.exists("build"):
        shutil.rmtree("build")

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    # 1. Target the inner app directory
    target_dir = os.path.join(".", APP_NAME)
    
    extensions = get_extensions(target_dir)
    
    if not extensions:
        print("No files found to compile.")
        exit(0)

    # 2. Run Setup
    setup(
        name=APP_NAME,
        ext_modules=cythonize(
            extensions,
            compiler_directives={'language_level': "3"},
            build_dir="build" # Generate C files in build/
        ),
        cmdclass={'build_ext': build_ext},
        script_args=["build_ext", "--inplace"]
    )

    # 3. Clean up .py files ensuring .so/.pyd exists
    clean_source_files(target_dir)

    print("\nCompilation Complete! Don't forget to remove the helper C files if any remain locally.")
