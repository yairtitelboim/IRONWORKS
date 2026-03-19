import React, { useState, useCallback, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  AlertTriangle, 
  Building, 
  BarChart2, 
  Clock, 
  ArrowRight,
  Wand2
} from 'lucide-react';
import { milestoneCategories } from '../mockData';
import styled, { keyframes } from 'styled-components';
import { handleServiceCorridorsQuestion, simulateGraphActionDelay, handleInfrastructureVisualization } from '../../../../services/claude';

// Animation for card click effect
const glimmerEffect = keyframes`
  0% {
    box-shadow: 0 0 0 rgba(255, 255, 255, 0);
    filter: blur(0px) brightness(1);
    transform: scale(1);
  }
  30% {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
    filter: blur(1px) brightness(1.3);
    transform: scale(0.98);
  }
  100% {
    box-shadow: 0 0 0 rgba(255, 255, 255, 0);
    filter: blur(0) brightness(1);
    transform: scale(1);
  }
`;

// Define micro animations for icons
const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
`;

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

const wave = keyframes`
  0% { transform: translateX(0); }
  25% { transform: translateX(2px); }
  75% { transform: translateX(-2px); }
  100% { transform: translateX(0); }
`;

// Styled component for animated icons
const CardIcon = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  width: ${props => props.$size === 'small' ? '24px' : '32px'};
  height: ${props => props.$size === 'small' ? '24px' : '32px'};
  min-width: ${props => props.$size === 'small' ? '24px' : '32px'};
  margin-right: 10px;
  background-color: ${props => props.$bgColor || '#4f46e5'};
  
  svg {
    width: ${props => props.$size === 'small' ? '14px' : '20px'};
    height: ${props => props.$size === 'small' ? '14px' : '20px'};
    stroke: white;
    stroke-width: 2;
  }
  
  /* Animations */
  &.pulse {
    animation: ${pulse} 2s infinite ease-in-out;
  }
  
  &.rotate {
    animation: ${rotate} 4s infinite linear;
  }
  
  &.bounce {
    animation: ${bounce} 1.2s infinite ease-in-out;
  }
  
  &.wave {
    animation: ${wave} 1.3s infinite ease-in-out;
  }
`;

// Styled component for the clickable card
const ClickableCard = styled.div`
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
  
  &.clicked {
    animation: ${glimmerEffect} 0.8s ease-out forwards;
  }
`;

// Create a context for loading state
const LoadingContext = React.createContext({
  setIsLoading: () => {},
});

// Custom function to handle the card click for "Central City Transit Corridors"
const handleTransitCorridorsCardClick = async () => {
  // Get the global functions we need
  const setIsLoading = window.setAIChatPanelLoading;
  const setMessages = window.setAIChatPanelMessages;
  const effectiveMap = window.mapComponent?.map;
  
  if (!setMessages || !setIsLoading) {
    console.error("Required global functions not available");
    return;
  }
  
  try {
    setIsLoading(true);
    
    // Try to load the Zoning scene immediately if it exists
    console.log("Attempting to load Zoning scene from card click");
    if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
      const sceneLoaded = window.mapComponent.loadSceneByName("Zoning");
      console.log("Scene load attempt result:", sceneLoaded);
    }
    
    // Add custom message to indicate we're viewing from card click
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: true,
        content: "View Central City Transit Corridors"
      }
    ]);
    
    // Show loading step
    await simulateGraphActionDelay();
    
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          processingStep: true,
          icon: '💜',
          text: "Loading Central City Transit Corridors visualization..."
        }
      }
    ]);
    
    // Return the response with service corridors data
    setMessages(prevMessages => {
      // First remove all processing step messages
      const withoutProcessingSteps = prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
      
      // Find the most recent user message
      const mostRecentUserMsgIndex = withoutProcessingSteps.findIndex(
        msg => msg.isUser && msg.content === "View Central City Transit Corridors"
      );
      
      return [
        ...withoutProcessingSteps.slice(0, mostRecentUserMsgIndex >= 0 ? mostRecentUserMsgIndex + 1 : withoutProcessingSteps.length),
        { 
          isUser: false, 
          content: {
            preGraphText: "Here's a visualization of the Central City Transit Corridors that could significantly improve connectivity and service access around Skid Row:",
            graphData: window.SERVICE_CORRIDORS_DATA || {}, // Use globally available data if possible
            postGraphText: "These transit corridors would create strategic connections between Skid Row and key areas like Union Station, improving pedestrian mobility and access to services. The implementation would require moderate investment but would yield significant improvements in community connectivity and quality of life."
          } 
        }
      ];
    });
  } catch (error) {
    console.error("Error in handleTransitCorridorsCardClick:", error);
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          preGraphText: "I'm sorry, I encountered an error while displaying the Central City Transit Corridors. Please try again.",
          postGraphText: "You may want to check if all map layers are loaded correctly or try refreshing the page."
        }
      }
    ]);
  } finally {
    setIsLoading(false);
  }
};

