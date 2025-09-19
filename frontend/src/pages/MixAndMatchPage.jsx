import React, { useState, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useSearch } from '../context/SearchContext';
import DraggableItem from '../components/DraggableItem';
import './MixAndMatchPage.css';

// This component will represent an item placed on the canvas
const CanvasItem = ({ id, left, top, imageUrl }) => {
    return (
        <div style={{ position: 'absolute', left, top, border: '1px dashed gray', padding: '4px', cursor: 'move' }}>
            <img src={imageUrl} alt="canvas item" style={{ width: '150px' }} />
        </div>
    );
};

const MixAndMatchPage = () => {
    const { searchResults } = useSearch();
    const [canvasItems, setCanvasItems] = useState({});

    // This callback moves an item on the canvas
    const moveItem = useCallback((id, left, top) => {
        setCanvasItems(prev => ({
            ...prev,
            [id]: { ...prev[id], left, top }
        }));
    }, []);

    // This makes the canvas a drop target
    const [, drop] = useDrop(() => ({
        accept: 'item',
        drop(item, monitor) {
            const delta = monitor.getDifferenceFromInitialOffset();
            const left = Math.round(item.left + delta.x);
            const top = Math.round(item.top + delta.y);
            moveItem(item.id, left, top);
            return undefined; // A drop result can be defined here if needed
        },
    }), [moveItem]);


    const allItems = [
        ...(searchResults?.images || []),
        ...(searchResults?.recommendedProducts?.map(p => ({ url: p.image_url, _id: p._id })) || [])
    ];

    return (
        <div className="mix-match-container">
            <div ref={drop} className="canvas-area">
                {Object.values(canvasItems).map(item => (
                   <CanvasItem key={item.id} {...item} />
                ))}
                <div className="canvas-placeholder">Drop Items Here to Create Your Look</div>
            </div>

            <div className="sidebar-area">
                <h3>Your Items</h3>
                <div className="sidebar-items">
                    {allItems.map((item, index) => (
                        <DraggableItem
                            key={item._id || `uploaded-${index}`}
                            id={item._id || `uploaded-${index}`}
                            imageUrl={item.url || item.image_url}
                            onDrop={(id, segmentedUrl) => {
                                // Add new item to canvas on drop
                                setCanvasItems(prev => ({ ...prev, [id]: { id, left: 50, top: 50, imageUrl: segmentedUrl }}));
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MixAndMatchPage;