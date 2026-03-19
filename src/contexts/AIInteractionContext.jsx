import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * AIInteractionContext
 *
 * Central place for AI-related UI/interaction state that is currently
 * scattered across BaseCard, NestedCircleButton, and AI response components.
 *
 * Initial scope is deliberately minimal and non-breaking; we mirror the
 * existing defaults from BaseCard and can progressively migrate fields.
 */

const AIInteractionContext = createContext(null);

export const AIInteractionProvider = ({ children }) => {
  // Provider-local state mirrors the most critical shared fields.
  const [selectedAIProvider, setSelectedAIProvider] = useState('claude');
  const [viewMode, setViewMode] = useState('node'); // 'node' | 'site'
  const [isPerplexityMode, setIsPerplexityMode] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showMarkerDetails, setShowMarkerDetails] = useState(false);

  // We keep this generic so we can plug the existing useAIQuery wiring in later.
  const [aiResponsesState, setAiResponsesState] = useState({
    isLoading: false,
    responses: [],
    citations: [],
    pendingRequests: []
  });

  const value = useMemo(
    () => ({
      selectedAIProvider,
      setSelectedAIProvider,
      viewMode,
      setViewMode,
      isPerplexityMode,
      setIsPerplexityMode,
      selectedMarker,
      setSelectedMarker,
      showMarkerDetails,
      setShowMarkerDetails,
      aiResponsesState,
      setAiResponsesState
    }),
    [
      selectedAIProvider,
      viewMode,
      isPerplexityMode,
      selectedMarker,
      showMarkerDetails,
      aiResponsesState
    ]
  );

  return (
    <AIInteractionContext.Provider value={value}>
      {children}
    </AIInteractionContext.Provider>
  );
};

export const useAIInteraction = () => {
  const ctx = useContext(AIInteractionContext);
  if (!ctx) {
    throw new Error('useAIInteraction must be used within an AIInteractionProvider');
  }
  return ctx;
};


