import React, { useState } from 'react';
import axios from 'axios';;
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import ClothingItem from './ClothingItem';
import backgroundImage from './assets/bg.png';
// You can use a mannequin or a simple background image here
const BACKGROUND_URL = backgroundImage; 

 // ADD THIS LINE

const Background = () => {
  const [image] = useImage(BACKGROUND_URL, 'Anonymous');
  return <KonvaImage image={image} width={400} height={600} />;
};

function DesignStudio() {
  const [items, setItems] = useState([]);
  const [selectedId, selectShape] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState(''); 
  
  // State for the new AI Stylist
  const [query, setQuery] = useState('What should I wear for a brunch in Jaipur?');
  const [recommendations, setRecommendations] = useState([]);

  // States for the manual uploader
  const [selectedFile, setSelectedFile] = useState(null);
  const [clothingType, setClothingType] = useState('top');
  const clothingOptions = ['top', 'bottom', 'skirt', 'coord', 'kurta', 'lehenga'];

  // --- Core function to segment an item and add it to the canvas ---
  const segmentAndAddItem = async (file, itemCategory) => {
    setIsLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const segmentResponse = await axios.post(`http://localhost:5000/api/segment/${itemCategory}`, formData, {
        responseType: 'blob',
      });
      
      const segmentedUrl = URL.createObjectURL(segmentResponse.data);
      
      const image = new window.Image();
      image.src = segmentedUrl;
      image.onload = () => {
        const newItem = {
          src: segmentedUrl,
          id: 'item' + Date.now(), // Use timestamp for a unique ID
          x: 100,
          y: 100,
          width: image.width * 0.5,
          height: image.height * 0.5,
        };
        setItems((currentItems) => [...currentItems, newItem]);
      };
    } catch (err) {
      setError('Failed to segment the item.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handler for the AI Stylist Query ---
  const handleStylistQuery = async () => {
    if (!query) return;
    setIsLoading(true);
    setError('');
    setRecommendations([]);
    setReason(''); // Reset the reason
    try {
        const response = await axios.post('http://localhost:5000/api/stylist-query', { query });
        // The response.data is now an object, so we access its properties
        setRecommendations(response.data.products);
        setReason(response.data.reason);
    } catch (err) {
        setError('Sorry, I had trouble finding recommendations. Please try rephrasing.');
    } finally {
        setIsLoading(false);
    }
};
  
  // --- Handlers for uploads ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleManualUpload = () => {
    if (selectedFile) {
      segmentAndAddItem(selectedFile, clothingType);
    } else {
      setError('Please select a file first!');
    }
  };

  const handleRecommendationClick = async (item) => {
    try {
      // Fetch the image from the URL so we can upload it for segmentation
      const response = await fetch(item.imageUrl, { mode: 'cors' });
      const blob = await response.blob();
      const file = new File([blob], `${item.name}.png`, { type: blob.type });
      segmentAndAddItem(file, item.category);
    } catch (err) {
      setError('Could not process the recommended item.');
    }
  };

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) selectShape(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', display: 'flex', gap: '20px' }}>
      <div style={{ maxWidth: '400px' }}>
        {/* --- RECOMMENDATIONS DISPLAY --- */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4>Our Suggestions: (Click to add)</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {recommendations.map(item => (
                <img 
                  key={item.id} 
                  src={item.imageUrl} 
                  alt={item.name}
                  title={`Add ${item.name} to studio`}
                  style={{ width: '80px', cursor: 'pointer', border: '1px solid #eee' }}
                  onClick={() => handleRecommendationClick(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* --- MANUAL UPLOADER --- */}
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
          <h2>2. Upload Your Own</h2>
          <select value={clothingType} onChange={(e) => setClothingType(e.target.value)} style={{ marginRight: '10px', padding: '8px' }}>
            {clothingOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
          <input type="file" onChange={handleFileChange} accept="image/*" />
          <button onClick={handleManualUpload} disabled={isLoading} style={{ padding: '8px 12px' }}>
            {isLoading ? 'Processing...' : 'Add to Studio'}
          </button>
        </div>
        
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </div>

      {/* --- DESIGN STUDIO CANVAS --- */}
      <div style={{ border: '2px solid black' }}>
        <Stage width={400} height={600} onMouseDown={checkDeselect} onTouchStart={checkDeselect}>
          <Layer>
            <Background />
            {items.map((item, i) => (
              <ClothingItem
                key={item.id} shapeProps={item} isSelected={item.id === selectedId}
                onSelect={() => selectShape(item.id)}
                onChange={(newAttrs) => {
                  const newItems = items.slice();
                  newItems[i] = newAttrs;
                  setItems(newItems);
                }}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

export default DesignStudio;