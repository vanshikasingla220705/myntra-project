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

  // Destructure what you need from the search results
  const { images, recommendedProducts, groupedResults } = searchResults;

  return (
    <div className="recommendations-container">
      {/* --- THIS IS THE CORRECTED SECTION --- */}
      {images && images.length > 0 && (
        <div className="uploaded-image-section">
          <h2>Your Item(s)</h2>
          {/* Create a container for the images */}
          <div className="uploaded-images-container">
            {/* Map over the entire 'images' array to show all of them */}
            {images.map((image, index) => (
              <img
                key={image.public_id || index} // Use a unique key
                src={image.url}
                alt={`User upload ${index + 1}`}
                className="uploaded-image"
              />
            ))}
          </div>
          {(recommendedProducts || groupedResults) && searchResults.analysis?.category !== 'decor' && (
            <Link to="/mix-and-match" className="mix-match-btn">Mix & Match</Link>
          )}
        </div>
      )}
      {/* --- END OF CORRECTED SECTION --- */}

      {/* Logic for displaying grouped results */}
      {groupedResults && groupedResults.length > 0 ? (
        groupedResults.map((group, index) => (
          group.products.length > 0 && (
            <div key={index} className="recommendation-group">
              <h2 className="group-title">
                Recommendations for "{group.searchTerm}"
              </h2>
              <div className="recommendations-grid">
                {group.products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </div>
          )
        ))
      // Fallback logic for displaying flat list of results
      ) : recommendedProducts && recommendedProducts.length > 0 ? (
        <div className="recommendation-group">
          <h2 className="group-title">AI Recommendations</h2>
          <div className="recommendations-grid">
            {recommendedProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        <p className="info-message">{searchResults.message || "No products found."}</p>
      )}
    </div>
  );
};

export default RecommendationsPage;