import React from 'react';
import './CartStylingPage.css';

// Mock data since this page has no backend
const cartItems = [
    { id: 1, name: 'Classic Blue Jeans', imageUrl: 'https://via.placeholder.com/200x300.png?text=Blue+Jeans' },
    { id: 2, name: 'White Linen Shirt', imageUrl: 'https://via.placeholder.com/200x300.png?text=Linen+Shirt' },
];

const StylingTips = () => (
    <div className="styling-tips">
        <h3>Styling Your Blue Jeans</h3>
        <ul>
            <li><strong>Casual Day Out:</strong> Pair with the white linen shirt and white sneakers for a timeless look.</li>
            <li><strong>Evening Look:</strong> Swap the shirt for a black silk camisole, add a leather jacket and heeled boots.</li>
            <li><strong>Accessorize:</strong> A brown leather belt and a simple silver necklace can elevate the entire outfit.</li>
        </ul>
         <h3>Styling Your White Linen Shirt</h3>
        <ul>
            <li><strong>Beach Vibe:</strong> Wear it open over a swimsuit with shorts.</li>
            <li><strong>Office Casual:</strong> Tuck it into tailored trousers or a midi skirt.</li>
        </ul>
    </div>
);

const CartStylingPage = () => {
    return (
        <div className="cart-styling-container">
            <h1>Styling Your Cart</h1>
            <div className="cart-content">
                <div className="cart-items-grid">
                    {cartItems.map(item => (
                        <div key={item.id} className="cart-item-card">
                            <img src={item.imageUrl} alt={item.name} />
                            <h4>{item.name}</h4>
                        </div>
                    ))}
                </div>
                <div className="tips-section">
                    <h2>Our AI Stylist Recommends</h2>
                    <StylingTips />
                </div>
            </div>
        </div>
    );
};

export default CartStylingPage;