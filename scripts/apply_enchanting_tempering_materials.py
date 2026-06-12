import subprocess

PATCH_SOURCE_COMMIT = "153e6a7e624a1cb03b67e02dfbef3d0b64dd4caa"
subprocess.run(
    ["git", "fetch", "--depth=1", "origin", PATCH_SOURCE_COMMIT],
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
source = subprocess.check_output(
    ["git", "show", f"{PATCH_SOURCE_COMMIT}:scripts/apply_enchanting_tempering_materials.py"],
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
