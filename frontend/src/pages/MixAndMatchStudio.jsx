import React from 'react';
import RecommendationsPage from './RecommendationsPage';
import DesignStudio from '../DesignStudio';// Adjust path if necessary
import './MixAndMatchStudio.css'; // We'll create this for styling

const MixAndMatchStudio = () => {
  return (
    <div className="mix-and-match-container">
      <div className="recommendations-panel">
        {/* The entire RecommendationsPage goes here */}
        <RecommendationsPage />
      </div>
      <div className="studio-panel">
        {/* The DesignStudio canvas and tools go here */}
        <DesignStudio />
      </div>
    </div>
  );
};

export default MixAndMatchStudio;