// T46-GLOBAL-G2: TEMPORARY research overlay of the original globally mounted
// PlayerCharacterProfilePanelUnified; never imported by deployed application.
// Source exactness is verified by the caller's Git blob sha1 before applying.
import assert from "node:assert/strict";

export function buildG2GlobalPlayerProfileOverlay(source) {
  assert.equal(typeof source,"string");
  const begin="      let rows = Array.isArray(listResult?.data) ? listResult.data : [];";
  const finish="      const normalized = uniqueCharacters(rows);";
  assert.equal(source.split(begin).length,2,"Source original delegated fallback start drift");
  assert.equal(source.split(finish).length,2,"Source original delegated fallback end drift");
  const left=source.indexOf(begin),right=source.indexOf(finish,left+begin.length);
  assert.ok(right>left,"Source original fallback block order drift");
  const originalBlock=source.slice(left,right);
  for(const s of [
    'if (!rows.length)',
    '.from("characters")',
    '.select(characterSelectColumns())',
    '.contains("tags", ["player-character"])',
    'if (!rows.length && resolvedPlayerName)'
  ])assert.ok(originalBlock.includes(s),"Missing preserved original branch "+s);
  // Never query broad char fields on PGRST202, transient auth/server errors, or
  // empty result. Original held #345 Stage1 is authoritative per-JWT.
  const safeBlock=[
    "      if (listResult?.error) throw listResult.error;",
    "      if (!Array.isArray(listResult?.data)) {",
    '        throw new Error("Authorized player-character listing unavailable");',
    "      }",
    "      const rows = listResult.data;",
    ""
  ].join("\n");
  let out=source.slice(0,left)+safeBlock+source.slice(right);
  const nextHook='  useEffect(() => {\n    if (router.isReady && router.query?.characterProfile === "1" && isLoggedIn) openPanel();';
  assert.equal(out.split(nextHook).length,2,"Source original route-open hook drift");
  const focusHook=[
    "  // Research-only: global PC panel is mounted even when suspended. Do not",
    "  // hold an old canonical Sheet or narrative in a hidden React subtree on",
    "  // window refocus or a server-side permission revocation. Preserve an",
    "  // in-progress Forge; use original actor/request epoch guard for the fetch.",
    "  useEffect(() => {",
    "    if (!sessionUser?.id || !character?.id || creatingCharacter) return undefined;",
    "    let alive = true;",
    "    function refreshOnFocus() {",
    "      const preferredId = character.id;",
    "      setCharacters([]);",
    "      setCharacter(null);",
    "      void loadLinkedCharacters(sessionUser, preferredId).then((next) => {",
    "        if (alive && !next) {",
    "          setOpen(false);",
    "          setNeedsCharacter(false);",
    "        }",
    "      });",
    "    }",
    '    window.addEventListener("focus", refreshOnFocus);',
    "    return () => {",
    "      alive = false;",
    '      window.removeEventListener("focus", refreshOnFocus);',
    "    };",
    "  }, [sessionUser, character?.id, creatingCharacter, loadLinkedCharacters]);",
    ""
  ].join("\n");
  out=out.replace(nextHook,focusHook+nextHook);
  assert.equal(out.includes('.from("characters")'),false,
    "Direct global raw character fallback survived G2 overlay");
  assert.equal(out.includes('supabase.rpc("get_my_player_characters_v2")'),true);
  assert.equal(out.includes('setCharacter(null)'),true);
  assert.equal(out.includes('const [isAdmin, setIsAdmin]'),true);
  assert.equal(out.includes('PlayerCharacterCreator key={sessionUser.id}'),true,
    "Original keyed Creator must remain intact");
  assert.equal(out.includes("const isCurrentRequest = () => isCurrentProfileLoadRequest"),true,
    "Original epoch gate must survive");
  return out;
}
