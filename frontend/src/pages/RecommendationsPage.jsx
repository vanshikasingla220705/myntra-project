import React from 'react';
import { Link } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import Loader from '../components/Loader';
import ProductCard from '../components/ProductCard';
import './RecommendationsPage.css';

const RecommendationsPage = () => {
  const { searchResults, isLoading, error } = useSearch();

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!searchResults) {
    return <div className="info-message">Perform a search to see recommendations here.</div>;
  }

  const { images, recommendedProducts } = searchResults;

  return (
    <div className="recommendations-container">
      {images && images.length > 0 && (
         <div className="uploaded-image-section">
            <h2>Your Item</h2>
            <img src={images[0].url} alt="User upload" className="uploaded-image" />
             {/* Only show Mix & Match for clothing results */}
            {recommendedProducts && recommendedProducts.length > 0 && searchResults.analysis?.category !== 'decor' && (
                <Link to="/mix-and-match" className="mix-match-btn">Mix & Match</Link>
            )}
        </div>
      )}

      <h2>AI Recommendations</h2>
      {recommendedProducts && recommendedProducts.length > 0 ? (
        <div className="recommendations-grid">
          {recommendedProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <p className="info-message">{searchResults.message || "No products found matching the recommendations."}</p>
      )}
    </div>
  );
};

export default RecommendationsPage;