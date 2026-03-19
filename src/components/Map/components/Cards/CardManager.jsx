import React, { useState, useEffect, useCallback } from 'react';
import BaseCard from './BaseCard';

const CardManager = ({ 
  map, 
  activeCards, 
  onCardClose, 
  onSceneNavigate,
  autoPosition = true
}) => {
  const [visibleCards, setVisibleCards] = useState([]);
  const [cardPositions, setCardPositions] = useState({});

  // Update visible cards when activeCards change
  useEffect(() => {
    if (activeCards && activeCards.length > 0) {
      setVisibleCards(activeCards);

      if (autoPosition && map?.current) {
        setCardPositions((prevPositions) => {
          const nextPositions = {};
          const mapContainer = map.current.getContainer();
          const containerRect = mapContainer.getBoundingClientRect();
          const cardWidth = 320;
          const rightPadding = 78;
          const topPadding = 78;
          const stackOffsetY = 36;
          const stackOffsetX = 8;

          activeCards.forEach((card, index) => {
            nextPositions[card.id] = prevPositions[card.id] || {
              // Desktop default: open near top-right (not centered), with a slight cascade for multiple cards.
              lng: containerRect.width - cardWidth - rightPadding - (index * stackOffsetX),
              lat: topPadding + (index * stackOffsetY)
            };
          });

          return nextPositions;
        });
      }
    } else {
      setVisibleCards([]);
      setCardPositions({});
    }
  }, [activeCards, map, autoPosition]);

  const handleCardClose = useCallback((cardId) => {
    setVisibleCards(prev => prev.filter(card => card.id !== cardId));
    setCardPositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[cardId];
      return newPositions;
    });
    onCardClose?.(cardId);
  }, [onCardClose]);

  const handleNavigate = useCallback((card) => {
    if (card.nextSceneId) {
      onSceneNavigate?.(card.nextSceneId);
    }
  }, [onSceneNavigate]);

  const handleCardPositionUpdate = useCallback((cardId, newPosition) => {
    setCardPositions(prev => ({
      ...prev,
      [cardId]: newPosition
    }));
  }, []);

  // If no cards, don't render anything
  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <>
      {visibleCards.map((card, index) => {
        const position = cardPositions[card.id] || card.position || { lng: 0, lat: 0 };
        const renderKey = `card-slot-${index}`; // Keep slot keys stable so BaseCard state persists across scene changes
        
        return (
          <BaseCard
            key={renderKey}
            {...card}
            position={position}
            map={map}
            onClose={() => handleCardClose(card.id)}
            onNavigate={() => handleNavigate(card)}
            onPositionUpdate={(newPos) => handleCardPositionUpdate(card.id, newPos)}
          />
        );
      })}
    </>
  );
};

export default CardManager;
