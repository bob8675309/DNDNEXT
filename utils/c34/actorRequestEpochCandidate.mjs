// C34 T28 RESEARCH CANDIDATE — non-map actor/merchant request generation guard.
// Unmounted, no Supabase import, no production map/merchant/wallet changes.
// Caller MUST send independently authenticated actor transitions; this is NOT ACL.
export function createNonMapActorEpochCandidate() {
  let actorId = null;
  let merchantId = null;
  let actorEpoch = 0;
  let merchantEpoch = 0;
  let disposed = false;
  const owner = Symbol("t28-scope");
  const key = value => typeof value === "string" && value.trim() ? value.trim() : null;

  const observeActor = next => {
    if (disposed) return false;
    const id = key(next);
    if (id !== actorId) {
      actorId = id;
      merchantId = null;
      actorEpoch += 1;
      merchantEpoch += 1;
    }
    return true;
  };
  const selectMerchant = next => {
    if (disposed) return false;
    const id = actorId ? key(next) : null;
    if (id !== merchantId) {
      merchantId = id;
      merchantEpoch += 1;
    }
    return true;
  };
  const revoke = () => {
    if (disposed) return false;
    actorId = null;
    merchantId = null;
    actorEpoch += 1;
    merchantEpoch += 1;
    return true;
  };
  const capture = scope => {
    if (disposed || !actorId) return null;
    if (scope !== "wallet" && scope !== "stock") throw Error("T28 unknown request scope");
    if (scope === "stock" && !merchantId) return null;
    return Object.freeze({
      owner, scope, actorId, actorEpoch,
      ...(scope === "stock" ? { merchantId, merchantEpoch } : {})
    });
  };
  const isCurrent = ticket => Boolean(
    !disposed && ticket?.owner === owner && actorId &&
    ticket.actorId === actorId && ticket.actorEpoch === actorEpoch &&
    (ticket.scope === "wallet" ||
      (ticket.scope === "stock" && merchantId &&
       ticket.merchantId === merchantId && ticket.merchantEpoch === merchantEpoch))
  );
  const settle = (ticket, commit) => {
    if (!isCurrent(ticket)) return false;
    if (typeof commit !== "function") throw Error("T28 settle requires a callback");
    commit();
    return true;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    actorId = null;
    merchantId = null;
    actorEpoch += 1;
    merchantEpoch += 1;
  };
  const snapshot = () => Object.freeze({
    actorId, merchantId, actorEpoch, merchantEpoch, disposed
  });
  return Object.freeze({ observeActor, selectMerchant, revoke, capture, isCurrent, settle, dispose, snapshot });
}
