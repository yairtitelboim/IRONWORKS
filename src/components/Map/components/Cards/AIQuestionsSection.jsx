import React, { useState, useEffect, useRef } from 'react';
import AskAnythingInput from './AskAnythingInput';
import AIResponseDisplay from './AIResponseDisplayRefactored';
import CategoryToggle from './CategoryToggle';
import CategoryToggleSkeleton from './CategoryToggleSkeleton';
import LoadingCard from './LoadingCard';
import GeoAIChangeSummaryCard from './GeoAIChangeSummaryCard';
import { getLocationDisplayName } from '../../../../config/geographicConfig.js';
import { formatTexasDataCenterForCard } from '../TexasDataCentersLayer';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../../constants';
import {
  buildLocationSearchMetadataFromCountySelection,
  formatLocationSearchResponseContent
} from '../../../../utils/locationSearchMetadata';

const AIQuestionsSection = ({ 
  aiState, 
  hasShimmered, 
  handleAIQuery, 
  createClickableTruncation, 
  setAiState, 
  map, 
  isOSMButtonLoading,
  toggleFollowupContent,
  toolFeedback,
  handleMarkerClick,
  handleBackToAnalysis,
  // New props for dual analysis view mode
  viewMode = 'node', // Default to NODE for table display
  onViewModeChange = null,
  selectedMarker = null,
  // Animation props
  nodeAnimation = null,
  responseReadyAnimation = false,
  // Location props
  currentLocation = 'default',
  // Perplexity mode props
  isPerplexityMode = false,
  onPerplexityModeToggle = null,
  siteAnimationsActive = false,
  availableAnimations = [],
  onAnimationSelect = null,
  lakeShoreStats = null,
  // MCP search results
  addResponse = null,
  onLocationFlyTo = null
}) => {
  // State for category filtering
  const [filteredResponses, setFilteredResponses] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});
  // NEW: State for table data (Phase 1)
  const [tableData, setTableData] = useState({});
  
  // State for location indicator visibility
  const [showLocationIndicator, setShowLocationIndicator] = useState(true);
  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const responseCardWidth = isMobile ? '340px' : '320px';
  const responseCardRef = useRef(null);

  // On mobile: scroll response card into view when marker response appears (match position of address search flow)
  useEffect(() => {
    if (!isMobile || !aiState.responses?.length) return;
    const latest = aiState.responses[aiState.responses.length - 1];
    const meta = latest?.metadata || {};
    if (meta.responseType !== 'texas_data_center_detail') return;
    const t = setTimeout(() => {
      responseCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(t);
  }, [isMobile, aiState.responses?.length, aiState.responses]);

  // Listen for Texas Data Center marker clicks and show them in the AI response card.
  useEffect(() => {
    if (!window.mapEventBus || !addResponse) return;
    const handleTexasDCShowInCard = (data) => {
      const props = data?.properties;
      if (!props) return;
      const content = formatTexasDataCenterForCard(props);
      addResponse({
        response: content,
        content,
        query: `Texas Data Center: ${props.project_name || 'Project'}`,
        citations: [],
        isLoading: false,
        metadata: {
          responseType: 'texas_data_center_detail',
          source: 'texas-data-centers',
          projectId: props.project_id,
          properties: props,
          coordinates: data?.coordinates,
          timestamp: Date.now()
        }
      });
    };
    const unsubscribe = window.mapEventBus.on('texas-data-center:showInCard', handleTexasDCShowInCard);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [addResponse]);

  // Listen for ERCOT County selection and show county data in response card
  useEffect(() => {
    if (!window.mapEventBus || !addResponse) return;
    const handleERCOTCountySelected = (data) => {
      const props = data?.properties;
      if (!props) return;
      const metadata = buildLocationSearchMetadataFromCountySelection({
        properties: props,
        geometry: data?.geometry,
        source: 'ercot-counties',
        query: `ERCOT County: ${props.NAME || props.name || 'County'}`,
        txPrecomputedType: 'tx_county_detail',
        timestamp: Date.now()
      });
      const content = formatLocationSearchResponseContent(
        metadata.coordinates,
        `${props.NAME || props.name || 'Texas County'} County`
      );
      addResponse({
        response: content,
        content,
        query: metadata.query,
        citations: [],
        isLoading: false,
        metadata: {
          ...metadata,
          countyId: data?.countyId,
          countyName: data?.countyName,
          properties: props,
          geometry: data?.geometry
        }
      });
    };
    const unsubscribe = window.mapEventBus.on('ercot-county:map-selected', handleERCOTCountySelected);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [addResponse]);

  // Check if any response is a GeoAI response
  const isGeoAIResponse = aiState.responses?.some(response => ['geoai_change_summary', 'geoai_shoreline_summary'].includes(response.metadata?.responseType));

  // Auto-close location indicator after 3 seconds
  useEffect(() => {
    if (currentLocation) {
      setShowLocationIndicator(true);
      const timer = setTimeout(() => {
        setShowLocationIndicator(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [currentLocation]);

  // Listen for MCP search results and add them to responses
  useEffect(() => {
    if (!window.mapEventBus || !addResponse) return;

    const handleMCPResults = (data) => {
      // Get current response count to determine index (before adding)
      const currentIndex = (aiState.responses || []).length;
      
      // Add MCP search result as a new response
      const newResponse = {
        response: data.response,
        content: data.response,
        query: data.query,
        citations: data.citations || [],
        isLoading: false,
        metadata: {
          responseType: 'mcp_infrastructure_search',
          source: 'mcp',
          timestamp: data.timestamp,
          query: data.query, // Store query in metadata for power/water detection
          perplexityAnswer: data.perplexityAnswer || null, // Store Perplexity answer
          perplexityCitations: data.perplexityCitations || data.citations || [], // Store Perplexity citations
          features: data.features || [] // Store features for clickable functionality
        },
        tableData: data.tableData || null // Store tableData in the response itself
      };

      // Add to responses using addResponse function
      addResponse(newResponse);
      
      // Use setTimeout to ensure state has updated
      setTimeout(() => {
        // Set table data and category immediately (using current index - will be the new response)
        const newIndex = currentIndex; // This will be the index of the newly added response
        
        setTableData(prev => {
          const updated = {
            ...prev,
            [newIndex]: data.tableData
          };
          return updated;
        });
        
        // Set category to 'all' for MCP results
        setSelectedCategories(prev => ({
          ...prev,
          [newIndex]: 'all'
        }));
      }, 100);
    };

    const unsubscribe = window.mapEventBus.on('mcp:displayResults', handleMCPResults);
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [aiState.responses, addResponse]);

  // Handle category change for filtering Perplexity responses (Updated for Phase 1)
  const handleCategoryChange = (responseIndex, categoryId, filteredContent, tableData = null) => {
    setSelectedCategories(prev => ({
      ...prev,
      [responseIndex]: categoryId
    }));
    
    setFilteredResponses(prev => ({
      ...prev,
      [responseIndex]: filteredContent
    }));

    // NEW: Store table data (including null to clear it)
    setTableData(prev => ({
      ...prev,
      [responseIndex]: tableData
    }));
  };
  // Location-aware initial questions - always available
  const getLocationAwareQuestions = () => {
    return {
      initial: [
        {
          id: 'largest_tx_data_center_cluster',
          text: 'Largest Data Center Cluster in Texas',
          query: 'Identify the largest data center cluster in Texas right now. Include the metro/area name, why it is the largest, current concentration indicators, and the top infrastructure factors sustaining that cluster.'
        },
        {
          id: 'tx_opposition_hotspot',
          text: 'Area With the Most Opposition Forming',
          query: 'Find the Texas area where opposition to new data center growth appears to be forming fastest. Summarize the strongest opposition signals, what is driving them, and how that could affect permitting and delivery timelines.'
        },
        {
          id: 'best_tx_low_risk_corridor',
          text: 'Best Low-Risk Expansion Corridor in Texas',
          query: 'Recommend the best low-risk corridor in Texas for near-term data center expansion. Balance power availability, queue friction, land readiness, and local opposition risk, then provide a ranked top-3 with brief rationale for each.'
        }
      ],
      followup: []
    };
  };

  // Initialize with location-aware questions
  const [executiveQuestions, setExecutiveQuestions] = useState(() => 
    getLocationAwareQuestions()
  );

  // Update questions when location changes
  useEffect(() => {
    setExecutiveQuestions(getLocationAwareQuestions());
  }, [currentLocation]);
  
  // State to control Quick Questions panel visibility
  const [isQuickQuestionsOpen, setIsQuickQuestionsOpen] = useState(false);
  // State to track when a question is being processed (prevents animations)
  const [isProcessingQuestion, setIsProcessingQuestion] = useState(false);
  // State to control suggestions visibility in response view
  const [showSuggestionsInResponse, setShowSuggestionsInResponse] = useState(false);
  // State to control AskAnythingInput visibility during loading
  const [showAskAnythingInput, setShowAskAnythingInput] = useState(true);

  // Generate dynamic follow-up questions based on Claude's response
  const generateFollowupQuestions = (responseContent) => {
    if (!responseContent) return [];
    
    const followupQuestions = [];
    const content = responseContent.toLowerCase();

    if (
      content.includes('transmission') ||
      content.includes('substation') ||
      content.includes('voltage') ||
      content.includes('capacity')
    ) {
      followupQuestions.push({
        id: 'constraint_bottleneck_drilldown',
        text: 'Top Grid Bottlenecks',
        query: 'Rank the top power bottlenecks for this site and explain which one is most likely to block energization first (substation loading, transmission congestion, or transformer limits).'
      });
    }

    if (
      content.includes('interconnection') ||
      content.includes('queue') ||
      content.includes('upgrade') ||
      content.includes('delay')
    ) {
      followupQuestions.push({
        id: 'interconnection_timeline_drilldown',
        text: 'Interconnection Timeline Breakdown',
        query: 'Break interconnection into phases (study, approvals, engineering, construction, energization) and estimate likely timeline risk by phase for this address.'
      });
    }

    if (
      content.includes('cost') ||
      content.includes('capex') ||
      content.includes('upgrade') ||
      content.includes('budget')
    ) {
      followupQuestions.push({
        id: 'upgrade_cost_ranges',
        text: 'Upgrade Cost Ranges',
        query: 'Provide rough cost ranges for likely grid upgrades near this site (substation expansion, new line tap, transformer upgrades), with low/medium/high scenarios.'
      });
    }
    
    // If no specific topics detected, provide core power-constraint follow-ups
    if (followupQuestions.length === 0) {
      followupQuestions.push(
        {
          id: 'alternative_sites_nearby',
          text: 'Nearby Alternative Sites',
          query: 'Suggest 2-3 nearby alternative areas with lower power delivery risk and explain why they are better from a transmission/substation perspective.'
        },
        {
          id: 'load_phasing_plan',
          text: 'Phased Load Ramp Plan',
          query: 'Recommend a phased power ramp strategy for this site (initial load, expansion milestones, backup strategy) to reduce interconnection and reliability risk.'
        },
        {
          id: 'utility_engagement_checklist',
          text: 'Utility Engagement Checklist',
          query: 'Create a utility engagement checklist for this address: what data to request, what studies to ask for, and what red flags to validate before committing to site acquisition.'
        }
      );
    }
    
    return followupQuestions.slice(0, 3); // Limit to 3 follow-up questions
  };

  // Generate follow-up questions when a new response is received
  useEffect(() => {
    if (aiState.responses && aiState.responses.length > 0) {
      const latestResponse = aiState.responses[aiState.responses.length - 1];
      if (latestResponse && latestResponse.content && !latestResponse.isLoading) {
        const dynamicFollowups = generateFollowupQuestions(latestResponse.content);
        setExecutiveQuestions(prev => ({
          ...prev,
          followup: dynamicFollowups
        }));

        
        // Automatically show follow-up questions when they're generated
        if (dynamicFollowups.length > 0) {
          setAiState('showFollowupButtons', true);
          setAiState('showFollowupContent', true);
        }
      }
    }
  }, [aiState.responses, setAiState]);

  // Reset processing state when suggestions panel is opened
  useEffect(() => {
    if (isQuickQuestionsOpen) {
      setIsProcessingQuestion(false);
    }
  }, [isQuickQuestionsOpen]);

  // Close suggestions panel when responses are loaded or when loading starts
  useEffect(() => {
    if (aiState.responses && aiState.responses.length > 0) {
      setIsQuickQuestionsOpen(false);
      setIsProcessingQuestion(false);
      // Keep suggestions hidden by default - user can toggle them on if needed
      // setShowSuggestionsInResponse(true); // Removed - suggestions stay hidden by default
    }
  }, [aiState.responses]);

  // Also close suggestions when loading starts
  useEffect(() => {
    if (aiState.isLoading) {
      setIsQuickQuestionsOpen(false);
      setIsProcessingQuestion(false);
    }
  }, [aiState.isLoading]);

  // Hide AskAnythingInput when loading starts, show when loading stops
  useEffect(() => {
    if (aiState.isLoading) {
      setShowAskAnythingInput(false);
    } else {
      // Always show search bar when not loading (unless OSM is loading)
      if (!isOSMButtonLoading) {
        setShowAskAnythingInput(true);
      }
    }
  }, [aiState.isLoading, isOSMButtonLoading]);
  
  // Also show search bar when OSM loading stops
  useEffect(() => {
    if (!isOSMButtonLoading) {
      setShowAskAnythingInput(true);
    }
  }, [isOSMButtonLoading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = event.target.closest('[data-ai-provider-dropdown]');
      if (!dropdown) {
        setAiState('aiProviderDropdownOpen', false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [aiState.aiProviderDropdownOpen, setAiState]);

  // Add CSS animation for staggered card appearance
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const slideInStyles = `
        @keyframes slideInFromTop {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      const styleElement = document.createElement('style');
      styleElement.textContent = slideInStyles;
      if (!document.head.querySelector('style[data-slide-in-top-animations]')) {
        styleElement.setAttribute('data-slide-in-top-animations', 'true');
        document.head.appendChild(styleElement);
      }
    }
  }, []);


  // Perplexity Mode UI - Show only the AskAnythingInput without background card
  if (isPerplexityMode) {
    // Hide AskAnythingInput during OSM loading
    if (isOSMButtonLoading) {
      return null;
    }
    
    return (
      <AskAnythingInput 
        onSubmit={(question) => {
          // Handle Perplexity-specific query
          console.log('🧠 Perplexity question submitted:', question);
          
          // Create Perplexity-specific query object
          const perplexityQuery = {
            id: 'perplexity_analysis',
            query: question,
            isPerplexityMode: true,
            isCustom: true,
            text: question
          };
          
          // Process with Perplexity analysis instead of regular AI query
          handleAIQuery(perplexityQuery);
        }}
        isLoading={aiState.isLoading}
        disabled={aiState.isLoading}
        onToggleSuggestions={() => {}}
        hasShimmered={hasShimmered}
        isQuickQuestionsOpen={false}
        onCloseSuggestions={() => {}}
        onSetProcessingQuestion={() => {}}
        placeholder="Ask Perplexity AI"
        isPerplexityMode={true}
        disableShimmer={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
      />
    );
  }

  if (aiState.responses && aiState.responses.length > 0) {
  return (
    <div style={{
      width: responseCardWidth,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      alignSelf: 'center'
    }}>
      {/* Location Indicator - Show current location in response view */}
      {currentLocation && showLocationIndicator && (
        <div style={{
          width: responseCardWidth,
          marginBottom: '12px',
          padding: '8px 12px',
          background: 'transparent',
          backdropFilter: 'none',
          border: 'none',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: '600',
          color: currentLocation === 'default' ? '#3b82f6' : '#10b981',
          boxShadow: 'none',
          animation: 'fadeInScale 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards',
          transform: 'translateY(0)',
          opacity: 1
        }}>
          <span style={{ 
            fontSize: '14px',
            color: currentLocation === 'default' ? '#3b82f6' : 'inherit'
          }}>
            {currentLocation === 'default' ? '⌂' : '📍'}
          </span>
          <span>
            {currentLocation === 'default' 
              ? `Home: ${getLocationDisplayName(currentLocation)}`
              : `Analyzing: ${getLocationDisplayName(currentLocation)}`
            }
          </span>
        </div>
      )}
      
      {/* CSS Animation for response ready state */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes responseReadyPulse {
            0%, 100% {
              background: linear-gradient(45deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15));
              box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
            }
            50% {
              background: linear-gradient(45deg, rgba(16, 185, 129, 0.25), rgba(59, 130, 246, 0.25), rgba(16, 185, 129, 0.25));
              box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
            }
          }
          
          @keyframes fadeOut {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-10px) scale(0.95);
            }
          }
        `
      }} />
        {/* Tool Feedback Display - Using LoadingCard component */}
        <LoadingCard 
          toolFeedback={toolFeedback} 
          currentLocation={currentLocation}
          hasActiveAnimations={siteAnimationsActive}
          availableAnimations={availableAnimations}
          onAnimationSelect={onAnimationSelect}
          disableSkeletonAnimation={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
        />
        {/* Spacer: reduced on mobile to bring circles closer to response cards */}
        {isMobile && <div style={{ height: '6px', minHeight: '8px', width: '100%' }} />}
        {/* Display responses based on visibility state */}
        {aiState.responses && aiState.responses.map((responseData, index) => {
          const isLoading = responseData.isLoading || false;
          const responseMeta = responseData.metadata || {};
          const isGeoAIResponse = ['geoai_change_summary', 'geoai_shoreline_summary'].includes(responseMeta.responseType);
          const isMCPResponse = responseMeta.responseType === 'mcp_infrastructure_search' || responseMeta.source === 'mcp';
          
          // Show logic: only show the response selected in the yellow + menu
          const selectedIndex = aiState.selectedResponseIndex ?? aiState.responses.length - 1;
          const shouldShow = index === selectedIndex;
          
          if (!shouldShow) return null;
          

          let baseResponseContent = responseData.response || responseData.content || '';
          if (baseResponseContent.includes('**Analysis Based On:**')) {
            const analysisEndIndex = baseResponseContent.indexOf('\n\n---\n\n**Analysis Based On:**');
            if (analysisEndIndex !== -1) {
              baseResponseContent = baseResponseContent.substring(0, analysisEndIndex);
            }
          }

          const isPerplexityResponse = !isGeoAIResponse &&
            baseResponseContent.length > 2000 &&
            (
              // Startup ecosystem analysis (original condition)
              (baseResponseContent.toLowerCase().includes('node') &&
                (
                  baseResponseContent.toLowerCase().includes('innovation potential') ||
                  baseResponseContent.toLowerCase().includes('funding access') ||
                  baseResponseContent.toLowerCase().includes('talent access') ||
                  baseResponseContent.toLowerCase().includes('startup ecosystem') ||
                  baseResponseContent.toLowerCase().includes('startup analysis')
                )
              ) ||
              // Pinal County agricultural analysis (new condition)
              (
                baseResponseContent.toLowerCase().includes('pinal county') ||
                baseResponseContent.toLowerCase().includes('agricultural change') ||
                baseResponseContent.toLowerCase().includes('agriculture loss') ||
                baseResponseContent.toLowerCase().includes('agriculture gain') ||
                baseResponseContent.toLowerCase().includes('industrial expansion') ||
                baseResponseContent.toLowerCase().includes('water change')
              )
            );

          const isStartupEcosystemAnalysis = !isGeoAIResponse && (
            responseData.id === 'startup_ecosystem_analysis' ||
            baseResponseContent.toLowerCase().includes('startup ecosystem analysis') ||
            baseResponseContent.toLowerCase().includes('innovation potential')
          );

          const shouldShowSkeleton = !isLoading && isStartupEcosystemAnalysis && !isPerplexityResponse && !isGeoAIResponse && !isMCPResponse;
          const shouldShowCategoryToggle = !isLoading && (isPerplexityResponse || isGeoAIResponse);
          // For MCP responses, always use table mode with tableData
          const displayResponse = isMCPResponse ? (responseData.response || responseData.content) : (filteredResponses[index] || responseData.content);
          
          return (
            <div 
              key={index}
              ref={isMobile && responseMeta.responseType === 'texas_data_center_detail' ? responseCardRef : undefined}
              style={{
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(20px)',
                border: viewMode === 'node' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: responseMeta.responseType === 'location_search'
                  ? '10px 12px'
                  : responseMeta.responseType === 'texas_data_center_detail'
                    ? '8px 10px'
                    : '16px',
                paddingBottom: responseMeta.responseType === 'location_search'
                  ? '10px'
                  : responseMeta.responseType === 'texas_data_center_detail'
                    ? '8px'
                    : '16px',
                marginBottom: index === aiState.responses.length - 1 ? '24px' : '12px',
                marginTop: '0px',
                boxShadow: viewMode === 'node' ? '0 0 12px rgba(139, 92, 246, 0.2)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
                width: responseCardWidth,
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              {/* CategoryToggle Component - Show for Perplexity and GeoAI responses */}
              {!isLoading && (
                shouldShowSkeleton ? (
                  <CategoryToggleSkeleton isVisible={true} />
                ) : shouldShowCategoryToggle ? (
                  <div style={{ 
                    position: 'relative', 
                    zIndex: 10,
                    marginTop: '22px', // Reduced gap from top bar
                    marginBottom: '-12px', // Reduced gap to GeoAI response
                    paddingLeft: '16px', // Align with card content, not TopBar
                    paddingRight: '16px', // Ensure it doesn't overflow
                    width: '100%',
                    maxWidth: responseCardWidth, // Match the card width
                    boxSizing: 'border-box',
                    overflow: 'hidden' // Prevent overflow
                  }}>
                    <CategoryToggle
                      perplexityResponse={baseResponseContent}
                      originalClaudeResponse={responseData.content}
                      selectedCategory={selectedCategories[index] || 'text'}
                      onCategoryChange={(categoryId, filteredContent, tableData) =>
                        handleCategoryChange(index, categoryId, filteredContent, tableData)
                      }
                      isVisible={true}
                      viewMode={viewMode}
                      onViewModeChange={onViewModeChange}
                      selectedMarker={selectedMarker}
                      currentLocation={currentLocation}
                    />
                  </div>
                ) : null
              )}

              {/* Response Content */}
              {(
                <div style={{
                  color: '#e5e7eb',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontWeight: '700',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  position: 'relative',
                  paddingTop: '2px'
                }}>
                  {isGeoAIResponse ? (
                    <GeoAIChangeSummaryCard
                      metadata={responseMeta}
                      fallbackStats={responseMeta.responseType === 'geoai_shoreline_summary' ? lakeShoreStats : null}
                      citations={responseData.citations || []}
                      isDimmed={aiState.responseMenuOpen}
                      sourcesExpanded={aiState.sourcesExpanded}
                      onToggleSources={() => setAiState('sourcesExpanded', !aiState.sourcesExpanded)}
                    />
                  ) : (
                    <AIResponseDisplay 
                      response={displayResponse}
                      citations={responseData.citations}
                      maxHeight={300}
                      showTruncation={true}
                      truncationLength={200}
                      onResponseExpandedChange={(expanded) => 
                        setAiState('responseExpanded', expanded)
                      }
                      onSourcesExpandedChange={(expanded) => 
                        setAiState('sourcesExpanded', expanded)
                      }
                      isLoading={responseData.isLoading || false}
                      showCollapseButton={false}
                      isDimmed={aiState.responseMenuOpen}
                      selectedMarker={aiState.selectedMarker}
                      showMarkerDetails={aiState.showMarkerDetails}
                      onBackToAnalysis={handleBackToAnalysis}
                      // Debug logging - force re-render when marker details change
                      key={`response-${index}-${aiState.showMarkerDetails ? 'marker' : 'normal'}-${aiState.selectedMarker?.id || 'none'}`}
                      renderMode={isMCPResponse && (tableData[index] || responseData.tableData) ? 'table' : 'table'}
                      tableData={isMCPResponse ? (tableData[index] || responseData.tableData || null) : (tableData[index] || null)}
                      category={isMCPResponse ? 'all' : (selectedCategories[index] || 'text')}
                      responseMetadata={responseData.metadata || null}
                      onLocationFlyTo={onLocationFlyTo}
                      nodeAnimation={nodeAnimation}
                      onTableRowClick={(node) => {
                        console.log('🎬 Table row clicked:', node);
                      }}
                      onDetailToggle={(nodeId, isExpanded, nodeData) => {
                        console.log('🔍 Detail toggle in parent:', { nodeId, isExpanded, nodeData });
                        if (isExpanded === 'expand') {
                          const actualNodeData = nodeData || responseData?.tableData?.find(node => node.id === nodeId);
                          if (window.mapEventBus) {
                            window.mapEventBus.emit('detail:expand', { 
                              nodeId, 
                              isExpanded, 
                              nodeData: actualNodeData,
                              category: responseData?.category || 'all'
                            });
                          }
                        }
                      }}
                    />
                  )}
                  
                  {/* Sources Display Section - Now INSIDE the response card container */}
                  {aiState.sourcesExpanded && responseData.citations && responseData.citations.length > 0 && (
                    <div style={{
                      width: '100%',
                      marginTop: '8px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}>
                      {/* Sources Header */}
                      <div style={{ 
                        marginBottom: '12px', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        userSelect: 'none',
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.9)'
                      }}>
                        <span>Sources ({responseData.citations.length})</span>
                      </div>
                      
                      {/* Sources Content - Scrollable */}
                      <div 
                        className="sources-scroll"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          animation: 'fadeIn 0.3s ease',
                          marginTop: '8px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          paddingRight: '4px',
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
                          boxSizing: 'border-box'
                        }}
                      >
                        {responseData.citations.map((citation, index) => {
                          const url = typeof citation === 'string' ? citation : citation.url;
                          const title = typeof citation === 'string' ? 
                            (citation.includes('http') ? citation.substring(0, 30) + '...' : citation) : 
                            (citation.title || citation.url?.substring(0, 30) + '...');
                          
                          return (
                            <div key={index} style={{ 
                              width: 'calc(100% - 16px)',
                              maxWidth: '288px',
                              marginBottom: '2px',
                              padding: '8px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              minHeight: '60px',
                              boxSizing: 'border-box'
                            }}>
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ color: '#60a5fa', fontWeight: '600' }}>
                                  [{index + 1}]
                                </span>
                                <span style={{ marginLeft: '6px', fontSize: '11px' }}>
                                  {title || `Source ${index + 1}`}
                                </span>
                              </div>
                              {url && (
                                <div style={{
                                  width: 'calc(100% - 20px)',
                                  maxWidth: '268px',
                                  fontSize: '10px',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  marginLeft: '20px',
                                  marginBottom: '4px',
                                  wordBreak: 'break-all',
                                  lineHeight: '1.3',
                                  boxSizing: 'border-box'
                                }}>
                                  {url}
                                </div>
                              )}
                              {url && (
                                <div style={{ 
                                  width: 'calc(100% - 20px)',
                                  maxWidth: '268px',
                                  marginLeft: '20px',
                                  boxSizing: 'border-box'
                                }}>
                                  <span
                                    style={{
                                      color: '#10b981',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      fontSize: '10px',
                                      fontWeight: '600'
                                    }}
                                    onClick={() => window.open(url, '_blank')}
                                    title={`Open ${url} in new tab`}
                                  >
                                    🔗 Open in New Tab
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            

            </div>
          );
        })}
        
        {/* Show loading state for new response if currently loading */}
        {false && (
          <div style={{
            background: 'rgba(55, 65, 81, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '4px',
            width: responseCardWidth,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <div style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '11px',
              fontWeight: '500',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Loading New Response...
            </div>
            
            <AIResponseDisplay 
              response={null}
              citations={[]}
              maxHeight={300}
              showTruncation={true}
              truncationLength={200}
              onResponseExpandedChange={() => {}}
              onSourcesExpandedChange={() => {}}
              isLoading={true}
              selectedMarker={aiState.selectedMarker}
              showMarkerDetails={aiState.showMarkerDetails}
              onBackToAnalysis={handleBackToAnalysis}
            />
          </div>
        )}


        {/* Toggle Arrow to Show/Hide Suggestions */}
        {!isProcessingQuestion && (
          <div style={{
            width: responseCardWidth,
            display: 'flex',
            justifyContent: 'center',
            marginTop: '-10px',
            marginBottom: showSuggestionsInResponse ? '8px' : '-6px',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowSuggestionsInResponse(!showSuggestionsInResponse)}
              style={{
                background: 'rgba(55, 65, 81, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(55, 65, 81, 0.95)';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(55, 65, 81, 0.9)';
                e.target.style.transform = 'scale(1)';
              }}
              title={showSuggestionsInResponse ? "Hide suggestions" : "Show suggestions"}
            >
              {showSuggestionsInResponse ? '▲' : '▼'}
            </button>
          </div>
        )}

        {/* Suggestions Section - Show after main response loads */}
        {!isProcessingQuestion && showSuggestionsInResponse && (
          <div style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            animation: 'fadeIn 0.3s ease-in-out',
            opacity: 1,
            transition: 'opacity 0.3s ease-in-out'
          }}>
            {executiveQuestions.initial.map((question, index) => {
              const isHidden = aiState.selectedCard && aiState.selectedCard !== question.id;
              const isSelected = aiState.selectedCard === question.id;
              
              return (
                <div
                  key={question.id}
                  style={{
                    position: 'relative',
                    marginBottom: '3px',
                    overflow: 'hidden',
                    animation: 'slideInFromTop 0.4s ease-out forwards',
                    animationDelay: `${index * 0.2}s`,
                    opacity: 0,
                    transform: 'translateY(-20px)'
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Set processing state to prevent animations
                      setIsProcessingQuestion(true);
                      // Close suggestions panel immediately when question is clicked
                      setIsQuickQuestionsOpen(false);
                      // Close suggestions in response view immediately
                      setShowSuggestionsInResponse(false);
                      // Hide AskAnythingInput immediately when question is clicked
                      setShowAskAnythingInput(false);
                      // Execute query immediately
                      handleAIQuery(question);
                    }}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(76, 175, 80, 0.15)' : 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(20px)',
                      border: isSelected ? '2px solid rgba(76, 175, 80, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      padding: isHidden ? '0px' : '12px 10px',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'left',
                      boxShadow: isSelected ? '0 6px 20px rgba(76, 175, 80, 0.25)' : '0 4px 16px rgba(0, 0, 0, 0.1)',
                      opacity: isHidden ? 0 : 1,
                      transform: isHidden ? 'scale(0.8) translateY(-10px)' : isSelected ? 'scale(1.02)' : 'scale(1)',
                      pointerEvents: isHidden ? 'none' : 'auto',
                      height: isHidden ? '0px' : 'auto',
                      position: 'relative',
                      overflow: 'hidden',
                      lineHeight: '1.4',
                      marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isHidden && !isSelected) {
                        e.target.style.transform = 'translateY(-2px) scale(1.01)';
                        e.target.style.background = 'rgba(0, 0, 0, 0.6)';
                        e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHidden && !isSelected) {
                        e.target.style.transform = 'translateY(0) scale(1)';
                        e.target.style.background = 'rgba(0, 0, 0, 0.5)';
                        e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                      }
                    }}
                  >
                    {question.text}
                  </button>
                </div>
              );
            })}
            
            {/* Ask Anything Input - Inside Response View Suggestions */}
            {showAskAnythingInput && !isOSMButtonLoading && (
              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <AskAnythingInput 
                  onSubmit={handleAIQuery}
                  isLoading={aiState.isLoading}
                  disabled={aiState.isLoading}
                  onToggleSuggestions={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}
                  hasShimmered={hasShimmered}
                  isQuickQuestionsOpen={isQuickQuestionsOpen}
                  onCloseSuggestions={() => setIsQuickQuestionsOpen(false)}
                  onSetProcessingQuestion={setIsProcessingQuestion}
                  disableShimmer={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (aiState.isLoading) {
    return (
      <div style={{
        width: responseCardWidth,
        background: 'rgba(55, 65, 81, 0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          height: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          marginBottom: '8px',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}></div>
        <div style={{
          height: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          marginBottom: '8px',
          width: '80%',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}></div>
        <div style={{
          height: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          width: '60%',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}></div>
      </div>
    );
  }

  // New Ask Anything Input with Suggestions below
  return (
    <div>
      {/* Ask Anything Input Bar - Only show in initial state (before first query) and when not loading */}
      {!aiState.isLoading && (!aiState.responses || aiState.responses.length === 0) && showAskAnythingInput && !isOSMButtonLoading && (
        <AskAnythingInput 
          onSubmit={handleAIQuery}
          isLoading={aiState.isLoading}
          disabled={aiState.isLoading}
          onToggleSuggestions={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}
          hasShimmered={hasShimmered}
          isQuickQuestionsOpen={isQuickQuestionsOpen}
          onCloseSuggestions={() => setIsQuickQuestionsOpen(false)}
          onSetProcessingQuestion={setIsProcessingQuestion}
          disableShimmer={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
        />
      )}
      
      {/* Subtle Divider */}
      <div style={{
        width: '100%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
        margin: '4px 0 4px 0'
      }} />
      
      {/* Tool Feedback Display - Using LoadingCard component */}
      <LoadingCard 
        toolFeedback={toolFeedback}
        currentLocation={currentLocation}
        hasActiveAnimations={siteAnimationsActive}
        availableAnimations={availableAnimations}
        onAnimationSelect={onAnimationSelect}
        disableSkeletonAnimation={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
      />
      
      {/* Location Indicator - Show current location (only for initial state) */}
      {!aiState.isLoading && (!aiState.responses || aiState.responses.length === 0) && currentLocation && showLocationIndicator && (
        <div style={{
          width: responseCardWidth,
          marginTop: '2px',
          marginBottom: '2px',
          padding: '2px 12px',
          background: 'transparent',
          backdropFilter: 'none',
          border: 'none',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: '600',
          color: currentLocation === 'default' ? '#3b82f6' : '#10b981',
          boxShadow: 'none',
          animation: 'fadeInScale 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards',
          transform: 'translateY(0)',
          opacity: 1
        }}>
          <span style={{ 
            fontSize: '14px',
            color: currentLocation === 'default' ? '#3b82f6' : 'inherit'
          }}>
            {currentLocation === 'default' ? '⌂' : '📍'}
          </span>
          <span>
            {currentLocation === 'default' 
              ? `Home: ${getLocationDisplayName(currentLocation)}`
              : `Analyzing: ${getLocationDisplayName(currentLocation)}`
            }
          </span>
        </div>
      )}
      
      {/* Suggestions Section */}
      {isQuickQuestionsOpen && !isProcessingQuestion && (
        <div style={{
          marginTop: '24px', // Increased from 12px to create larger gap
          display: 'flex',
          flexDirection: 'column',
          gap: '3px', // Reduced from 4px
          animation: 'fadeIn 0.3s ease-in-out',
          opacity: 1,
          transition: 'opacity 0.3s ease-in-out'
        }}>
          {executiveQuestions.initial.map((question, index) => {
              const isHidden = aiState.selectedCard && aiState.selectedCard !== question.id;
              const isSelected = aiState.selectedCard === question.id;
              
              return (
                <div
                  key={question.id}
                  style={{
                    position: 'relative',
                    marginBottom: '3px', // Reduced from 6px
                    overflow: 'hidden',
                    animation: (isQuickQuestionsOpen && !isProcessingQuestion) ? 'slideInFromTop 0.4s ease-out forwards' : 'none',
                    animationDelay: (isQuickQuestionsOpen && !isProcessingQuestion) ? `${index * 0.2}s` : '0s', // Only stagger when opening and not processing
                    opacity: (isQuickQuestionsOpen && !isProcessingQuestion) ? 0 : 1, // Start invisible only when opening and not processing
                    transform: (isQuickQuestionsOpen && !isProcessingQuestion) ? 'translateY(-20px)' : 'translateY(0)' // Start above only when opening and not processing
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Set processing state to prevent animations
                      setIsProcessingQuestion(true);
                      // Close suggestions panel immediately when question is clicked
                      setIsQuickQuestionsOpen(false);
                      // Close suggestions in response view immediately
                      setShowSuggestionsInResponse(false);
                      // Hide AskAnythingInput immediately when question is clicked
                      setShowAskAnythingInput(false);
                      // Execute query immediately
                      handleAIQuery(question);
                    }}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(76, 175, 80, 0.15)' : 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(20px)',
                      border: isSelected ? '2px solid rgba(76, 175, 80, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px', // Reduced from 12px
                      color: '#ffffff',
                      padding: isHidden ? '0px' : '8px 12px', // Reduced from 12px 16px
                      fontSize: '11px',
                      fontWeight: '400', // Reduced from 500
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'left',
                      boxShadow: isSelected ? '0 6px 20px rgba(76, 175, 80, 0.25)' : '0 3px 12px rgba(0, 0, 0, 0.1)', // Reduced shadows
                      opacity: isHidden ? 0 : 1,
                      transform: isHidden ? 'scale(0.8) translateY(-10px)' : isSelected ? 'scale(1.02)' : 'scale(1)',
                      pointerEvents: isHidden ? 'none' : 'auto',
                      height: isHidden ? '0px' : 'auto',
                      position: 'relative',
                      overflow: 'hidden',
                      lineHeight: '1.3' // Added for better text readability
                    }}
                    onMouseEnter={(e) => {
                      if (!isHidden && !isSelected) {
                        e.target.style.transform = 'translateY(-2px) scale(1.01)';
                        e.target.style.background = 'rgba(0, 0, 0, 0.6)';
                        e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHidden && !isSelected) {
                        e.target.style.transform = 'translateY(0) scale(1)';
                        e.target.style.background = 'rgba(0, 0, 0, 0.5)';
                        e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.08)';
                      }
                    }}
                  >
                    {question.text}
                  </button>
                  
                  {/* Shimmer effect overlay - triggers when suggestions become visible */}
                  {!isHidden && isQuickQuestionsOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                      animation: 'questionCardShimmer 1.5s ease-out forwards',
                      pointerEvents: 'none',
                      borderRadius: '12px'
                    }} />
                  )}
                  

                  
                  {/* OSM Button loading shimmer overlay */}
                  {!isHidden && isOSMButtonLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.08), transparent)',
                      animation: 'buttonShimmer 3s ease-in-out infinite',
                      pointerEvents: 'none',
                      borderRadius: '10px'
                    }} />
                  )}
                  
                  {/* Text glow effect when OSM Button is loading */}
                  {!isHidden && isOSMButtonLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '10px',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }}></div>
                  )}
                </div>
              );
            })}
            
            {/* Ask Anything Input - Inside Suggestions Container (only after first query) */}
            {aiState.responses && aiState.responses.length > 0 && showAskAnythingInput && !isOSMButtonLoading && !isGeoAIResponse && (
              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <AskAnythingInput 
                  onSubmit={handleAIQuery}
                  isLoading={aiState.isLoading}
                  disabled={aiState.isLoading}
                  onToggleSuggestions={() => setIsQuickQuestionsOpen(!isQuickQuestionsOpen)}
                  hasShimmered={hasShimmered}
                  isQuickQuestionsOpen={isQuickQuestionsOpen}
                  onCloseSuggestions={() => setIsQuickQuestionsOpen(false)}
                  onSetProcessingQuestion={setIsProcessingQuestion}
                  disableShimmer={aiState.responses?.some(response => response.metadata?.responseType === 'geoai_change_summary')}
                />
              </div>
            )}
        </div>
      )}


      {/* Follow-up Questions - Show after responses */}
      {aiState.responses && aiState.responses.length > 0 && executiveQuestions.followup.length > 0 && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* Down Arrow to Show Follow-up Content */}
          {!aiState.showFollowupContent && (
            <div style={{
              width: responseCardWidth,
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <button
                onClick={toggleFollowupContent}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = 'rgba(255, 255, 255, 0.9)';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = 'rgba(255, 255, 255, 0.7)';
                  e.target.style.transform = 'scale(1)';
                }}
                title="Click to show follow-up questions"
              >
                <span style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  transform: 'rotate(90deg)'
                }}>
                  ▶
                </span>
              </button>
            </div>
          )}

          {/* Follow-up Questions Buttons */}
          {aiState.showFollowupContent && (
            <div style={{
              opacity: aiState.showFollowupContent ? 1 : 0,
              transform: aiState.showFollowupContent ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {/* Close button for follow-up questions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '8px'
              }}>
                <button
                  onClick={() => setAiState('showFollowupContent', false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease',
                    fontSize: '12px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = 'rgba(255, 255, 255, 0.5)';
                    e.target.style.background = 'transparent';
                  }}
                  title="Hide follow-up questions"
                >
                  ×
                </button>
              </div>
              {executiveQuestions.followup.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => {
                    // Hide AskAnythingInput immediately when follow-up question is clicked
                    setShowAskAnythingInput(false);
                    handleAIQuery(question);
                  }}
                  disabled={aiState.isLoading}
                  style={{
                    width: responseCardWidth,
                    background: 'rgba(255, 255, 255, 0.06)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: aiState.isLoading ? 'not-allowed' : 'pointer',
                    transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`,
                    marginBottom: '6px',
                    textAlign: 'center',
                    opacity: aiState.isLoading ? 0.5 : 1,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(20px)',
                    animation: aiState.showFollowupContent ? 'buttonSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
                    animationDelay: `${index * 0.05}s`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (!aiState.isLoading) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.18)';
                      e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!aiState.isLoading) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  {question.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIQuestionsSection;
