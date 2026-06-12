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

# Preserve JavaScript regex backslashes in Python replacement strings.
source = source.replace(
    "re.subn(pattern, replacement, text",
    "re.subn(pattern, lambda _match: replacement, text",
    1,
)

# The source file separates these helpers with blank lines, so match from the
# forge helper through the next top-level dbRecipe declaration instead of
# requiring each closing brace to touch the following declaration.
source = source.replace(
    r"r'function forgeRecipe\(item\) \{.*?\n\}\nfunction temperRecipes\(\) \{.*?\n\}\nfunction variantRecipe\(raw\) \{.*?\n\}\nfunction dbRecipe'",
    r"r'function forgeRecipe\(item\) \{.*?\nfunction dbRecipe'",
    1,
)

# Avoid shadowing the existing Alchemy helper with the new crafting-wide tag
# reader used only by elemental tempering.
source = source.replace(
    "function materialTags(material = {}) {",
    "function craftingMaterialTags(material = {}) {",
    1,
)
source = source.replace(
    'const tags = materialTags(material).join(" ");',
    'const tags = craftingMaterialTags(material).join(" ");',
    1,
)

try:
    exec(compile(source, "apply_enchanting_tempering_materials.py", "exec"), {"__name__": "__main__"})
except Exception as exc:
    print(f"PATCH_ERROR::{type(exc).__name__}::{exc}")
    raise SystemExit(1)
