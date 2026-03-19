import React, { useState, useEffect, useCallback } from 'react';
import ScenePopupCard from './ScenePopupCard';

const ScenePopupManager = ({ 
  mapInstance, 
  activeCards = [], 
  onCardClose,
  onSceneNavigate 
}) => {
  const [cardPositions, setCardPositions] = useState(new Map());
  const [visibleCards, setVisibleCards] = useState(new Set());

  // Store pinned card positions separately
  const [pinnedPositions, setPinnedPositions] = useState(new Map());

  // Convert lat/lng to screen coordinates
  const updatePositions = useCallback(() => {
    if (!mapInstance || !activeCards.length) return;

    const positions = new Map();
    const visible = new Set();

    activeCards.forEach(card => {
      try {
        // For pinned cards, use stored screen position if available
        const isPinned = card.isPinned || false;
        const storedPosition = pinnedPositions.get(card.id);
        
        if (isPinned && storedPosition) {
          // Use the stored pinned position
          positions.set(card.id, storedPosition);
          visible.add(card.id); // Pinned cards are always considered visible
        } else {
          // Convert geographic coordinates to screen coordinates
          const screenCoords = mapInstance.project([card.position.lng, card.position.lat]);
          
          // Check if the point is within the visible map bounds
          const mapBounds = mapInstance.getBounds();
          const isVisible = mapBounds.contains([card.position.lng, card.position.lat]);
          
          positions.set(card.id, {
            x: screenCoords.x,
            y: screenCoords.y
          });
          
          if (isVisible) {
            visible.add(card.id);
          }
        }
      } catch (error) {
        console.warn(`Error calculating position for card ${card.id}:`, error);
      }
    });

    setCardPositions(positions);
    setVisibleCards(visible);
  }, [mapInstance, activeCards, pinnedPositions]);

  // Update positions when map moves or cards change
  useEffect(() => {
    if (!mapInstance) return;

    // Initial position calculation
    updatePositions();

    // Event listeners for map movement
    const events = ['move', 'zoom', 'rotate', 'pitch', 'resize'];
    
    events.forEach(event => {
      mapInstance.on(event, updatePositions);
    });

    // Cleanup event listeners
    return () => {
      events.forEach(event => {
        mapInstance.off(event, updatePositions);
      });
    };
  }, [mapInstance, updatePositions]);

  // Handle card close
  const handleCardClose = useCallback((cardId) => {
    if (onCardClose) {
      onCardClose(cardId);
    }
  }, [onCardClose]);

  // Handle scene navigation
  const handleSceneNavigate = useCallback((sceneId) => {
    if (onSceneNavigate) {
      onSceneNavigate(sceneId);
    }
  }, [onSceneNavigate]);

  // Handle pin state changes
  const handlePinChange = useCallback((cardId, isPinned, position) => {
    if (isPinned) {
      // Store the pinned position
      setPinnedPositions(prev => new Map(prev.set(cardId, position)));
    } else {
      // Remove the pinned position
      setPinnedPositions(prev => {
        const newMap = new Map(prev);
        newMap.delete(cardId);
        return newMap;
      });
    }
    
    console.log(`🎴 Card ${cardId} ${isPinned ? 'pinned' : 'unpinned'} at position:`, position);
  }, []);

  // Don't render anything if no map instance or no active cards
  if (!mapInstance || !activeCards.length) {
    return null;
  }

  return (
    <>
      {activeCards.map(card => {
        const screenPosition = cardPositions.get(card.id);
        const isVisible = visibleCards.has(card.id);
        
        return (
          <ScenePopupCard
            key={card.id}
            card={card}
            screenPosition={screenPosition}
            isVisible={isVisible}
            onClose={handleCardClose}
            onNavigate={handleSceneNavigate}
            onPinChange={handlePinChange}
          />
        );
      })}
    </>
  );
};

export default ScenePopupManager;