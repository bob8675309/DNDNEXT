// C34 T28-P2 research ONLY: target-wallet and latest-request protection.
// Extends the already source-tested T28-P0 actor/merchant guard. No active app import.
// This guards CLIENT STATE ONLY: never substitutes for server RLS or transactional RPC auth.
import { createNonMapActorEpochCandidate } from "./actorRequestEpochCandidate.mjs";

export function createT28P2CommerceGuardCandidate({
  readStock, readWallet, onStock, onWallet, onError = () => {},
}) {
  for (const [name, value] of Object.entries({readStock, readWallet, onStock, onWallet, onError})) {
    if (typeof value !== "function") throw new TypeError(name + " must be a function");
  }
  const scope = createNonMapActorEpochCandidate();
  let targetUserId = null;
  let targetEpoch = 0;
  let stockReadSeq = 0;
  let walletReadSeq = 0;
  let stopped = false;
  const normalize = v => typeof v === "string" && v.trim() ? v.trim() : null;
  const reset = () => {
    stockReadSeq += 1;
    walletReadSeq += 1;
    onStock([]);
    onWallet(null);
  };
  const observeActor = id => {
    if (stopped) return false;
    const old = scope.snapshot().actorId;
    scope.observeActor(id);
    if (old !== scope.snapshot().actorId) {
      targetUserId = null;
      targetEpoch++;
      reset();
    }
    return true;
  };
  const selectMerchant = id => {
    if (stopped) return false;
    const old = scope.snapshot().merchantId;
    scope.selectMerchant(id);
    if (old !== scope.snapshot().merchantId) {
      stockReadSeq++;
      onStock([]);
    }
    return true;
  };
  // The original useWallet(userId) allows an Admin to select a DIFFERENT wallet.
  // T28-P0 wallet tickets are actor-scoped; this independent target epoch is required.
  const selectWalletTarget = id => {
    if (stopped) return false;
    const next = normalize(id);
    if (next !== targetUserId) {
      targetUserId = next;
      targetEpoch++;
      walletReadSeq++;
      onWallet(null);
    }
    return true;
  };
  const revoke = () => {
    if (stopped) return false;
    scope.revoke();
    targetUserId = null;
    targetEpoch++;
    reset();
    return true;
  };
  const loadStock = async () => {
    const ticket = scope.capture("stock");
    if (!ticket) return {committed:false, reason:"no-auth-or-merchant"};
    const seq = ++stockReadSeq;
    try {
      const result = await readStock(ticket.merchantId);
      const committed = scope.settle(ticket, () => {
        if (seq === stockReadSeq) onStock(result);
      });
      return {committed:committed && seq === stockReadSeq};
    } catch (error) {
      scope.settle(ticket, () => { if (seq === stockReadSeq) onError(error); });
      return {committed:false, error};
    }
  };
  const loadWallet = async () => {
    const ticket = scope.capture("wallet");
    if (!ticket) return {committed:false, reason:"no-auth"};
    const seq = ++walletReadSeq;
    const targetAtStart = targetUserId;
    const targetAtEpoch = targetEpoch;
    try {
      const result = await readWallet(targetAtStart);
      let wrote = false;
      const valid = scope.settle(ticket, () => {
        if (seq === walletReadSeq && targetAtEpoch === targetEpoch &&
            targetAtStart === targetUserId) {
          onWallet(result);
          wrote = true;
        }
      });
      return {committed:valid && wrote};
    } catch (error) {
      scope.settle(ticket, () => {
        if (seq === walletReadSeq && targetAtEpoch === targetEpoch &&
            targetAtStart === targetUserId) onError(error);
      });
      return {committed:false,error};
    }
  };
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    scope.dispose();
    stockReadSeq++;
    walletReadSeq++;
    targetEpoch++;
    // No React state callbacks on unmount.
  };
  return Object.freeze({
    observeActor, selectMerchant, selectWalletTarget, revoke,
    loadStock, loadWallet, dispose,
    snapshot: () => Object.freeze({
      ...scope.snapshot(), targetUserId, targetEpoch,
      stockReadSeq, walletReadSeq, stopped
    })
  });
}
