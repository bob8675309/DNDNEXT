import React from "react";
import Image from "next/image";
import { FaInfoCircle, FaStar } from "react-icons/fa";

export default function ItemCard({ item }) {
  const {
    image_url,
    item_name,
    item_type,
    item_rarity,
    item_description,
    item_weight,
    item_cost
  } = item;

  return (
    <div className="card shadow-sm h-100">
      {image_url ? (
        <Image
          src={image_url}
          alt={item_name}
          width={400}
          height={300}
          className="card-img-top object-fit-cover border-bottom border-secondary"
        />
      ) : (
        <div className="card-img-top d-flex justify-content-center align-items-center bg-secondary text-white" style={{ height: "180px" }}>
          <FaStar size={32} />
        </div>
      )}

      <div className="card-body d-flex flex-column">
        <h5 className="card-title fw-bold text-truncate" title={item_name}>{item_name}</h5>
        <h6 className="card-subtitle mb-2 text-muted">
          {item_type} | {item_rarity}
        </h6>
        <p className="card-text small text-body flex-grow-1" style={{ whiteSpace: "pre-line" }}>
          {item_description || "No description available."}
        </p>
        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="badge bg-dark text-light">{item_weight || "?"} lbs</span>
          <span className="badge bg-warning text-dark">{item_cost || "?"} gp</span>
          <button className="btn btn-outline-info btn-sm ms-2" title="More Info">
            <FaInfoCircle />
          </button>
        </div>
      </div>
    </div>
  );
}
