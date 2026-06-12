from pathlib import Path
import subprocess

# The full guarded patch remains in the parent commit. Load it from Git history,
# correct Python's replacement-string handling, then execute it against the
# checked-out source tree.
source = subprocess.check_output(
    ["git", "show", "HEAD^:scripts/apply_enchanting_tempering_materials.py"],
    text=True,
)
source = source.replace(
    "re.subn(pattern, replacement, text",
    "re.subn(pattern, lambda _match: replacement, text",
    1,
)
exec(compile(source, "apply_enchanting_tempering_materials.py", "exec"), {"__name__": "__main__"})
