import subprocess

# Actions uses a shallow checkout. Fetch the parent containing the full guarded
# patch, correct Python replacement-string handling, then execute it.
subprocess.run(
    ["git", "fetch", "--depth=2", "origin", "automation/enchanting-tempering-materials-run"],
    check=True,
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
exec(compile(source, "apply_enchanting_tempering_materials.py", "exec"), {"__name__": "__main__"})
