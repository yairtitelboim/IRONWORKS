import React, { useState, useEffect, forwardRef, useImperativeHandle, Suspense } from 'react';
import {
  LayerToggleContainer,
  LayerHeader,
  Title,
  CollapseButton,
  ExpandButton,
  CategorySection,
  CategoryHeader,
  CategoryIcon,
  CategoryTitle,
  ToggleSwitch,
} from './styles/LayerToggleStyles';
import SceneManager from './SceneManager';
import { NeighborhoodPopup } from './NeighborhoodPopup';
import { setMainRoadsEmphasis } from '../../../utils/mapStyleController';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { logEvent } from '../../../services/analyticsApi';
const HIFLDTransmissionLayer = React.lazy(() => import('./HIFLDTransmissionLayer'));
const REITLayer = React.lazy(() => import('./REITLayer'));
const ERCOTGISReportsLayer = React.lazy(() => import('./ERCOTGISReportsLayer'));
const ProducerConsumerCountiesLayer = React.lazy(() => import('./ProducerConsumerCountiesLayer'));
const SpatialMismatchCountiesLayer = React.lazy(() => import('./SpatialMismatchCountiesLayer'));
const MemphisCountiesLayer = React.lazy(() => import('./MemphisCountiesLayer'));
const MemphisAIExpansionLayer = React.lazy(() => import('./MemphisAIExpansionLayer'));
const MLGW2026SubstationLayer = React.lazy(() => import('./MLGW2026SubstationLayer'));
const XAISitesPublicLayer = React.lazy(() => import('./XAISitesPublicLayer'));
const XAIToMLGWLinesLayer = React.lazy(() => import('./XAIToMLGWLinesLayer'));
const MemphisColossusChangeLayer = React.lazy(() => import('./MemphisColossusChangeLayer'));
const MemphisColossusTopParcelsLayer = React.lazy(() => import('./MemphisColossusTopParcelsLayer'));
const ColossusPermitsLayer = React.lazy(() => import('./ColossusPermitsLayer'));
const ColossusPermitsReviewQueueLayer = React.lazy(() => import('./ColossusPermitsReviewQueueLayer'));
const MemphisPermitsHeatmapLayer = React.lazy(() => import('./MemphisPermitsHeatmapLayer'));
const CouncilSignalsColossusLayer = React.lazy(() => import('./CouncilSignalsColossusLayer'));
const ColossusPowerSignalsLayer = React.lazy(() => import('./ColossusPowerSignalsLayer'));
const DesotoPermitsLayer = React.lazy(() => import('./DesotoPermitsLayer'));
const DesotoPermitsReviewQueueLayer = React.lazy(() => import('./DesotoPermitsReviewQueueLayer'));
const DesotoStatelineParcelLayer = React.lazy(() => import('./DesotoStatelineParcelLayer'));

