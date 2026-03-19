import { useCallback, useEffect, useState } from 'react';

/**
 * useCardDrag
 *
 * Encapsulates drag behavior for the BaseCard / Perplexity container:
 *  - Tracks drag state and offsets
 *  - Attaches global mousemove/mouseup listeners when dragging
 *  - Disables body text selection while dragging
 *
 * Expects refs to the main card and the Perplexity container so we can adjust
 * the correct element based on the current mode.
 */

export const useCardDrag = ({
  cardRef,
  perplexityContainerRef,
  isPerplexityMode,
  draggable = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const getCurrentElement = useCallback(() => {
    if (isPerplexityMode && perplexityContainerRef?.current) {
      return perplexityContainerRef.current;
    }
    if (cardRef?.current) {
      return cardRef.current;
    }
    return null;
  }, [cardRef, perplexityContainerRef, isPerplexityMode]);

  const handleMouseDown = useCallback(
    (e) => {
      if (!draggable) return;

      const currentRef = getCurrentElement();
      if (!currentRef) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);

      // Calculate offset from the card's current position, not the drag handle
      const rect = currentRef.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    },
    [draggable, getCurrentElement]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !draggable) return;

      const currentRef = getCurrentElement();
      if (!currentRef) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      currentRef.style.left = `${newX}px`;
      currentRef.style.top = `${newY}px`;
    },
    [isDragging, draggable, dragOffset.x, dragOffset.y, getCurrentElement]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse event listeners while dragging
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Disable text selection during drag
  useEffect(() => {
    if (!isDragging) return;

    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.userSelect = originalUserSelect || '';
    };
  }, [isDragging]);

  return {
    isDragging,
    handleMouseDown
  };
};


