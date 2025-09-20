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

  const { images, recommendedProducts, analysis } = searchResults;

  /**
   * Handles the start of a drag event for the main "Your Item" image.
   * This function only attaches the image URL to the drag event, as requested.
   * The user will manually select the category after dropping the image.
   */
  const handleYourItemDragStart = (e) => {
    // 1. Check if the image we want to drag exists.
    if (!images || images.length === 0) {
      console.error("Drag failed: 'Your Item' image is not available.");
      e.preventDefault(); // Stop the drag if there's no image
      return;
    }

    // 2. Prepare the data to be dragged. We ONLY need the image URL.
    const dragData = {
      imageUrl: images[0].url,
    };

    console.log("Dragging 'Your Item' photo.");

    // 3. Attach the data to the drag event.
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
  };

  return (
    <div className="recommendations-container">
      {/* --- THIS IS THE CORRECTED SECTION --- */}
      {images && images.length > 0 && (
        <div className="uploaded-image-section">
          <h2>Your Item</h2>
          <img 
            src={images[0].url} 
            alt="User upload" 
            className="uploaded-image"
            draggable="true"
            onDragStart={handleYourItemDragStart}
            style={{ cursor: 'grab' }}
          />
          {recommendedProducts && recommendedProducts.length > 0 && analysis?.category !== 'decor' && (
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