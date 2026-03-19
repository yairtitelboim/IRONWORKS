import React, { createContext, useContext, useState, useEffect } from 'react';
import PerplexityReasoningModal from '../components/PerplexityReasoningModal';

const PerplexityModalContext = createContext();

export const usePerplexityModal = () => {
  const context = useContext(PerplexityModalContext);
  if (!context) {
    throw new Error('usePerplexityModal must be used within a PerplexityModalProvider');
  }
  return context;
};

export const PerplexityModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reasoningData, setReasoningData] = useState(null);
  const [neighborhoodName, setNeighborhoodName] = useState('');

  const openModal = (data, neighborhood) => {
    setReasoningData(data);
    setNeighborhoodName(neighborhood || '');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setReasoningData(null);
    setNeighborhoodName('');
  };

  // Listen for custom events from popup utilities
  useEffect(() => {
    const handleOpenModal = (event) => {
      const { reasoning, sources, neighborhood } = event.detail;
      
      // Create a more robust data structure
      const modalData = {
        analysis: reasoning,
        reasoning: reasoning, // Also store as reasoning for compatibility
        sources: sources || [],
        rawData: event.detail // Store the raw event data for debugging
      };
      
      openModal(modalData, neighborhood);
    };

    const handleUpdateReasoningData = (event) => {
      setReasoningData(event.detail);
    };

    window.addEventListener('openPerplexityModal', handleOpenModal);
    window.addEventListener('updateReasoningData', handleUpdateReasoningData);
    
    return () => {
      window.removeEventListener('openPerplexityModal', handleOpenModal);
      window.removeEventListener('updateReasoningData', handleUpdateReasoningData);
    };
  }, []);

  return (
    <PerplexityModalContext.Provider value={{ openModal, closeModal, isOpen, reasoningData, neighborhoodName }}>
      {children}
      <PerplexityReasoningModal
        isOpen={isOpen}
        onClose={closeModal}
        reasoningData={reasoningData}
        neighborhoodName={neighborhoodName}
      />
    </PerplexityModalContext.Provider>
  );
};
