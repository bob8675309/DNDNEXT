import subprocess

subprocess.run(
    ["git", "fetch", "--depth=2", "origin", "automation/enchanting-tempering-materials-run"],
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
source = subprocess.check_output(
    ["git", "show", "HEAD^:scripts/apply_enchanting_tempering_materials.py"],
    text=True,
)
source = source.replace(
    "re.subn(pattern, replacement, text",
    "re.subn(pattern, lambda _match: replacement, text",
    1,
)
try:
    exec(compile(source, "apply_enchanting_tempering_materials.py", "exec"), {"__name__": "__main__"})
except Exception as exc:
    print(f"PATCH_ERROR::{type(exc).__name__}::{exc}")
    raise SystemExit(1)
