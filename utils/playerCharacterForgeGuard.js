export function shouldAutoOpenPlayerCharacterForge({
  routerReady,
  pathname,
  isLoggedIn,
  loading,
  needsCharacter,
}) {
  return Boolean(routerReady)
    && pathname === "/profile"
    && Boolean(isLoggedIn)
    && !loading
    && Boolean(needsCharacter);
}
