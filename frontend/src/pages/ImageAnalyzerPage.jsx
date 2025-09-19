import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { analyzeClothingImage, analyzeDecorImage } from '../api/apiService';
import Loader from '../components/Loader';
import './ImageAnalyzerPage.css'; // Ensure this CSS file exists

const ImageAnalyzerPage = ({ type }) => {
  // Change to an array to hold up to two image files
  const [imageFiles, setImageFiles] = useState([]);
  // Change to an array to hold up to two image preview URLs
  const [imagePreviews, setImagePreviews] = useState([]);
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();
  const { setIsLoading, setSearchResults, setError } = useSearch();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageChange = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      // Create a new array for files and previews to maintain immutability
      const newImageFiles = [...imageFiles];
      const newImagePreviews = [...imagePreviews];

      newImageFiles[index] = file;
      newImagePreviews[index] = URL.createObjectURL(file);

      setImageFiles(newImageFiles);
      setImagePreviews(newImagePreviews);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (imageFiles.length === 0) {
      alert('Please upload at least one image.');
      return;
    }

    setIsProcessing(true);
    setIsLoading(true);
    setError(null);
    setSearchResults(null);

    const formData = new FormData();
    // Append all selected image files
    imageFiles.forEach(file => {
      if (file) { // Ensure file exists before appending
        formData.append('images', file);
      }
    });
    formData.append('queryText', prompt);

    try {
      const apiCall = type === 'clothing' ? analyzeClothingImage : analyzeDecorImage;
      const { data } = await apiCall(formData);

      if (data.success) {
        setSearchResults(data);
        navigate('/recommendations');
      } else {
        setError(data.error || 'Failed to get recommendations.');
        navigate('/recommendations');
      }
    } catch (err) {
      setError(err.message || 'An error occurred.');
      navigate('/recommendations');
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
    }
  };

  if (isProcessing) {
    return <Loader />;
  }

  // Determine if the second upload box should be visible
  const showSecondUpload = imageFiles.length > 0;

  return (
    <div className="analyzer-container">
      <h2>Analyze Your {type === 'clothing' ? 'Clothing' : 'Decor'} Item(s)</h2>
      <p>Upload up to two images and add an optional prompt to get personalized AI recommendations.</p>
      <form onSubmit={handleSubmit} className="analyzer-form">
        <div className="image-upload-grid"> {/* NEW: Grid for multiple uploads */}
          {/* First Upload Box */}
          <div className="image-upload-box">
            <input
              type="file"
              id="imageUpload1"
              accept="image/*"
              onChange={(e) => handleImageChange(e, 0)}
              style={{ display: 'none' }} // Hide default input
            />
            <label htmlFor="imageUpload1" className="upload-label">
              {imagePreviews[0] ? (
                <img src={imagePreviews[0]} alt="Preview 1" className="image-preview" />
              ) : (
                <span>Click to Add Image 1</span>
              )}
            </label>
            {imagePreviews[0] && (
              <button
                type="button"
                className="remove-image-btn"
                onClick={() => {
                  setImageFiles(prev => [null, prev[1]]); // Set first slot to null
                  setImagePreviews(prev => [null, prev[1]]); // Clear preview
                }}
              >
                X
              </button>
            )}
          </div>

          {/* Second Upload Box - conditionally rendered */}
          {showSecondUpload && (
            <div className="image-upload-box">
              <input
                type="file"
                id="imageUpload2"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 1)}
                style={{ display: 'none' }} // Hide default input
              />
              <label htmlFor="imageUpload2" className="upload-label">
                {imagePreviews[1] ? (
                  <img src={imagePreviews[1]} alt="Preview 2" className="image-preview" />
                ) : (
                  <span>Click to Add Image 2 (Optional)</span>
                )}
              </label>
              {imagePreviews[1] && (
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={() => {
                    setImageFiles(prev => [prev[0], null]); // Set second slot to null
                    setImagePreviews(prev => [prev[0], null]); // Clear preview
                  }}
                >
                  X
                </button>
              )}
            </div>
          )}
        </div>

        <textarea
          className="prompt-input"
          placeholder={`e.g., "What goes with this for a summer party?"`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button type="submit" className="search-btn" disabled={imageFiles.length === 0}>
          Search
        </button>
      </form>
    </div>
  );
};

export default ImageAnalyzerPage;