import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import ClothingItem from './ClothingItem';
import backgroundImage from './assets/bg.png';

const BACKGROUND_URL = backgroundImage;

const Background = () => {
  const [image] = useImage(BACKGROUND_URL, 'Anonymous');
  return <KonvaImage image={image} width={400} height={600} />;
};

function DesignStudio() {
  const [items, setItems] = useState([]);
  const [selectedId, selectShape] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [clothingType, setClothingType] = useState('top');
  const clothingOptions = ['top', 'bottom', 'skirt', 'coord', 'kurta', 'lehenga'];
  const [isOverUploader, setIsOverUploader] = useState(false);

  const segmentAndAddItem = useCallback(async (file, itemCategory, dropPosition = { x: 100, y: 100 }) => {
    setIsLoading(true);
    setError('');
    try {
      const formData = new FormData();
      // CORRECTED: The form data key must be 'file' to match the Flask backend.
      formData.append('file', file);

      // CORRECTED: The API endpoint URL must match the port (8001) of your Flask server.
      const segmentResponse = await axios.post(`http://localhost:8001/segment/${itemCategory}`, formData, {
        responseType: 'blob',
      });

      const segmentedUrl = URL.createObjectURL(segmentResponse.data);
      const image = new window.Image();
      image.src = segmentedUrl;
      image.onload = () => {
        const newItem = {
          src: segmentedUrl, id: 'item' + Date.now(),
          x: dropPosition.x, y: dropPosition.y,
          width: 150, height: (image.height / image.width) * 150,
        };
        setItems((currentItems) => [...currentItems, newItem]);
        setSelectedFile(null); // Clear manual selection after processing
      };
    } catch (err) {
      console.error("Segmentation failed:", err);
      setError('Failed to segment item. Is the backend server running on port 8001?');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const handleDragOver = (e) => e.preventDefault();
  
  const handleCanvasDrop = (e) => e.preventDefault();

  // --- THIS IS THE CORRECTED DROP HANDLER ---
  const handleUploaderDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsOverUploader(false);
    setError('');

    // Priority 1: Check for local files from the computer.
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        segmentAndAddItem(file, clothingType);
      } else {
        setError('Please drop an image file (PNG, JPG, etc.).');
      }
      e.dataTransfer.clearData();
      return;
    }

    // Priority 2: Check for a direct image URL from a website.
    const url = e.dataTransfer.getData('text/uri-list');
    if (url) {
      setIsLoading(true);
      try {
        // A CORS proxy helps prevent errors when fetching images from other domains.
        const response = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
        if (!response.ok) throw new Error('Failed to fetch image from URL.');
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('The dragged link is not a direct image link.');
        }
        const imageBlob = await response.blob();
        const imageFile = new File([imageBlob], "dropped-image.png", { type: imageBlob.type });
        segmentAndAddItem(imageFile, clothingType);
      } catch (err) {
        console.error("Error fetching dropped image:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    setError("Could not find a valid image file or URL in the dropped item.");
  }, [segmentAndAddItem, clothingType]);
  
  const checkDeselect = (e) => {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
          selectShape(null);
      }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', display: 'flex', gap: '20px' }}>
      <div style={{ maxWidth: '400px' }}>
        <div 
          style={{ 
            marginBottom: '20px', padding: '10px', 
            border: isOverUploader ? '2px dashed #007bff' : '1px solid #ccc',
            borderRadius: '5px',
            backgroundColor: isOverUploader ? '#f0f8ff' : 'transparent',
            transition: 'border .2s, background-color .2s'
          }}
          onDrop={handleUploaderDrop} onDragOver={handleDragOver}
          onDragEnter={() => setIsOverUploader(true)} onDragLeave={() => setIsOverUploader(false)}
        >
          <h2>2. Upload Your Own</h2>
          <p style={{fontSize: '12px', color: '#666'}}>Drag a local image file or an image from a website here.</p>
          <select value={clothingType} onChange={(e) => setClothingType(e.target.value)} style={{ marginRight: '10px', padding: '8px' }}>
            {clothingOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
          <input type="file" onChange={handleFileChange} accept="image/*" style={{display: 'none'}} id="file-input" />
          <label htmlFor="file-input" style={{cursor: 'pointer', textDecoration: 'underline'}}>Choose file</label>
          {selectedFile && <p style={{marginTop: '10px', fontWeight: 'bold'}}>Selected: {selectedFile.name}</p>}
          <button onClick={handleManualUpload} disabled={isLoading || !selectedFile} style={{ padding: '8px 12px', display: 'block', marginTop: '10px' }}>
            {isLoading ? 'Processing...' : 'Add to Studio'}
          </button>
        </div>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </div>
      <div style={{ border: '2px solid black' }}>
        <Stage width={400} height={600} onMouseDown={checkDeselect} onTouchStart={checkDeselect} onDragOver={handleDragOver} onDrop={handleCanvasDrop}>
          <Layer>
             <Background />
             {items.map((item) => ( <ClothingItem key={item.id} shapeProps={item} isSelected={item.id === selectedId} onSelect={() => selectShape(item.id)} onChange={(newAttrs) => { const newItems = items.slice(); const index = items.findIndex(i => i.id === item.id); newItems[index] = newAttrs; setItems(newItems); }} /> ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

export default DesignStudio;

