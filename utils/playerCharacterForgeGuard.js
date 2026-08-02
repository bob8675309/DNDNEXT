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

export function shouldAutoOpenPlayerCharacterPanel({
  routerReady,
  pathname,
  isLoggedIn,
  loading,
  hasCharacter,
  needsCharacter,
}) {
  return Boolean(routerReady)
    && pathname === "/profile"
    && Boolean(isLoggedIn)
    && !loading
    && (Boolean(hasCharacter) || Boolean(needsCharacter));
}
