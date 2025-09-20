// frontend/src/components/ProductCard.js

import React from 'react';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  // Define the handleDragStart function
  const handleDragStart = (e) => {
    console.log('Drag Start:', product.item_name);
    // The data we want to pass to the drop zone
    const dragData = {
      src: product.image_url,
      category: product.category, // Pass the category for the API endpoint
    };
    // Attach the data to the event
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
  };

  return (
    <div
      className="product-card"
      draggable="true" // Makes the card draggable
      onDragStart={handleDragStart} // Calls your function on drag
    >
      <img src={product.image_url} alt={product.item_name} className="product-image" />
      <div className="product-info">
        <h3 className="product-name">{product.item_name}</h3>
        <p className="product-description">{product.description}</p>
        <p className="product-price">${product.price}</p>
      </div>
    </div>
  );
};

export default ProductCard;