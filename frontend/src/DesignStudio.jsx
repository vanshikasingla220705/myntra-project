import React, { useState, useCallback, useEffect } from 'react';
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
      formData.append('image', file);
      // CORRECTED URL with /api prefix
      const segmentResponse = await axios.post(`http://localhost:5000/api/segment/${itemCategory}`, formData, {
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
        setSelectedFile(null);
      };
    } catch (err) {
      console.error("Segmentation failed:", err);
      //setError('Failed to segment item. Is the backend server running?');
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

  const handleUploaderDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsOverUploader(false);
    setError('');

    // 1. CHECK FOR INTERNAL DRAG DATA FIRST
    const internalDataString = e.dataTransfer.getData('application/my-app-data');
    if (internalDataString) {
        const internalData = JSON.parse(internalDataString);
        const imageUrl = internalData.src;
        const imageType = internalData.type;

        setIsLoading(true);
        try {
            const proxyUrl = `http://localhost:5000/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Failed to fetch internal image via backend.');
            
            const imageBlob = await response.blob();
            const imageFile = new File([imageBlob], "dropped-image.png", { type: imageBlob.type });
            
            segmentAndAddItem(imageFile, imageType); 
        } catch (err) {
            console.error("Error fetching internal image:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // 2. CHECK FOR FILES FROM DESKTOP
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

    // 3. CHECK FOR EXTERNAL URLS
    const url = e.dataTransfer.getData('text/uri-list');
    if (url) {
        setIsLoading(true);
        try {
            // CORRECTED URL with /api prefix
            const proxyUrl = `http://localhost:5000/api/proxy-image?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Failed to fetch image from URL via backend.');
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

  const handleDeleteItem = () => {
    if (!selectedId) return;
    const newItems = items.filter((item) => item.id !== selectedId);
    setItems(newItems);
    selectShape(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        handleDeleteItem();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, items, handleDeleteItem]); // Added handleDeleteItem to dependencies

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
          <p style={{fontSize: '12px', color: '#666'}}>Drag an image file here or from a website.</p>
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
          
          {selectedId && (
            <button 
              onClick={handleDeleteItem} 
              style={{ 
                padding: '8px 12px', 
                width: '100%',
                display: 'block', 
                marginTop: '10px', 
                backgroundColor: '#dc3545', 
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Delete Selected Item
            </button>
          )}
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