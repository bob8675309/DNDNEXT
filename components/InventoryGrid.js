//  /components/InventoryGrid.js
import ItemCard from "./ItemCard";

export default function InventoryGrid({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-muted p-5 text-center fst-italic">
        Inventory is empty.
      </div>
    );
  }

  return (
    <div className="container my-3">
      <div className="row g-3">
        {items.map((item, i) => (
          <div key={item.id || i} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <ItemCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
