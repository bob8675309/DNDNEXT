// /components/MerchantPanel.js
import ItemCard from "./ItemCard";

export default function MerchantPanel({ merchant }) {
  if (!merchant) return null;
  const items = merchant.inventory || [];

  return (
    <div className="container my-3">
      <div className="d-flex align-items-baseline justify-content-between mb-3">
        <h2 className="h4 m-0">{merchant.name}’s Wares</h2>
        {merchant.location && (
          <span className="text-muted small">Location: {merchant.location}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-muted fst-italic">No items available.</div>
      ) : (
        <div className="row g-3">
          {items.map((item, i) => (
            <div key={item.id || i} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
              <ItemCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
