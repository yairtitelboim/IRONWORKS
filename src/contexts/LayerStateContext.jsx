import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * LayerStateContext
 *
 * Shared boolean layer/marker state for LayerToggle, AITransmissionNav, and
 * any map effects that depend on infrastructure, routes, or special markers.
 *
 * This does not yet push state into Mapbox; that will be handled by a separate
 * hook (useLayerStateToMapEffects) so UI and side effects stay decoupled.
 */

const LayerStateContext = createContext(null);

export const LayerStateProvider = ({ children }) => {
  // Initial values mirror the common toggles used today.
  const [showKeyInfrastructure, setShowKeyInfrastructure] = useState(false);
  const [showLandcover, setShowLandcover] = useState(false);
  const [showCommercialPermits, setShowCommercialPermits] = useState(false);
  const [showMajorPermits, setShowMajorPermits] = useState(false);
  const [showStartupIntelligence, setShowStartupIntelligence] = useState(false);
  const [showTDLR, setShowTDLR] = useState(false);
  const [showIrrigationDistrict, setShowIrrigationDistrict] = useState(false);
  const [showCasaGrandeBoundary, setShowCasaGrandeBoundary] = useState(false);
  const [showLucid, setShowLucid] = useState(false);
  const [showR3Data, setShowR3Data] = useState(false);
  const [showGridHeatmap, setShowGridHeatmap] = useState(false);
  const [showCommuteIsochrones, setShowCommuteIsochrones] = useState(false);
  const [showPopulationIsochrones, setShowPopulationIsochrones] = useState(false);
  const [showNcPower, setShowNcPower] = useState(false);
  const [showDukeTransmissionEasements, setShowDukeTransmissionEasements] =
    useState(false);
  const [showToyotaAccessRoute, setShowToyotaAccessRoute] = useState(false);
  const [showGreensboroDurhamRoute, setShowGreensboroDurhamRoute] =
    useState(false);
  const [showCibolaPhoenixRoute, setShowCibolaPhoenixRoute] = useState(false);
  const [showCyrusOneMarker, setShowCyrusOneMarker] = useState(false);
  const [showTsmc, setShowTsmc] = useState(false);
  const [showTsmcMarker, setShowTsmcMarker] = useState(false);
  const [showGridPerplexityAnalysis, setShowGridPerplexityAnalysis] =
    useState(false);

  const value = useMemo(
    () => ({
      showKeyInfrastructure,
      setShowKeyInfrastructure,
      showLandcover,
      setShowLandcover,
      showCommercialPermits,
      setShowCommercialPermits,
      showMajorPermits,
      setShowMajorPermits,
      showStartupIntelligence,
      setShowStartupIntelligence,
      showTDLR,
      setShowTDLR,
      showIrrigationDistrict,
      setShowIrrigationDistrict,
      showCasaGrandeBoundary,
      setShowCasaGrandeBoundary,
      showLucid,
      setShowLucid,
      showR3Data,
      setShowR3Data,
      showGridHeatmap,
      setShowGridHeatmap,
      showCommuteIsochrones,
      setShowCommuteIsochrones,
      showPopulationIsochrones,
      setShowPopulationIsochrones,
      showNcPower,
      setShowNcPower,
      showDukeTransmissionEasements,
      setShowDukeTransmissionEasements,
      showToyotaAccessRoute,
      setShowToyotaAccessRoute,
      showGreensboroDurhamRoute,
      setShowGreensboroDurhamRoute,
      showCibolaPhoenixRoute,
      setShowCibolaPhoenixRoute,
      showCyrusOneMarker,
      setShowCyrusOneMarker,
      showTsmc,
      setShowTsmc,
      showTsmcMarker,
      setShowTsmcMarker,
      showGridPerplexityAnalysis,
      setShowGridPerplexityAnalysis
    }),
    [
      showKeyInfrastructure,
      showLandcover,
      showCommercialPermits,
      showMajorPermits,
      showStartupIntelligence,
      showTDLR,
      showIrrigationDistrict,
      showCasaGrandeBoundary,
      showLucid,
      showR3Data,
      showGridHeatmap,
      showCommuteIsochrones,
      showPopulationIsochrones,
      showNcPower,
      showDukeTransmissionEasements,
      showToyotaAccessRoute,
      showGreensboroDurhamRoute,
      showCibolaPhoenixRoute,
      showCyrusOneMarker,
      showTsmc,
      showTsmcMarker,
      showGridPerplexityAnalysis
    ]
  );

  return (
    <LayerStateContext.Provider value={value}>
      {children}
    </LayerStateContext.Provider>
  );
};

export const useLayerState = () => {
  const ctx = useContext(LayerStateContext);
  if (!ctx) {
    throw new Error('useLayerState must be used within a LayerStateProvider');
  }
  return ctx;
};


