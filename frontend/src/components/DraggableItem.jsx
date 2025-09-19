import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { segmentImage } from '../api/apiService';

const DraggableItem = ({ id, imageUrl, onDrop }) => {
    const [clothingType, setClothingType] = useState('top'); // Default type
    const [segmentedUrl, setSegmentedUrl] = useState(null);
    const [isSegmenting, setIsSegmenting] = useState(false);

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'item',
        item: { id, left: 0, top: 0 },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        // This is called when dragging starts
        begin: async () => {
            setIsSegmenting(true);
            try {
                // Convert image URL to a File object to send to the backend
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const file = new File([blob], "segment.png", { type: blob.type });

                const segmentedBlob = await segmentImage(file, clothingType);
                const url = URL.createObjectURL(segmentedBlob);
                setSegmentedUrl(url);
            } catch (error) {
                console.error("Failed to segment image:", error);
                setSegmentedUrl(imageUrl); // Fallback to original image on error
            } finally {
                setIsSegmenting(false);
            }
        },
        // This is called when dragging ends
        end: (item, monitor) => {
            if (monitor.didDrop()) {
                onDrop(id, segmentedUrl || imageUrl);
            }
        }
    }), [id, imageUrl, clothingType, segmentedUrl]);

    return (
        <div className="draggable-item-container">
            <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
                <img src={imageUrl} alt="draggable item" style={{ width: '100px', pointerEvents: 'none' }} />
                 {isSegmenting && <div className="segmenting-overlay">Processing...</div>}
            </div>
            <select value={clothingType} onChange={(e) => setClothingType(e.target.value)}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="skirt">Skirt</option>
                <option value="kurta">Kurta</option>
                <option value="lehenga">Lehenga</option>
            </select>
        </div>
    );
};

export default DraggableItem;