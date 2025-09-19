import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { analyzeClothingImage, analyzeDecorImage } from '../api/apiService';
import Loader from '../components/Loader';
import './ImageAnalyzerPage.css';

const ImageAnalyzerPage = ({ type }) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();
  const { setIsLoading, setSearchResults, setError } = useSearch();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert('Please upload an image.');
      return;
    }

    setIsProcessing(true); // Show loader on this page
    setIsLoading(true);    // Set global loading state
    setError(null);
    setSearchResults(null);

    const formData = new FormData();
    formData.append('images', imageFile);
    formData.append('queryText', prompt);

    try {
      const apiCall = type === 'clothing' ? analyzeClothingImage : analyzeDecorImage;
      const { data } = await apiCall(formData);

      if (data.success) {
        setSearchResults(data);
        navigate('/recommendations');
      } else {
        setError(data.error || 'Failed to get recommendations.');
        navigate('/recommendations'); // Navigate even on error to show the message
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

  return (
    <div className="analyzer-container">
      <h2>Analyze Your {type === 'clothing' ? 'Clothing' : 'Decor'} Item</h2>
      <p>Upload an image and add a prompt to get personalized AI recommendations.</p>
      <form onSubmit={handleSubmit} className="analyzer-form">
        <div className="image-upload-box">
          <input type="file" id="imageUpload" accept="image/*" onChange={handleImageChange} />
          <label htmlFor="imageUpload">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="image-preview" />
            ) : (
              <span>Click to Upload Image</span>
            )}
          </label>
        </div>
        <textarea
          className="prompt-input"
          placeholder={`e.g., "What goes with this for a summer party?"`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button type="submit" className="search-btn" disabled={!imageFile}>
          Search
        </button>
      </form>
    </div>
  );
};

export default ImageAnalyzerPage;