const LayerToggle = forwardRef(({
  map,
  mapTheme,
  isLayerMenuCollapsed,
  setIsLayerMenuCollapsed,
  showTransportation,
  setShowTransportation,
  showRoads,
  setShowRoads,
  showMainRoads,
  setShowMainRoads,
  showParks = false,
  setShowParks,
  showFortStocktonRadius,
  setShowFortStocktonRadius,
  showAdaptiveReuse,
  setShowAdaptiveReuse,
  showDevelopmentPotential,
  setShowDevelopmentPotential,
  showHIFLDTransmission,
  setShowHIFLDTransmission,
  showREIT,
  setShowREIT,
  showERCOTGISReports,
  setShowERCOTGISReports,
  showProducerConsumerCounties,
  setShowProducerConsumerCounties,
  showSpatialMismatchCounties,
  setShowSpatialMismatchCounties,
  showRoadParticles,
  setShowRoadParticles,
  showMemphisCounties,
  setShowMemphisCounties,
  showMemphisAIExpansion,
  setShowMemphisAIExpansion,
  showMLGW2026,
  setShowMLGW2026,
  showXAISitesPublic,
  setShowXAISitesPublic,
  showXAIToMLGW,
  setShowXAIToMLGW,
  showMemphisColossusChange,
  setShowMemphisColossusChange,
  showMemphisColossusTopParcels,
  setShowMemphisColossusTopParcels,
  showColossusPermits,
  setShowColossusPermits,
  showColossusPermitsReviewQueue,
  setShowColossusPermitsReviewQueue,
  showMemphisPermitsHeatmap,
  setShowMemphisPermitsHeatmap,
  showCouncilSignalsColossus,
  setShowCouncilSignalsColossus,
  showColossusPowerSignals,
  setShowColossusPowerSignals,
  showDesotoPermits,
  setShowDesotoPermits,
  showDesotoPermitsReviewQueue,
  setShowDesotoPermitsReviewQueue,
  showDesotoStatelineParcel,
  setShowDesotoStatelineParcel,
  onTransmissionLayerStateUpdate
}, ref) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [neighborhoodMarkers, setNeighborhoodMarkers] = useState(null);
  const [isSceneSidebarOpen, setIsSceneSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const prevLayersRef = React.useRef(null);
  useEffect(() => {
    const current = {
      roads: showMainRoads, hifld: showHIFLDTransmission,
      reit: showREIT, ercotGIS: showERCOTGISReports,
      producerConsumer: showProducerConsumerCounties, spatialMismatch: showSpatialMismatchCounties,
      flow: !!showRoadParticles,
    };
    const prev = prevLayersRef.current;
    if (prev) {
      for (const [layer, enabled] of Object.entries(current)) {
        if (prev[layer] !== undefined && prev[layer] !== enabled) {
          logEvent('layer_toggled', { layer, enabled }, 'layer_toggle');
        }
      }
    }
    prevLayersRef.current = current;
  }, [showMainRoads, showHIFLDTransmission, showREIT,
      showERCOTGISReports, showProducerConsumerCounties,
      showSpatialMismatchCounties, showRoadParticles]);

  useEffect(() => {
    if (!onTransmissionLayerStateUpdate) return;
    const timeoutId = setTimeout(() => {
      onTransmissionLayerStateUpdate({
        showTransportation,
        showRoads,
        showParks,
        showFortStocktonRadius,
        showAdaptiveReuse,
        showDevelopmentPotential,
        showHIFLDTransmission,
        showREIT,
        showERCOTGISReports,
        showProducerConsumerCounties,
        showSpatialMismatchCounties,
        showMainRoads,
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [
    showTransportation,
    showRoads,
    showParks,
    showFortStocktonRadius,
    showAdaptiveReuse,
    showDevelopmentPotential,
    showHIFLDTransmission,
    showREIT,
    showERCOTGISReports,
    showProducerConsumerCounties,
    showSpatialMismatchCounties,
    showMainRoads,
    onTransmissionLayerStateUpdate
  ]);

  useEffect(() => {
    if (!map?.current) return;
    setMainRoadsEmphasis(map.current, showMainRoads);
  }, [map, showMainRoads]);

  useImperativeHandle(ref, () => ({
    updateLayerStates: (newStates) => {
      try {
        if (newStates.showTransportation !== undefined) setShowTransportation(newStates.showTransportation);
        if (newStates.showRoads !== undefined) setShowRoads(newStates.showRoads);
        if (newStates.showParks !== undefined) setShowParks(newStates.showParks);
        if (newStates.showFortStocktonRadius !== undefined) setShowFortStocktonRadius(newStates.showFortStocktonRadius);
        if (newStates.showAdaptiveReuse !== undefined) setShowAdaptiveReuse(newStates.showAdaptiveReuse);
        if (newStates.showDevelopmentPotential !== undefined) setShowDevelopmentPotential(newStates.showDevelopmentPotential);
        if (newStates.showHIFLDTransmission !== undefined) setShowHIFLDTransmission(newStates.showHIFLDTransmission);
        if (newStates.showREIT !== undefined) setShowREIT(newStates.showREIT);
        if (newStates.showERCOTGISReports !== undefined) setShowERCOTGISReports(newStates.showERCOTGISReports);
        if (newStates.showProducerConsumerCounties !== undefined) setShowProducerConsumerCounties(newStates.showProducerConsumerCounties);
        if (newStates.showSpatialMismatchCounties !== undefined) setShowSpatialMismatchCounties(newStates.showSpatialMismatchCounties);
        if (newStates.showMainRoads !== undefined) setShowMainRoads(newStates.showMainRoads);
      } catch (error) {
        console.error('Error restoring layer states:', error);
      }
    }
  }), [
    setShowTransportation,
    setShowRoads,
    setShowParks,
    setShowFortStocktonRadius,
    setShowAdaptiveReuse,
    setShowDevelopmentPotential,
    setShowHIFLDTransmission,
    setShowREIT,
    setShowERCOTGISReports,
    setShowProducerConsumerCounties,
    setShowSpatialMismatchCounties,
    setShowMainRoads
  ]);

  return (
    <Suspense fallback={null}>
      <LayerToggleContainer $isCollapsed={isLayerMenuCollapsed}>
        <LayerHeader>
          <Title>{isMobile ? 'Tools' : 'Map Layers'}</Title>
          <CollapseButton
            onClick={() => setIsLayerMenuCollapsed(!isLayerMenuCollapsed)}
            $isCollapsed={isLayerMenuCollapsed}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41z"/>
            </svg>
          </CollapseButton>
        </LayerHeader>

        <CategorySection>
          <CategoryHeader
            onClick={() => setIsSceneSidebarOpen(true)}
            style={{ background: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
          >
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h-4.5m-9 0H5a2 2 0 01-2-2V7a2 2 0 012-2h1.5m9 0h4.5a2 2 0 012 2v.5M9 7h1m5 0h1M9 11h1m5 0h1M9 15h1m5 0h1M9 19h1m5 0h1" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Saved Scenes</CategoryTitle>
            <div style={{ marginLeft: 'auto' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </CategoryHeader>
        </CategorySection>

        <CategorySection>
          <CategoryHeader onClick={() => setShowMainRoads(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Roads</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={showMainRoads}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMainRoads(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>

        {setShowRoadParticles && (
          <CategorySection>
            <CategoryHeader onClick={() => setShowRoadParticles(v => !v)} style={{ cursor: 'pointer' }}>
              <CategoryIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </CategoryIcon>
              <CategoryTitle>Flow</CategoryTitle>
              <ToggleSwitch>
                <input
                  type="checkbox"
                  checked={!!showRoadParticles}
                  onClick={e => e.stopPropagation()}
                  onChange={() => setShowRoadParticles(v => !v)}
                />
                <span></span>
              </ToggleSwitch>
            </CategoryHeader>
          </CategorySection>
        )}

        <CategorySection>
          <CategoryHeader onClick={() => setShowHIFLDTransmission(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>US Power Grid (HIFLD)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showHIFLDTransmission}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowHIFLDTransmission(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <HIFLDTransmissionLayer map={map} visible={!!showHIFLDTransmission} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowERCOTGISReports(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>ERCOT GIS Reports</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showERCOTGISReports}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowERCOTGISReports(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <ERCOTGISReportsLayer map={map} visible={!!showERCOTGISReports} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowProducerConsumerCounties(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Producer/Consumer Counties</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showProducerConsumerCounties}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowProducerConsumerCounties(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <ProducerConsumerCountiesLayer map={map} visible={!!showProducerConsumerCounties} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowSpatialMismatchCounties(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 12h18M9 5l6 6-6 6" />
                <path d="M15 5l6 6-6 6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Spatial Mismatch</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showSpatialMismatchCounties}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowSpatialMismatchCounties(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <SpatialMismatchCountiesLayer map={map} visible={!!showSpatialMismatchCounties} />

        {showSpatialMismatchCounties && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            margin: '0 8px 8px 8px',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#E5E7EB' }}>
              Spatial Mismatch
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '14px', height: '14px', backgroundColor: '#22c55e', borderRadius: '3px' }} />
                <span style={{ color: '#D1D5DB' }}>Producer — West Texas wind farms (high capacity, no data centers)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '14px', height: '14px', backgroundColor: '#ef4444', borderRadius: '3px' }} />
                <span style={{ color: '#D1D5DB' }}>Consumer — DFW/Austin metros (data centers, imports power)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '14px', height: '14px', backgroundColor: '#a855f7', borderRadius: '3px' }} />
                <span style={{ color: '#D1D5DB' }}>Hybrid — both generation and data centers</span>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: 1.4 }}>
              Spatial mismatch between generation sources and data center demand across Texas counties.
            </div>
          </div>
        )}

        <CategorySection>
          <CategoryHeader onClick={() => setShowREIT(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>REIT Properties</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showREIT}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowREIT(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <REITLayer map={map} visible={!!showREIT} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowMemphisCounties(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 3h18v18H3z" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
                <path d="M15 21V9" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis Counties</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMemphisCounties}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMemphisCounties(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MemphisCountiesLayer map={map} visible={!!showMemphisCounties} />

        <CategorySection>
          <CategoryHeader
            onClick={() => setShowMemphisAIExpansion(v => !v)}
            style={{ cursor: 'pointer', background: 'rgba(0, 255, 0, 0.1)' }}
          >
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 3v18m0-18c-3.314 0-6-2.686-6-6h12c0 3.314-2.686 6-6 6zm0 0c3.314 0 6 2.686 6 6h-12c0-3.314 2.686-6 6-6z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </CategoryIcon>
            <CategoryTitle>AI Power Expansion</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMemphisAIExpansion}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMemphisAIExpansion(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MemphisAIExpansionLayer map={map} visible={!!showMemphisAIExpansion} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowMLGW2026(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>MLGW FY2026 Substation Work</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMLGW2026}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMLGW2026(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MLGW2026SubstationLayer map={map} visible={!!showMLGW2026} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowXAISitesPublic(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>xAI Sites (Public)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showXAISitesPublic}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowXAISitesPublic(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <XAISitesPublicLayer map={map} visible={!!showXAISitesPublic} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowXAIToMLGW(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>xAI → Nearest MLGW Substation</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showXAIToMLGW}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowXAIToMLGW(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <XAIToMLGWLinesLayer map={map} visible={!!showXAIToMLGW} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowMemphisColossusChange(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 6h18M3 12h18M3 18h18" />
                <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis Colossus Change (2023→2024)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMemphisColossusChange}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMemphisColossusChange(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MemphisColossusChangeLayer map={map} visible={!!showMemphisColossusChange} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowMemphisColossusTopParcels(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 6h18M3 12h18M3 18h18" />
                <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis Colossus top parcels (Shelby)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMemphisColossusTopParcels}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMemphisColossusTopParcels(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MemphisColossusTopParcelsLayer map={map} visible={!!showMemphisColossusTopParcels} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowColossusPermits(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis/DPD permits (5km Colossus, Shelby side only)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showColossusPermits}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowColossusPermits(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <ColossusPermitsLayer map={map} visible={!!showColossusPermits} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowColossusPermitsReviewQueue(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8" />
                <path d="M8 12h8" />
                <path d="M8 16h6" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis permits review queue (Vertex v1)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showColossusPermitsReviewQueue}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowColossusPermitsReviewQueue(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <ColossusPermitsReviewQueueLayer map={map} visible={!!showColossusPermitsReviewQueue} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowMemphisPermitsHeatmap(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Memphis + DeSoto permits heatmap (Colossus 5km)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showMemphisPermitsHeatmap}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowMemphisPermitsHeatmap(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <MemphisPermitsHeatmapLayer map={map} visible={!!showMemphisPermitsHeatmap} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowCouncilSignalsColossus(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Council signals (Colossus geocoded)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showCouncilSignalsColossus}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowCouncilSignalsColossus(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <CouncilSignalsColossusLayer map={map} visible={!!showCouncilSignalsColossus} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowColossusPowerSignals(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>Colossus power signals (Aug 2025–Feb 2026)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showColossusPowerSignals}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowColossusPowerSignals(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <ColossusPowerSignalsLayer map={map} visible={!!showColossusPowerSignals} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowDesotoPermits(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>DeSoto/Southaven permits (5km Colossus, MS side)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showDesotoPermits}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowDesotoPermits(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <DesotoPermitsLayer map={map} visible={!!showDesotoPermits} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowDesotoPermitsReviewQueue(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8" />
                <path d="M8 12h8" />
                <path d="M8 16h6" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>DeSoto permits review queue (Vertex v4)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showDesotoPermitsReviewQueue}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowDesotoPermitsReviewQueue(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <DesotoPermitsReviewQueueLayer map={map} visible={!!showDesotoPermitsReviewQueue} />

        <CategorySection>
          <CategoryHeader onClick={() => setShowDesotoStatelineParcel(v => !v)} style={{ cursor: 'pointer' }}>
            <CategoryIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 6h18M3 12h18M3 18h18" />
                <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" />
              </svg>
            </CategoryIcon>
            <CategoryTitle>DeSoto Stateline parcel (2400 Stateline Rd W)</CategoryTitle>
            <ToggleSwitch>
              <input
                type="checkbox"
                checked={!!showDesotoStatelineParcel}
                onClick={e => e.stopPropagation()}
                onChange={() => setShowDesotoStatelineParcel(v => !v)}
              />
              <span></span>
            </ToggleSwitch>
          </CategoryHeader>
        </CategorySection>
        <DesotoStatelineParcelLayer map={map} visible={!!showDesotoStatelineParcel} />

      </LayerToggleContainer>

      {!isMobile && (
        <ExpandButton
          onClick={() => setIsLayerMenuCollapsed(false)}
          $isCollapsed={isLayerMenuCollapsed}
          title="Expand layer menu"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41z"/>
          </svg>
        </ExpandButton>
      )}

      <SceneManager
        map={map?.current}
        layerStates={{
          showRoads,
          showParks,
          showHIFLDTransmission,
          showERCOTGISReports,
          showProducerConsumerCounties,
          showSpatialMismatchCounties,
          showREIT,
        }}
        onLoadScene={(sceneLayerStates) => {
          if (sceneLayerStates.showRoads !== undefined) setShowRoads(sceneLayerStates.showRoads);
          if (sceneLayerStates.showParks !== undefined) setShowParks(sceneLayerStates.showParks);
          if (sceneLayerStates.showHIFLDTransmission !== undefined) setShowHIFLDTransmission(sceneLayerStates.showHIFLDTransmission);
          if (sceneLayerStates.showERCOTGISReports !== undefined) setShowERCOTGISReports(sceneLayerStates.showERCOTGISReports);
          if (sceneLayerStates.showProducerConsumerCounties !== undefined) setShowProducerConsumerCounties(sceneLayerStates.showProducerConsumerCounties);
          if (sceneLayerStates.showSpatialMismatchCounties !== undefined) setShowSpatialMismatchCounties(sceneLayerStates.showSpatialMismatchCounties);
          if (sceneLayerStates.showREIT !== undefined) setShowREIT(sceneLayerStates.showREIT);
        }}
        isOpen={isSceneSidebarOpen}
        onClose={() => setIsSceneSidebarOpen(false)}
      />

      {selectedNeighborhood && neighborhoodMarkers && (
        <NeighborhoodPopup
          selectedNeighborhood={selectedNeighborhood}
          neighborhoodMarkers={neighborhoodMarkers}
          onClose={() => {
            setSelectedNeighborhood(null);
            setNeighborhoodMarkers(null);
          }}
        />
      )}
    </Suspense>
  );
});

export default LayerToggle;