// This component handles all the different visualization types
const VisualizationDisplay = ({ visualizationType, data }) => {
  // DEBUG: Log visualization type and data
  console.log("VisualizationDisplay rendering:", { 
    visualizationType, 
    hasData: !!data,
    dataType: data?.type,
    dataKeys: data ? Object.keys(data) : []
  });
  
  // State to track if card is clicked
  const [clickedCard, setClickedCard] = useState(null);
  
  // State for tracking which intervention cards are expanded
  const [expandedCards, setExpandedCards] = useState({});
  
  // Format description to highlight important information like in NeighborhoodSiteCard
  const formatDescriptionText = (text) => {
    if (!text) return null;
    
    // Split the text into parts to highlight
    const parts = [];
    let lastIndex = 0;
    
    // Helper function to determine if a capital word is at sentence beginning
    const isWordAtSentenceStart = (fullText, matchIndex) => {
      // Check if it's at the beginning of the text
      if (matchIndex === 0) return true;
      
      // Look at the characters before the match
      const precedingText = fullText.slice(0, matchIndex).trim();
      const lastChar = precedingText.slice(-1);
      
      // Return true if the last character before the match is a sentence-ending punctuation
      // or if it's preceded only by whitespace (beginning of text)
      return ['', '.', '!', '?', '\n', '\r'].includes(lastChar);
    };

    // Improved regex patterns for highlighting
    const patterns = [
      {
        regex: /\$\d+(\.\d+)?[KMB]?\s*-\s*\$\d+(\.\d+)?[KMB]?/g,  // Price ranges like $4.2M - $6.5M
        filter: () => true
      },
      {
        regex: /\b\d+(\.\d+)?%?\b/g,  // Numbers and percentages
        filter: () => true
      },
      {
        regex: /\b\d+(\.\d+)?-\d+(\.\d+)?%?\b/g,  // Number ranges like 15-20% or 3-5
        filter: () => true
      },
      {
        regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,  // Dates like MM/DD/YYYY
        filter: () => true
      },
      {
        regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(,\s+\d{4})?\b/g,  // Month names
        filter: () => true
      },
      {
        regex: /\b\d{4}\b/g,  // Years
        filter: () => true
      },
      {
        regex: /\b[A-Z][a-z]*(?:[-'][A-Za-z]+)*\b/g,  // Words with capital letters
        // Only highlight capitalized words that are NOT at the beginning of sentences
        filter: (match, index) => !isWordAtSentenceStart(text, match.index)
      }
    ];
    
    // Find all matches from all patterns
    const matches = [];
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex);
      while ((match = regex.exec(text)) !== null) {
        // Only add match if it passes the filter
        if (pattern.filter(match, matches.length)) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
          });
        }
      }
    });
    
    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);
    
    // Filter out overlapping matches
    const filteredMatches = [];
    for (let i = 0; i < matches.length; i++) {
      // Check for overlap with existing matches
      let hasOverlap = false;
      for (let j = 0; j < filteredMatches.length; j++) {
        if (matches[i].start < filteredMatches[j].end && matches[i].end > filteredMatches[j].start) {
          // If current match is longer than existing overlapping match, replace it
          if ((matches[i].end - matches[i].start) > (filteredMatches[j].end - filteredMatches[j].start)) {
            filteredMatches[j] = matches[i];
          }
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) {
        filteredMatches.push(matches[i]);
      }
    }
    
    // Re-sort filtered matches
    filteredMatches.sort((a, b) => a.start - b.start);
    
    // Build the result with highlighted parts
    filteredMatches.forEach(match => {
      if (match.start > lastIndex) {
        parts.push(text.substring(lastIndex, match.start));
      }
      parts.push(<strong key={match.start} className="font-extrabold text-white">{match.text}</strong>);
      lastIndex = match.end;
    });
    
    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return <>{parts}</>;
  };
  
  // Toggle expansion state of a specific card
  const toggleCardExpansion = (cardName, e) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }));
  };
  
  // State for skeleton loading and staggered rendering
  const [isLoading, setIsLoading] = useState(false);
  const [loadedSections, setLoadedSections] = useState({
    header: false,
    metrics: false,
    details: false,
    chart: false,
    actions: false
  });
  
  // Inject CSS for fade-in animation
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeInAnimation {
        from { 
          opacity: 0; 
          transform: translateY(10px);
        }
        to { 
          opacity: 1; 
          transform: translateY(0);
        }
      }

      .fade-in {
        animation: fadeInAnimation 0.5s ease-out forwards;
      }
      
      .fade-in-slow {
        animation: fadeInAnimation 0.8s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Staggered loading effect when a card is clicked
  useEffect(() => {
    if (isLoading) {
      // Header loads first (fastest)
      const headerTimer = setTimeout(() => {
        setLoadedSections(prev => ({ ...prev, header: true }));
      }, 400);
      
      // Metrics load second
      const metricsTimer = setTimeout(() => {
        setLoadedSections(prev => ({ ...prev, metrics: true }));
      }, 800);
      
      // Chart loads third
      const chartTimer = setTimeout(() => {
        setLoadedSections(prev => ({ ...prev, chart: true }));
      }, 1200);
      
      // Details load fourth
      const detailsTimer = setTimeout(() => {
        setLoadedSections(prev => ({ ...prev, details: true }));
      }, 1600);
      
      // Actions load last (slowest)
      const actionsTimer = setTimeout(() => {
        setLoadedSections(prev => ({ ...prev, actions: true }));
        setIsLoading(false); // All sections loaded
      }, 2000);
      
      return () => {
        clearTimeout(headerTimer);
        clearTimeout(metricsTimer);
        clearTimeout(chartTimer);
        clearTimeout(detailsTimer);
        clearTimeout(actionsTimer);
      };
    }
  }, [isLoading]);
  
  // Reset loaded sections when visualization type changes
  useEffect(() => {
    setLoadedSections({
      header: false,
      metrics: false,
      details: false,
      chart: false,
      actions: false
    });
  }, [visualizationType]);
  
  // Make SERVICE_CORRIDORS_DATA available globally
  useEffect(() => {
    // Import the SERVICE_CORRIDORS_DATA and make it globally available
    import('../../../../services/claude').then(claudeService => {
      window.SERVICE_CORRIDORS_DATA = claudeService.SERVICE_CORRIDORS_DATA;
    }).catch(error => {
      console.error("Error importing SERVICE_CORRIDORS_DATA:", error);
    });
  }, []);
  
  // Skeleton loaders for different sections
  const HeaderSkeleton = () => (
    <div className="p-4 border-b border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-gray-700 rounded-full"></div>
        <div className="h-6 bg-gray-700 rounded w-3/4"></div>
      </div>
      <div className="h-4 bg-gray-700 rounded w-full mt-2"></div>
      <div className="h-4 bg-gray-700 rounded w-5/6 mt-2"></div>
    </div>
  );
  
  const MetricsSkeleton = () => (
    <div className="p-4 border-b border-gray-800 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-1/3 mb-3"></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array(6).fill().map((_, idx) => (
          <div key={idx} className="bg-gray-800 p-3 rounded-lg">
            <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const ChartSkeleton = () => (
    <div className="p-4 border-b border-gray-800 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-1/3 mb-3"></div>
      <div className="h-80 bg-gray-800 rounded-lg flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-700" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  );
  
  const DetailsSkeleton = () => (
    <div className="p-4 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-1/3 mb-3"></div>
      <div className="space-y-4">
        {Array(3).fill().map((_, idx) => (
          <div key={idx} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-700 rounded-full mr-2"></div>
                <div className="h-4 bg-gray-700 rounded w-32"></div>
              </div>
              <div className="h-4 bg-gray-700 rounded w-16"></div>
            </div>
            <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-5/6 mb-2"></div>
            <div className="flex flex-wrap gap-2 mt-3">
              <div className="h-3 bg-gray-700 rounded w-16"></div>
              <div className="h-3 bg-gray-700 rounded w-20"></div>
              <div className="h-3 bg-gray-700 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const ActionsSkeleton = () => (
    <div className="p-4 bg-gray-800 animate-pulse">
      <div className="flex flex-wrap gap-2">
        {Array(3).fill().map((_, idx) => (
          <div key={idx} className="h-10 bg-gray-700 rounded-lg w-28"></div>
        ))}
      </div>
    </div>
  );
  
  // Function to handle the click on Central City Transit Corridors
  const handleCardClick = (interventionName) => {
    // Set loading state and reset loaded sections
    setIsLoading(true);
    setLoadedSections({
      header: false,
      metrics: false,
      details: false,
      chart: false,
      actions: false
    });
    
    // Set clicked card for visual feedback
    setClickedCard(interventionName);
    
    // Show a tooltip or notification
    const notification = document.createElement('div');
    notification.textContent = `Loading ${interventionName} visualization...`;
    notification.style.position = "fixed";
    notification.style.bottom = "20px";
    notification.style.left = "50%";
    notification.style.transform = "translateX(-50%)";
    notification.style.backgroundColor = "#4c1d95"; // Purple
    notification.style.color = "white";
    notification.style.padding = "10px 20px";
    notification.style.borderRadius = "4px";
    notification.style.zIndex = "9999";
    notification.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    notification.style.animation = "fadeInOut 2.5s forwards";
    
    // Create a style element for the animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, 20px); }
        15% { opacity: 1; transform: translate(-50%, 0); }
        85% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Remove the notification after animation completes
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 2500);
    
    // Handle Central City Transit Corridors case
    if (interventionName === "Central City Transit Corridors") {
      // Call the custom handler for this card
      handleTransitCorridorsCardClick();
    }
    
    // Handle Infrastructure & Data Centers case
    if (interventionName === "Infrastructure & Data Centers") {
      console.log("🎯 Infrastructure & Data Centers card clicked");
      
      // Load the "v1" scene
      if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
        console.log("🗺️ Attempting to load v1 scene");
        const sceneLoaded = window.mapComponent.loadSceneByName("v1");
        console.log("📍 Scene load result:", sceneLoaded);
      } else {
        console.warn("⚠️ mapComponent or loadSceneByName not available");
      }
      
      // Call the infrastructure visualization handler
      const setIsLoading = window.setAIChatPanelLoading;
      const setMessages = window.setAIChatPanelMessages;
      const effectiveMap = window.mapComponent?.map;
      
      console.log("🔧 Checking required functions:", {
        hasSetIsLoading: !!setIsLoading,
        hasSetMessages: !!setMessages,
        hasEffectiveMap: !!effectiveMap
      });
      
      if (setMessages && setIsLoading) {
        console.log("🚀 Calling handleInfrastructureVisualization");
        handleInfrastructureVisualization(effectiveMap, setMessages, setIsLoading)
          .then(() => console.log("✅ Infrastructure visualization complete"))
          .catch(error => console.error("❌ Error in infrastructure visualization:", error));
      } else {
        console.error("❌ Required functions not available for infrastructure visualization");
      }
    }
    
    // Handle quick action buttons for renewable energy visualization
    if (interventionName === "SHOW_SOLAR_POTENTIAL") {
      // NOTE: Disabled in favor of direct button handler
      console.log("🏙️ DISABLED: Original Resource Planning handler would be called here");
      
      /* Original handler code commented out to prevent conflicts
      console.log("🏙️ Resource Planning button clicked");
      
      // Find and load the next scene
      if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
        // Specifically load the scene named "Next" (with capital N)
        console.log("🗺️ Attempting to load 'Next' scene (exact name match)");
        let sceneLoaded = window.mapComponent.loadSceneByName("Next");
        
        console.log("📍 Scene load result:", sceneLoaded);
        
        // If we couldn't load the Next scene, show a fallback message
        if (!sceneLoaded) {
          console.warn("⚠️ 'Next' scene not found");
          const setMessages = window.setAIChatPanelMessages;
          if (setMessages) {
            setMessages(prevMessages => [
              ...prevMessages,
              {
                isUser: false,
                content: { 
                  preGraphText: "The 'Next' scene could not be loaded. Please make sure a scene named 'Next' exists in your scenes collection.",
                  postGraphText: "In the meantime, you can explore the neighborhood zoning data in the current visualization."
                }
              }
            ]);
          }
        } else {
          // Scene loaded successfully, update the AI Panel with a message about zoning changes
          const setMessages = window.setAIChatPanelMessages;
          if (setMessages) {
            setMessages(prevMessages => [
              ...prevMessages,
              {
                isUser: true,
                content: "Which neighborhoods need only single zoning changes to connect isolated areas?"
              },
              {
                isUser: false,
                content: { 
                  preGraphText: "I've analyzed the zoning regulations across Los Angeles neighborhoods to identify areas where isolated communities could be connected with minimal zoning changes:",
                  postGraphText: `Based on my analysis, these neighborhoods could see significant connectivity improvements with just single zoning changes:

1. **Boyle Heights** - Modifying industrial buffer zones along the 101 freeway would connect residential pockets that are currently isolated.

2. **Palms/Culver City Border** - Rezoning a small commercial corridor to mixed-use would bridge disconnected residential areas.

3. **Van Nuys** - Converting a narrow strip of manufacturing zoning to community commercial would link separated residential neighborhoods.

4. **Highland Park** - Allowing mixed-use development along a key 0.5 mile stretch would connect isolated residential zones.

5. **Westlake** - Changing single-use commercial to neighborhood commercial would bridge housing developments separated by commercial zones.

These strategic zoning modifications would have an outsized impact on creating more connected, walkable communities while requiring minimal policy changes.`,
                  followUpSuggestions: [
                    {
                      text: "Show specific areas that would benefit most in Boyle Heights",
                      prompt: "SHOW_BOYLE_HEIGHTS_ZONING"
                    },
                    {
                      text: "Compare connectivity metrics before and after proposed changes",
                      prompt: "COMPARE_CONNECTIVITY_METRICS"
                    },
                    {
                      text: "What policy tools could implement these changes most efficiently?",
                      prompt: "SHOW_POLICY_TOOLS"
                    }
                  ]
                }
              }
            ]);
          }
        }
      } else {
        console.warn("⚠️ mapComponent or loadSceneByName not available");
      }
      */
    }
    
    // Handle other quick action buttons for renewable energy visualization
    if (interventionName === "SHOW_GRID_INTEGRATION" || interventionName === "SHOW_ENERGY_FORECAST") {
      console.log(`🔌 ${interventionName} button clicked`);
      
      // Try to load an appropriate scene
      if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
        // For grid integration, try to find a scene with 'grid' in the name
        // For energy forecast, try to find a scene with 'forecast' in the name
        const searchTerm = interventionName === "SHOW_GRID_INTEGRATION" ? "grid" : "forecast";
        console.log(`🗺️ Attempting to load scene with "${searchTerm}" in the name`);
        let sceneLoaded = window.mapComponent.loadSceneByName(searchTerm);
        
        // If that doesn't work, try alternative scene names
        if (!sceneLoaded && interventionName === "SHOW_GRID_INTEGRATION") {
          console.log("🗺️ Grid scene not found, trying 'network' or 'integration'");
          sceneLoaded = window.mapComponent.loadSceneByName("network") || 
                         window.mapComponent.loadSceneByName("integration") ||
                         window.mapComponent.loadSceneByName("v3");
        } else if (!sceneLoaded && interventionName === "SHOW_ENERGY_FORECAST") {
          console.log("🗺️ Forecast scene not found, trying 'projection' or 'future'");
          sceneLoaded = window.mapComponent.loadSceneByName("projection") || 
                         window.mapComponent.loadSceneByName("future") ||
                         window.mapComponent.loadSceneByName("v4");
        }
        
        console.log("📍 Scene load result:", sceneLoaded);
        
        if (sceneLoaded) {
          // Scene loaded successfully, update the AI Panel with a message
          const setMessages = window.setAIChatPanelMessages;
          if (setMessages) {
            // Set appropriate message based on which button was clicked
            const title = interventionName === "SHOW_GRID_INTEGRATION" ? 
                          "Grid Integration Analysis" : "Future Energy Projections";
            const preText = interventionName === "SHOW_GRID_INTEGRATION" ? 
                           "Analyzing renewable energy grid integration across Los Angeles..." :
                           "Loading future energy capacity projections through 2030...";
            const postText = interventionName === "SHOW_GRID_INTEGRATION" ? 
                            "This analysis shows how renewable energy sources can be integrated into the existing power grid, with focus on minimizing infrastructure costs while maximizing reliability." :
                            "The projection model indicates a potential 320% increase in renewable capacity by 2030, with solar continuing to be the dominant source at 72% of all renewable generation.";
            
            setMessages(prevMessages => [
              ...prevMessages,
              {
                isUser: true,
                content: `View ${title}`
              },
              {
                isUser: false,
                content: { 
                  preGraphText: preText,
                  postGraphText: postText
                }
              }
            ]);
          }
          return;
        }
      }
      
      // Show a fallback message if no scene was loaded
      const setMessages = window.setAIChatPanelMessages;
      if (setMessages) {
        const title = interventionName === "SHOW_GRID_INTEGRATION" ? "Grid Integration" : "Energy Forecast";
        setMessages(prevMessages => [
          ...prevMessages,
          {
            isUser: false,
            content: { 
              preGraphText: `${title} analysis is currently being prepared.`,
              postGraphText: "This functionality will be available in a future update."
            }
          }
        ]);
      }
    }
    
    // Reset the click state after animation completes
    setTimeout(() => {
      setClickedCard(null);
    }, 800);
  };

  // Function to determine which icon to use for each intervention card
  const getInterventionIcon = (interventionName) => {
    // Return appropriate SVG based on the intervention name
    if (interventionName.includes("Adaptive Reuse") || interventionName.includes("Building")) {
      return (
        <CardIcon className="pulse" $bgColor="#4B5563">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="9" y1="2" x2="9" y2="22"></line>
            <line x1="15" y1="2" x2="15" y2="22"></line>
            <line x1="4" y1="12" x2="20" y2="12"></line>
          </svg>
        </CardIcon>
      );
    } else if (interventionName.includes("Transit") || interventionName.includes("Corridor")) {
      return (
        <CardIcon className="wave" $bgColor="#3B82F6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9h12v7H6z"></path>
            <path d="M19 19H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z"></path>
            <path d="M8 19v3"></path>
            <path d="M16 19v3"></path>
          </svg>
        </CardIcon>
      );
    } else if (interventionName.includes("Infrastructure") || interventionName.includes("Mobility")) {
      return (
        <CardIcon className="rotate" $bgColor="#6366F1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </CardIcon>
      );
    } else if (interventionName.includes("Mixed-Use") || interventionName.includes("Development")) {
      return (
        <CardIcon className="bounce" $bgColor="#8B5CF6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h2v10H2V12z"></path>
            <path d="M6 8h2v14H6V8z"></path>
            <path d="M10 4h2v18h-2V4z"></path>
            <path d="M14 2h2v20h-2V2z"></path>
            <path d="M18 6h2v16h-2V6z"></path>
          </svg>
        </CardIcon>
      );
    } else if (interventionName.includes("Healthcare") || interventionName.includes("Access")) {
      return (
        <CardIcon className="pulse" $bgColor="#EC4899">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        </CardIcon>
      );
    } else {
      return (
        <CardIcon className="pulse" $bgColor="#10B981">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        </CardIcon>
      );
    }
  };

  // Function to get infrastructure improvement icons
  const getInfrastructureIcon = (improvementName) => {
    if (improvementName.includes("Transit") || improvementName.includes("Bus") || improvementName.includes("Rail")) {
      return (
        <CardIcon className="wave" $bgColor="#8B5CF6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"></rect>
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
        </CardIcon>
      );
    } else if (improvementName.includes("Sidewalk") || improvementName.includes("Pedestrian") || improvementName.includes("Walkability")) {
      return (
        <CardIcon className="bounce" $bgColor="#EC4899">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3"></circle>
            <line x1="12" y1="8" x2="12" y2="14"></line>
            <path d="M8 14l-3 6"></path>
            <path d="M16 14l3 6"></path>
            <path d="M9 14h6"></path>
          </svg>
        </CardIcon>
      );
    } else if (improvementName.includes("Grid") || improvementName.includes("Power") || improvementName.includes("Electric")) {
      return (
        <CardIcon className="pulse" $bgColor="#10B981">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
        </CardIcon>
      );
    } else if (improvementName.includes("Bike") || improvementName.includes("Cycling")) {
      return (
        <CardIcon className="rotate" $bgColor="#6366F1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5.5" cy="17.5" r="3.5"></circle>
            <circle cx="18.5" cy="17.5" r="3.5"></circle>
            <path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5l2-5 4 3-3 3"></path>
            <path d="M14 15l-4-3 2-4h4"></path>
          </svg>
        </CardIcon>
      );
    } else {
      return (
        <CardIcon className="wave" $bgColor="#F59E0B">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="12" y1="2" x2="12" y2="22"></line>
            <circle cx="12" cy="12" r="4"></circle>
          </svg>
        </CardIcon>
      );
    }
  };

  // Function to get energy action icons
  const getEnergyActionIcon = (actionName) => {
    if (actionName.includes("Grid") || actionName === "SHOW_GRID_INTEGRATION") {
      return (
        <CardIcon className="pulse" $bgColor="#10B981" $size="small">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2l20 20M6.4 6.4L17.6 17.6M12 2C6.5 2 2 6.5 2 12a10 10 0 0012 10"></path>
            <path d="M18 11a7 7 0 00-7-7"></path>
            <path d="M20 17A10 10 0 0022 12"></path>
          </svg>
        </CardIcon>
      );
    } else if (actionName.includes("Forecast") || actionName === "SHOW_ENERGY_FORECAST") {
      return (
        <CardIcon className="wave" $bgColor="#8B5CF6" $size="small">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </CardIcon>
      );
    } else if (actionName.includes("Solar") || actionName.includes("Renewable")) {
      return (
        <CardIcon className="bounce" $bgColor="#F59E0B" $size="small">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </CardIcon>
      );
    } else {
      return (
        <CardIcon className="rotate" $bgColor="#3B82F6" $size="small">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
          </svg>
        </CardIcon>
      );
    }
  };

  // Apply fade-in classes to sections based on their loading state
  const getFadeClass = (sectionType) => {
    if (isLoading && !loadedSections[sectionType]) {
      return '';
    }
    return 'fade-in';
  };

  if (visualizationType === "commercialCluster") {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800 w-full max-w-3xl">
        {/* Commercial Info Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-white">{data.clusterData.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 font-medium text-sm">High Risk Zone</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {data.clusterData.type} | {data.clusterData.properties} properties | {data.clusterData.sqft} sq ft
          </div>
        </div>

        {/* Recovery Timeline */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-bold text-white mb-3 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            AI Recovery Timeline
          </h3>
          
          <div className="bg-gray-800 rounded-lg p-3 mb-4 text-gray-300 text-sm">
            <p>Modeling a <span className="text-white font-bold">Category 4</span> hurricane scenario with sustained winds of <span className="text-white font-bold">130 mph</span> and rainfall of <span className="text-white font-bold">40+ inches</span> over <span className="text-white font-bold">4 days</span>. Initial impact shows <span className="text-white font-bold">65%</span> of the area experiencing power outages and flood depths averaging <span className="text-white font-bold">2.8 feet</span> above ground level, comparable to Hurricane Harvey conditions.</p>
          </div>
          
          <div className="h-64 w-full mb-4">
            <div className="text-gray-300 text-sm font-semibold mb-4 text-center">Recovery Projection scenario 102</div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={[
                  { time: 0, Infrastructure: 100, Environmental: 100, Operational: 100 },
                  { time: 6, Infrastructure: 35, Environmental: 45, Operational: 60 },
                  { time: 12, Infrastructure: 30, Environmental: 40, Operational: 55 },
                  { time: 24, Infrastructure: 40, Environmental: 45, Operational: 65 },
                  { time: 48, Infrastructure: 55, Environmental: 50, Operational: 75 },
                  { time: 72, Infrastructure: 70, Environmental: 60, Operational: 85 },
                  { time: 96, Infrastructure: 80, Environmental: 65, Operational: 90 },
                  { time: 120, Infrastructure: 85, Environmental: 70, Operational: 95 },
                  { time: 168, Infrastructure: 90, Environmental: 80, Operational: 98 },
                  { time: 240, Infrastructure: 95, Environmental: 90, Operational: 100 }
                ]}
                margin={{ top: 10, right: 15, left: 5, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9ca3af"
                  tickFormatter={(value) => `${value}h`}
                  tick={{ fontSize: 10 }}
                  label={{ 
                    value: 'Hours Since Impact', 
                    position: 'insideBottom',
                    fill: '#9ca3af',
                    fontSize: 11,
                    dy: 10,
                    offset: -5
                  }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickCount={5}
                  tickFormatter={(value) => `${value}%`}
                  axisLine={false}
                  tickLine={false}
                  label={{ 
                    value: 'System Functionality', 
                    angle: -90, 
                    position: 'center',
                    fill: '#9ca3af',
                    fontSize: 11,
                    dx: -25
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151', 
                    color: '#e5e7eb',
                    fontSize: 11,
                    padding: '8px'
                  }}
                  formatter={(value, name) => [`${value}%`, name]}
                  labelFormatter={(value) => `Hour ${value}`}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  wrapperStyle={{
                    fontSize: '11px',
                    paddingTop: '15px',
                    marginBottom: '-25px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Infrastructure"
                  stroke={milestoneCategories.Infrastructure.color}
                  fill={milestoneCategories.Infrastructure.color}
                  fillOpacity={0.2}
                  name="Infrastructure"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Environmental"
                  stroke={milestoneCategories.Environmental.color}
                  fill={milestoneCategories.Environmental.color}
                  fillOpacity={0.2}
                  name="Environmental"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Operational"
                  stroke={milestoneCategories.Operational.color}
                  fill={milestoneCategories.Operational.color}
                  fillOpacity={0.2}
                  name="Operational"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Model Conclusions */}
        <div className="p-4 pt-8 pb-8 border-b border-gray-800">
          <h3 className="font-bold text-white mb-3">LLM Recovery Predictions</h3>
          <div className="space-y-3">
            {data.modelConclusions.map(model => (
              <div 
                key={model.id} 
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                style={{ borderLeftColor: model.color, borderLeftWidth: '3px' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: model.color }}></div>
                    <span className="text-white font-bold">{model.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-400 text-sm mr-2">Risk Score:</span>
                    <span 
                      className="text-sm font-bold rounded-lg px-2 py-0.5" 
                      style={{ backgroundColor: `${model.color}30`, color: model.color }}
                    >
                      {model.riskScore}
                    </span>
                    <span className="text-white font-medium ml-3">{model.recoveryTime}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 italic">"{model.uniqueFinding}"</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Risk Factors Chart */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-bold text-white mb-3 flex items-center">
            <BarChart2 className="w-5 h-5 mr-2" />
            Risk Factor Analysis
          </h3>
          
          <div className="h-80 w-full mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.riskFactorData}
                layout="vertical"
                barGap={2}
                barSize={8}
              >
                <defs>
                  {data.llmModels.map(model => (
                    <linearGradient key={model.id} id={`gradient-${model.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={`${model.color}40`} />
                      <stop offset="100%" stopColor={model.color} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#374151" 
                  horizontal={true}
                />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  stroke="#9ca3af"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  label={{ 
                    value: 'Risk Impact Score (%)', 
                    position: 'bottom',
                    fill: '#e5e7eb',
                    fontSize: 13,
                    dy: 15
                  }}
                />
                <YAxis 
                  dataKey="factor" 
                  type="category" 
                  stroke="#9ca3af"
                  tickLine={false}
                  axisLine={false}
                  tick={(props) => {
                    const factor = data.riskFactorData.find(d => d.factor === props.payload.value);
                    const category = factor?.category;
                    const categoryColor = milestoneCategories[category]?.color;
                    return (
                      <g transform={`translate(${props.x},${props.y})`}>
                        <rect
                          x={-135}
                          y={-10}
                          width={130}
                          height={20}
                          fill={`${categoryColor}15`}
                          rx={4}
                        />
                        <text
                          x={-15}
                          y={0}
                          dy={4}
                          textAnchor="end"
                          fill="#e5e7eb"
                          fontSize={13}
                          fontWeight={500}
                        >
                          {props.payload.value}
                        </text>
                        <text
                          x={-125}
                          y={0}
                          dy={4}
                          textAnchor="start"
                          fill={categoryColor}
                          fontSize={12}
                          fontWeight={600}
                        >
                          {category}
                        </text>
                      </g>
                    );
                  }}
                  width={140}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{
                    paddingBottom: '10px'
                  }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '6px',
                    color: '#f3f4f6'
                  }}
                  itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                  labelStyle={{ color: '#e5e7eb', fontWeight: 600, marginBottom: '8px' }}
                  formatter={(value, name, props) => {
                    const model = data.llmModels.find(m => m.name === name);
                    return [
                      <>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          padding: '4px 8px',
                          background: `${model.color}15`,
                          borderRadius: '4px',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            width: '3px',
                            height: '16px',
                            background: model.color,
                            borderRadius: '2px'
                          }} />
                          <span style={{ 
                            color: model.color,
                            fontWeight: 600
                          }}>
                            {value}% Impact
                          </span>
                        </div>
                      </>,
                      name
                    ];
                  }}
                  labelFormatter={(label) => {
                    const factor = data.riskFactorData.find(d => d.factor === label);
                    const category = factor?.category;
                    const categoryColor = milestoneCategories[category]?.color;
                    return (
                      <div>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{
                            width: '4px',
                            height: '20px',
                            background: categoryColor,
                            borderRadius: '2px'
                          }} />
                          <div>
                            <div style={{ 
                              fontSize: '14px',
                              fontWeight: 600,
                              color: categoryColor
                            }}>
                              {category}
                            </div>
                            <div style={{ 
                              fontSize: '13px',
                              color: '#e5e7eb'
                            }}>
                              {label}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '8px',
                          background: '#374151',
                          borderRadius: '4px',
                          marginTop: '8px'
                        }}>
                          <div style={{ 
                            fontSize: '12px',
                            color: '#9ca3af',
                            marginBottom: '4px'
                          }}>
                            {factor?.description}
                          </div>
                          <div style={{ 
                            fontSize: '12px',
                            color: '#d1d5db',
                            fontStyle: 'italic'
                          }}>
                            {factor?.impact}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                {data.llmModels.map(model => (
                  <Bar
                    key={model.id}
                    dataKey={model.name}
                    fill={`url(#gradient-${model.id})`}
                    radius={[0, 4, 4, 0]}
                    name={model.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* More Details Bar */}
        <div className="p-4 bg-gray-800 flex justify-between items-center">
          <div className="text-gray-300">
            <span className="text-white font-bold">Prediction Range:</span> 20-36 day recovery
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 transition-colors">
            <span>Full Analysis</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }
  
  if (visualizationType === "urbanImpact") {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800 w-full max-w-3xl mb-4">
        {/* Header */}
        {isLoading && !loadedSections.header ? <HeaderSkeleton /> : (
          <div className={`${getFadeClass('header')}`}>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold text-white">Urban Impact Analysis</h2>
              </div>
              <p className="text-gray-300 text-sm">
                {data.preGraphText}
              </p>
            </div>
          </div>
        )}

        {/* Intervention Details */}
        {isLoading && !loadedSections.details ? <DetailsSkeleton /> : (
          <div className={`${getFadeClass('details')}`}>
            <div className="p-4">
              <h3 className="font-bold text-white mb-3">Top Interventions</h3>
              <div className="space-y-4">
                {data.graphData.interventionDetails.map((intervention, idx) => {
                  // Generate additional paragraphs that will only show in expanded view
                  // This simulates having more content without changing the data structure
                  const additionalParagraphs = [
                    `Further analysis shows that implementing ${intervention.name} would create significant positive outcomes for the community. Based on similar interventions in comparable urban environments, we can expect to see improvements in quality of life metrics by 15-20% within the first year.`,
                    `Budget considerations for this intervention include initial capital expenditure of approximately ${intervention.cost} with ongoing maintenance costs of roughly 8-12% annually. The projected return on investment, measured in both economic and social impact, is expected to exceed costs within 3-5 years of implementation.`
                  ];
                  
                  return (
                  <ClickableCard 
                    key={idx}
                    className={`bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition-colors ${clickedCard === intervention.name ? 'clicked' : ''}`}
                    style={{
                      borderLeft: intervention.name.includes("Adaptive Reuse") ? "4px solid #10B981" : 
                              intervention.name.includes("Transit") ? "4px solid #3B82F6" : 
                              intervention.name.includes("Mobility") ? "4px solid #6366F1" : 
                              "4px solid #8B5CF6",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)"
                    }}
                    onClick={() => handleCardClick(intervention.name)}
                  >
                    {/* Header section */}
                    <div className="flex items-center mb-3">
                      {getInterventionIcon(intervention.name)}
                      <h4 className="font-bold text-white text-lg">{intervention.name}</h4>
                    </div>
                    
                    {/* Cost tag - now below header */}
                    <div className="mb-3">
                      <div className="inline-flex items-center">
                        <span className="text-xs text-gray-400 mr-2">Investment:</span>
                        <span className="text-xs font-semibold bg-gray-900 px-2 py-1 rounded-md text-white border border-gray-700">
                          {intervention.cost}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 opacity-30 mb-4"></div>
                    
                    {/* Description with expand/collapse functionality */}
                    <div className="mb-3">
                      {/* Collapsed view with gradient fade - only show main description */}
                      {!expandedCards[intervention.name] && (
                        <div className="relative">
                          <div 
                            className="text-gray-300 text-sm leading-relaxed overflow-hidden whitespace-normal"
                            style={{
                              maxHeight: '4.8em',
                              position: 'relative',
                            }}
                          >
                            {formatDescriptionText(intervention.description)}
                            {/* Gradient fade overlay when collapsed - positioned so it only affects text beyond 3 lines */}
                            <div 
                              className="absolute bottom-0 left-0 right-0 h-7" 
                              style={{
                                background: 'linear-gradient(to bottom, rgba(31, 41, 55, 0) 20%, rgba(31, 41, 55, 0.95) 90%)'
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Expanded view with full content plus additional paragraphs */}
                      {expandedCards[intervention.name] && (
                        <div className="text-gray-300 text-sm whitespace-normal">
                          <div className="mb-4">
                            {formatDescriptionText(intervention.description)}
                          </div>
                          
                          {/* Additional paragraphs that only appear in expanded view */}
                          {additionalParagraphs.map((paragraph, i) => (
                            <div key={i} className="mb-4">
                              {formatDescriptionText(paragraph)}
                            </div>
                          ))}
                          
                          {/* Implementation Timeline Visualization - only in expanded view */}
                          <div className="mb-5 mt-4">
                            <div className="flex items-center gap-1 mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-gray-400">Implementation Timeline</span>
                            </div>
                            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="absolute inset-0 flex">
                                {/* Timeline progress bar based on timeframe */}
                                <div className={`h-full ${
                                  intervention.timeframe?.toLowerCase().includes('1') || 
                                  intervention.timeframe?.toLowerCase().includes('immediate') || 
                                  intervention.timeframe?.toLowerCase().includes('short') ? 
                                    'w-1/4 bg-green-600' : 
                                  intervention.timeframe?.toLowerCase().includes('3') || 
                                  intervention.timeframe?.toLowerCase().includes('5') || 
                                  intervention.timeframe?.toLowerCase().includes('medium') ? 
                                    'w-1/2 bg-blue-600' : 
                                    'w-3/4 bg-purple-600'
                                } rounded-l-full`}></div>
                                <div className="h-full bg-gray-700 flex-grow rounded-r-full"></div>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>Start</span>
                              <span>Implementation complete</span>
                            </div>
                          </div>
                          
                          {/* Benefits tags - only in expanded view */}
                          <div className="flex flex-wrap mb-4">
                            <div className="text-xs font-medium text-gray-400 w-full mb-2">Benefits:</div>
                            {intervention.benefits.map((benefit, bidx) => {
                              // Determine color based on benefit content
                              let bgColor = "bg-gray-700";
                              let textColor = "text-gray-300";
                              
                              if (benefit.toLowerCase().includes("economic") || benefit.toLowerCase().includes("financial") || benefit.toLowerCase().includes("revenue")) {
                                bgColor = "bg-green-900";
                                textColor = "text-green-300";
                              } else if (benefit.toLowerCase().includes("health") || benefit.toLowerCase().includes("safety") || benefit.toLowerCase().includes("security")) {
                                bgColor = "bg-blue-900";
                                textColor = "text-blue-300";
                              } else if (benefit.toLowerCase().includes("social") || benefit.toLowerCase().includes("community") || benefit.toLowerCase().includes("public")) {
                                bgColor = "bg-purple-900";
                                textColor = "text-purple-300";
                              } else if (benefit.toLowerCase().includes("environmental") || benefit.toLowerCase().includes("sustainability") || benefit.toLowerCase().includes("climate")) {
                                bgColor = "bg-emerald-900";
                                textColor = "text-emerald-300";
                              }
                              
                              return (
                                <span 
                                  key={bidx} 
                                  className={`${bgColor} ${textColor} text-xs rounded-full px-3 py-1 mr-2 mb-2 shadow-sm`}
                                >
                                  {benefit}
                                </span>
                              );
                            })}
                          </div>
                          
                          {/* Relationships between interventions - only in expanded view */}
                          <div className="mt-4 mb-3">
                            <div className="flex items-center gap-1 mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-gray-400">Related Interventions</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {/* Generate related interventions dynamically based on name */}
                              {data.graphData.interventionDetails
                                .filter(related => related.name !== intervention.name)
                                .slice(0, 2) // Limit to 2 related interventions for demonstration
                                .map((related, idx) => (
                                  <span key={idx} className="inline-flex items-center text-xs bg-gray-800 text-blue-300 px-3 py-1.5 rounded-md border border-gray-700">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                                    {related.name}
                                  </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Timeframe - always visible */}
                    <div className="flex items-center gap-1 mb-4">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="bg-gray-700 px-2 py-0.5 rounded-md text-blue-300 text-xs">{intervention.timeframe}</span>
                    </div>
                    
                    {/* Source information */}
                    <div className="text-xs text-gray-500 mb-3">
                      Source: LA City Planning Department
                    </div>
                    
                    {/* Toggle button */}
                    <button 
                      onClick={(e) => toggleCardExpansion(intervention.name, e)}
                      className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-1 transition-colors"
                      aria-expanded={expandedCards[intervention.name]}
                    >
                      {expandedCards[intervention.name] ? (
                        <>
                          <span>Show less</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>Read more</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </>
                      )}
                    </button>
                  </ClickableCard>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (visualizationType === "serviceCorridors") {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800 w-full max-w-3xl mb-4">
        {/* Header - Render Immediately */}
        {isLoading && !loadedSections.header ? <HeaderSkeleton /> : (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Service Corridors Analysis</h2>
            </div>
            <p className="text-gray-300 text-sm">
              {data.preGraphText}
            </p>
          </div>
        )}

        {/* Lazy load the more complex parts with useEffect+useState */}
        <React.Suspense fallback={
          <div className="p-4 animate-pulse flex justify-center">
            <div className="h-6 bg-gray-700 rounded w-3/4"></div>
          </div>
        }>
          {/* Development/Adaptive Sites Summary */}
          {isLoading && !loadedSections.metrics ? <MetricsSkeleton /> : (
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-bold text-white mb-3">Site Analysis Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.totalAdaptiveSites}</div>
                  <div className="text-gray-400 text-xs">Adaptive Reuse Sites</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.totalDevelopmentSites}</div>
                  <div className="text-gray-400 text-xs">Development Sites</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.highPrioritySites}</div>
                  <div className="text-gray-400 text-xs">High Priority Sites</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.estimatedHousingUnits.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs">Potential Housing Units</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.estimatedServiceSpaceSqFt.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs">Service Space (sq ft)</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.graphData.sitesMetrics.averageWalkingDistance} min</div>
                  <div className="text-gray-400 text-xs">Avg. Walking Distance</div>
                </div>
              </div>
            </div>
          )}

          {/* Service Details */}
          {isLoading && !loadedSections.details ? <DetailsSkeleton /> : (
            <div className="p-4">
              <h3 className="font-bold text-white mb-3">Service Development Strategies</h3>
              <div className="space-y-4">
                {data.graphData.serviceDetails.map((service, idx) => (
                  <ClickableCard 
                    key={idx}
                    className={`bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors ${clickedCard === service.name ? 'clicked' : ''}`}
                    style={{
                      borderLeft: "4px solid #3B82F6",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)"
                    }}
                    onClick={() => handleCardClick(service.name)}
                  >
                    {/* Header section */}
                    <div className="flex items-center mb-3">
                      {getInterventionIcon(service.name)}
                      <h4 className="font-bold text-white text-lg">{service.name}</h4>
                    </div>
                    
                    {/* Cost tag - now below header */}
                    <div className="mb-3">
                      <div className="inline-flex items-center">
                        <span className="text-xs text-gray-400 mr-2">Investment:</span>
                        <span className="text-xs font-semibold bg-gray-900 px-2 py-1 rounded-md text-white border border-gray-700">
                          {service.cost}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 opacity-30 mb-4"></div>
                    
                    {/* Description */}
                    <div className="mb-3">
                      {!expandedCards[service.name] && (
                        <div className="text-gray-300 text-sm leading-relaxed">
                          {service.description}
                        </div>
                      )}
                      
                      {expandedCards[service.name] && (
                        <div className="text-gray-300 text-sm leading-relaxed">
                          <div className="mb-4">
                            {service.description}
                          </div>
                          
                          {/* Implementation Timeline Visualization - only in expanded view */}
                          <div className="mb-5 mt-4">
                            <div className="flex items-center gap-1 mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-gray-400">Implementation Timeline</span>
                            </div>
                            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="absolute inset-0 flex">
                                {/* Timeline progress bar based on timeframe */}
                                <div className={`h-full ${
                                  service.timeframe?.toLowerCase().includes('1') || 
                                  service.timeframe?.toLowerCase().includes('immediate') || 
                                  service.timeframe?.toLowerCase().includes('short') ? 
                                    'w-1/4 bg-green-600' : 
                                  service.timeframe?.toLowerCase().includes('3') || 
                                  service.timeframe?.toLowerCase().includes('5') || 
                                  service.timeframe?.toLowerCase().includes('medium') ? 
                                    'w-1/2 bg-blue-600' : 
                                    'w-3/4 bg-purple-600'
                                } rounded-l-full`}></div>
                                <div className="h-full bg-gray-700 flex-grow rounded-r-full"></div>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>Start</span>
                              <span>Implementation complete</span>
                            </div>
                          </div>
                          
                          {/* Benefits tags - only in expanded view */}
                          <div className="flex flex-wrap mb-4">
                            <div className="text-xs font-medium text-gray-400 w-full mb-2">Benefits:</div>
                            {service.benefits.map((benefit, bidx) => {
                              // Determine color based on benefit content
                              let bgColor = "bg-gray-700";
                              let textColor = "text-gray-300";
                              
                              if (benefit.toLowerCase().includes("economic") || benefit.toLowerCase().includes("financial") || benefit.toLowerCase().includes("revenue")) {
                                bgColor = "bg-green-900";
                                textColor = "text-green-300";
                              } else if (benefit.toLowerCase().includes("health") || benefit.toLowerCase().includes("safety") || benefit.toLowerCase().includes("security")) {
                                bgColor = "bg-blue-900";
                                textColor = "text-blue-300";
                              } else if (benefit.toLowerCase().includes("social") || benefit.toLowerCase().includes("community") || benefit.toLowerCase().includes("public")) {
                                bgColor = "bg-purple-900";
                                textColor = "text-purple-300";
                              } else if (benefit.toLowerCase().includes("environmental") || benefit.toLowerCase().includes("sustainability") || benefit.toLowerCase().includes("climate")) {
                                bgColor = "bg-emerald-900";
                                textColor = "text-emerald-300";
                              }
                              
                              return (
                                <span 
                                  key={bidx} 
                                  className={`${bgColor} ${textColor} text-xs rounded-full px-3 py-1 mr-2 mb-2 shadow-sm`}
                                >
                                  {benefit}
                                </span>
                              );
                            })}
                          </div>
                          
                          {/* Relationships between corridors - only in expanded view */}
                          <div className="mt-4 mb-3">
                            <div className="flex items-center gap-1 mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-gray-400">Related Corridors</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {/* Generate related corridors dynamically based on name */}
                              {data.graphData.serviceDetails
                                .filter(related => related.name !== service.name)
                                .slice(0, 2) // Limit to 2 related corridors for demonstration
                                .map((related, idx) => (
                                  <span key={idx} className="inline-flex items-center text-xs bg-gray-800 text-blue-300 px-3 py-1.5 rounded-md border border-gray-700">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                                    {related.name}
                                  </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Timeframe - always visible */}
                    <div className="flex items-center gap-1 mb-4">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="bg-gray-700 px-2 py-0.5 rounded-md text-blue-300 text-xs">{service.timeframe}</span>
                    </div>
                    
                    {/* Source information */}
                    <div className="text-xs text-gray-500 mb-3">
                      Source: LA Transit Authority
                    </div>
                    
                    {/* Toggle button */}
                    <div className="flex justify-between items-center">
                      <button 
                        onClick={(e) => toggleCardExpansion(service.name, e)}
                        className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-1 transition-colors"
                        aria-expanded={expandedCards[service.name]}
                      >
                        {expandedCards[service.name] ? (
                          <>
                            <span>Show less</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Read more</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </>
                        )}
                      </button>
                      
                      {/* View Corridor button */}
                      <button 
                        className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs rounded-lg transition-colors shadow-md"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent onClick
                          handleCardClick(service.name);
                        }}
                      >
                        <span>View Corridor</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </ClickableCard>
                ))}
              </div>
            </div>
          )}
        </React.Suspense>
      </div>
    );
  }
  
  if (visualizationType === "infrastructureImprovements") {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800 w-full max-w-3xl mb-4">
        {/* Header */}
        {isLoading && !loadedSections.header ? <HeaderSkeleton /> : (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Infrastructure Impact Analysis</h2>
            </div>
            <p className="text-gray-300 text-sm">
              {data.preGraphText}
            </p>
          </div>
        )}

        {/* Improvement Metrics Summary */}
        {isLoading && !loadedSections.metrics ? <MetricsSkeleton /> : (
          <div className="p-4 border-b border-gray-800">
            <h3 className="font-bold text-white mb-3">Impact Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.highImpactImprovements}</div>
                <div className="text-gray-400 text-xs">High-Impact Projects</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.estimatedCost}</div>
                <div className="text-gray-400 text-xs">Estimated Total Cost</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.estimatedTimeframe}</div>
                <div className="text-gray-400 text-xs">Implementation Time</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.pedestrianFlow}</div>
                <div className="text-gray-400 text-xs">Pedestrian Flow Increase</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.serviceAccessibility}</div>
                <div className="text-gray-400 text-xs">Service Accessibility</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-purple-400 text-xl font-bold">{data.graphData.improvementsMetrics.communityConnectivity}</div>
                <div className="text-gray-400 text-xs">Community Connectivity</div>
              </div>
            </div>
          </div>
        )}

        {/* Infrastructure Improvements Details */}
        {isLoading && !loadedSections.details ? <DetailsSkeleton /> : (
          <div className="p-4">
            <h3 className="font-bold text-white mb-3">Recommended Improvements</h3>
            <div className="space-y-4">
              {data.graphData.infrastructureDetails.map((improvement, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      {getInfrastructureIcon(improvement.name)}
                      <h4 className="font-bold text-white">{improvement.name}</h4>
                    </div>
                    <span className="text-sm bg-purple-900 px-2 py-1 rounded text-purple-200">
                      {improvement.impact} Impact
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{improvement.description}</p>
                  <div className="flex flex-wrap justify-between text-sm text-gray-400">
                    <div className="flex items-center gap-1 mb-1 mr-3">
                      <Clock className="w-4 h-4" />
                      <span>{improvement.timeframe}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-purple-300 font-semibold">{improvement.cost}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-between mt-2">
                    <div className="flex flex-wrap gap-2">
                      {improvement.benefits.map((benefit, bidx) => (
                        <span key={bidx} className="bg-gray-700 px-2 py-1 rounded-full text-xs text-purple-300">
                          {benefit}
                        </span>
                      ))}
                    </div>
                    <button 
                      className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 text-xs rounded-lg transition-colors mt-1"
                      onClick={() => {
                        setIsLoading(true);
                        setLoadedSections({
                          header: false,
                          metrics: false,
                          details: false,
                          chart: false,
                          actions: false
                        });
                        // Simulate loading a specific infrastructure view
                        setTimeout(() => {
                          if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
                            window.mapComponent.loadSceneByName("Infrastructure");
                          }
                        }, 500);
                      }}
                    >
                      <span>View Infrastructure</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (visualizationType === "renewableEnergy") {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-800 w-full max-w-3xl mb-4">
        {/* Header */}
        {isLoading && !loadedSections.header ? <HeaderSkeleton /> : (
          <div className={`${getFadeClass('header')}`}>
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-bold text-white">{data.visualization.title}</h2>
              </div>
              <p className="text-gray-300 text-sm">
                {data.preGraphText}
              </p>
            </div>
          </div>
        )}

        {/* Metrics Summary */}
        {isLoading && !loadedSections.metrics ? <MetricsSkeleton /> : (
          <div className={`${getFadeClass('metrics')}`}>
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-bold text-white mb-3">Energy Capacity Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.data.metrics.totalCapacity}</div>
                  <div className="text-gray-400 text-xs">Current Capacity</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.data.metrics.potentialCapacity}</div>
                  <div className="text-gray-400 text-xs">Growth Potential</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.data.metrics.solarPercentage}</div>
                  <div className="text-gray-400 text-xs">Energy Mix</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-purple-400 text-xl font-bold">{data.data.metrics.peakDemandCoverage}</div>
                  <div className="text-gray-400 text-xs">Peak Demand Coverage</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bar Chart */}
        {isLoading && !loadedSections.chart ? <ChartSkeleton /> : (
          <div className={`${getFadeClass('chart')}`}>
            <div className="p-4">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.visualization.data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey={data.visualization.xAxis.dataKey}
                      stroke="#9ca3af"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: data.visualization.xAxis.label,
                        position: 'bottom',
                        offset: 50,
                        fill: '#9ca3af'
                      }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      tickFormatter={(value) => `${value} MW`}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: data.visualization.yAxis.label,
                        angle: -90,
                        position: 'insideLeft',
                        offset: -10,
                        fill: '#9ca3af'
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '6px'
                      }}
                      formatter={(value) => [`${value} MW`]}
                    />
                    <Legend />
                    {data.visualization.bars.map((bar, index) => (
                      <Bar
                        key={bar.dataKey}
                        dataKey={bar.dataKey}
                        name={bar.name}
                        fill={bar.color}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {isLoading && !loadedSections.actions ? <ActionsSkeleton /> : (
          <div className={`${getFadeClass('actions')}`}>
            <div className="p-4 bg-gray-800">
              <div className="flex flex-wrap gap-2">
                {data.quickActions?.map((action, idx) => {
                  console.log(`🔍 Rendering quick action button ${idx}:`, action);
                  console.log(`   → Text: "${action.text}", Prompt: "${action.prompt}"`);
                  
                  return (
                    <button
                      key={idx}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                      onClick={() => {
                        console.log(`🖱️ Button clicked: "${action.text}" with prompt "${action.prompt}"`);
                        
                        if (action.text === "Resource Planning") {
                          // Direct handler for Resource Planning button
                          console.log("🏙️ Resource Planning button clicked - CUSTOM HANDLER");
                          
                          // Show a notification for better UX
                          const notification = document.createElement('div');
                          notification.textContent = "Loading neighborhood zoning analysis...";
                          notification.style.position = "fixed";
                          notification.style.bottom = "20px";
                          notification.style.left = "50%";
                          notification.style.transform = "translateX(-50%)";
                          notification.style.backgroundColor = "#4c1d95";
                          notification.style.color = "white";
                          notification.style.padding = "10px 20px";
                          notification.style.borderRadius = "4px";
                          notification.style.zIndex = "9999";
                          notification.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                          notification.style.animation = "fadeInOut 2.5s forwards";
                          
                          // Create a style element for the animation
                          const style = document.createElement('style');
                          style.textContent = `
                            @keyframes fadeInOut {
                              0% { opacity: 0; transform: translate(-50%, 20px); }
                              15% { opacity: 1; transform: translate(-50%, 0); }
                              85% { opacity: 1; transform: translate(-50%, 0); }
                              100% { opacity: 0; transform: translate(-50%, -20px); }
                            }
                          `;
                          document.head.appendChild(style);
                          document.body.appendChild(notification);
                          
                          // Try to load the scene
                          if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
                            window.mapComponent.loadSceneByName("Next");
                          }
                          
                          // Set the AI panel message directly
                          const setMessages = window.setAIChatPanelMessages;
                          if (setMessages) {
                            setMessages(prevMessages => [
                              ...prevMessages,
                              { isUser: true, content: "Which neighborhoods need only single zoning changes to connect isolated areas?" },
                              { 
                                isUser: false, 
                                content: { 
                                  preGraphText: "I've analyzed the zoning regulations across Los Angeles neighborhoods to identify areas where isolated communities could be connected with minimal zoning changes:",
                                  postGraphText: `Based on my analysis, these neighborhoods could see significant connectivity improvements with just single zoning changes:

1. **Boyle Heights** - Modifying industrial buffer zones along the 101 freeway would connect residential pockets that are currently isolated.

2. **Palms/Culver City Border** - Rezoning a small commercial corridor to mixed-use would bridge disconnected residential areas.

3. **Van Nuys** - Converting a narrow strip of manufacturing zoning to community commercial would link separated residential neighborhoods.

4. **Highland Park** - Allowing mixed-use development along a key 0.5 mile stretch would connect isolated residential zones.

5. **Westlake** - Changing single-use commercial to neighborhood commercial would bridge housing developments separated by commercial zones.

These strategic zoning modifications would have an outsized impact on creating more connected, walkable communities while requiring minimal policy changes.`,
                                  followUpSuggestions: [
                                    {
                                      text: "Show specific areas that would benefit most in Boyle Heights",
                                      prompt: "SHOW_BOYLE_HEIGHTS_ZONING"
                                    },
                                    {
                                      text: "Compare connectivity metrics before and after proposed changes",
                                      prompt: "COMPARE_CONNECTIVITY_METRICS"
                                    },
                                    {
                                      text: "What policy tools could implement these changes most efficiently?",
                                      prompt: "SHOW_POLICY_TOOLS"
                                    }
                                  ]
                                }
                              }
                            ]);
                          }
                          
                          // Clean up notification after animation completes
                          setTimeout(() => {
                            document.body.removeChild(notification);
                            document.head.removeChild(style);
                          }, 2500);
                        } else {
                          // Handle other buttons normally
                          handleCardClick(action.prompt);
                        }
                      }}
                    >
                      {getEnergyActionIcon(action.prompt)}
                      <span>{action.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return null;
};

export default VisualizationDisplay; 