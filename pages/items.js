// /pages/items.js
import { useEffect, useState } from "react";
import ItemList from "../components/ItemList";

export default function ItemsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch("/items/all-items.json")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  return <ItemList items={items} />;
}
