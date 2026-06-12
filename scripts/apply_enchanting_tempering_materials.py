import re
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
source = source.replace(
    r"r'function forgeRecipe\(item\) \{.*?\n\}\nfunction temperRecipes\(\) \{.*?\n\}\nfunction variantRecipe\(raw\) \{.*?\n\}\nfunction dbRecipe'",
    r"r'function forgeRecipe\(item\) \{.*?\nfunction dbRecipe'",
    1,
)
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

source, removed = re.subn(
    r'\n# Material search includes catalog tags and smithing properties\.\nreplace_once\(.*?\n    "material search payload",\n\)\n',
    "\n",
    source,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise RuntimeError(f"wrapper could not remove redundant material search rewrite: {removed}")

# The current page keeps rarity and knowledge tests inline instead of assigning
# knowledgeMatch and rarityMatch variables. Retarget the guarded replacements.
source = source.replace(
    '''    return disciplineMatch && sectionMatch && groupMatch && knowledgeMatch && rarityMatch && matches(r, query);''',
    '''    return disciplineMatch && sectionMatch && groupMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);''',
    1,
)
source = source.replace(
    '''    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && knowledgeMatch && rarityMatch && matches(r, query);''',
    '''    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);''',
    1,
)
source = source.replace(
    '''  }), [recipes, discipline, knowledge, rarityFilter, alchemySection, alchemyGroup, query]);''',
    '''  }), [recipes, discipline, alchemySection, alchemyGroup, rarityFilter, knowledge, query]);''',
    1,
)
source = source.replace(
    '''  }), [recipes, discipline, knowledge, rarityFilter, alchemySection, alchemyGroup, enchantingSection, query]);''',
    '''  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, rarityFilter, knowledge, query]);''',
    1,
)

try:
    exec(compile(source, "apply_enchanting_tempering_materials.py", "exec"), {"__name__": "__main__"})
except Exception as exc:
    print(f"PATCH_ERROR::{type(exc).__name__}::{exc}")
    raise SystemExit(1)
