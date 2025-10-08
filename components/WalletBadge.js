// /components/WalletBadge.js
export default function WalletBadge({ gp, onClick }) {
  const txt = gp == null ? "…" : (gp === -1 ? "∞ gp" : `${gp} gp`);
  return (
    <button type="button" className="badge bg-secondary border-0" onClick={onClick} title="Wallet">
      {txt}
    </button>
  );
}