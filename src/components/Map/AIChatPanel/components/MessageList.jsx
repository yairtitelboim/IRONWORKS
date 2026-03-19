import React, { useEffect, useRef, useState } from 'react';
import { 
  ChatMessages, 
  Message, 
  MessageHeader, 
  Avatar, 
  Sender, 
  MessageContent,
  LoadingMessage,
  LoadingStep,
  FollowUpButton
} from '../StyledComponents';
import VisualizationDisplay from './VisualizationDisplay';
import InterventionSkeleton from './InterventionSkeleton';
import { skeletonToContent } from '../animations';
import styled, { keyframes } from 'styled-components';
import { MODEL_COLORS } from '../mockData';
import { Sparkles } from 'lucide-react';
import { BarChart3, Map, Search, Target } from 'lucide-react';

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
const AnimatedIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  
  &.pulse svg {
    animation: ${pulse} 2s infinite ease-in-out;
  }
  
  &.rotate svg {
    animation: ${rotate} 6s infinite linear;
  }
  
  &.bounce svg {
    animation: ${bounce} 1.5s infinite ease-in-out;
  }
  
  &.wave svg {
    animation: ${wave} 2s infinite ease-in-out;
  }
`;

// Styled component for content that transitions from skeleton loading
const AnimatedContent = styled.div`
  animation: ${skeletonToContent} 0.8s ease-out forwards;
`;

// New styled component for model-specific avatar
const ModelAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${props => props.$bgColor || '#2A2A2A'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

// New card skeleton for loading animation
const CardSkeleton = () => (
  <div className="bg-gray-800 p-3 mb-3 rounded-lg border border-gray-700 animate-pulse">
    <div className="flex justify-between items-center mb-2">
      <div className="h-5 bg-gray-700 rounded w-1/3"></div>
      <div className="h-6 bg-purple-700 rounded w-24"></div>
    </div>
    <div className="space-y-2 mb-2">
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-4/5"></div>
    </div>
    <div className="h-3 bg-gray-700 rounded w-1/2 mt-3"></div>
  </div>
);

// New component for neighborhood site cards
const NeighborhoodSiteCard = ({ site }) => {
  const [showFull, setShowFull] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Determine score color based on value
  let scoreColor = '#8c52ff'; // Default purple for most scores
  if (site.score < 40) scoreColor = '#e74c3c'; // Red for low scores
  if (site.score > 85) scoreColor = '#2ecc71'; // Green for high scores
  
  // Format description to highlight important information
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
        regex: /\b\d+(\.\d+)?%?\b/g,  // Numbers and percentages
        filter: () => true // No filter, highlight all matches
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
      while ((match = pattern.regex.exec(text)) !== null) {
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
      if (i === 0 || matches[i].start >= filteredMatches[filteredMatches.length - 1].end) {
        filteredMatches.push(matches[i]);
      }
    }
    
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
  
  // Get appropriate icon based on site content
  const getSiteIcon = () => {
    const title = site.title.toLowerCase();
    const description = site.description.toLowerCase();
    
    // Development potential sites icon
    if (
      title.includes('development') || 
      description.includes('mixed-use') || 
      description.includes('housing') ||
      description.includes('development potential')
    ) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
          <rect x="2" y="6" width="20" height="14" rx="2"></rect>
          <path d="M12 4v2"></path>
          <path d="M12 14v4"></path>
          <path d="M16 14v1"></path>
          <path d="M8 14v1"></path>
          <path d="M2 10h20"></path>
        </svg>
      );
    }
    
    // Adaptive reuse sites icon
    if (
      title.includes('adaptive') || 
      title.includes('reuse') || 
      description.includes('sustainable') || 
      description.includes('green')
    ) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
          <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"></path>
          <path d="M3 12a9 9 0 0 1 9 0a9 9 0 0 1 9 0"></path>
          <path d="M3 18a9 9 0 0 1 9 0a9 9 0 0 1 9 0"></path>
          <line x1="3" y1="6" x2="3" y2="18"></line>
          <line x1="12" y1="6" x2="12" y2="18"></line>
          <line x1="21" y1="6" x2="21" y2="18"></line>
        </svg>
      );
    }
    
    // Infrastructure/services icon (default)
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        <path d="M2 12h20"></path>
      </svg>
    );
  };
  
  // Toggle expanded state with enhanced logging
  const toggleDescription = () => {
    console.log(`Toggle description - current state: ${showFull}`);
    console.log(`Site: ${site.title}, Description length: ${site.description.length}`);
    setShowFull(!showFull);
    console.log(`State set to: ${!showFull}`);
  };

  // Set a timer to show the actual content after 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="bg-gray-800 p-4 mb-4 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start">
          <div className="mr-3 mt-1">
            {getSiteIcon()}
          </div>
          <div className="font-bold text-white text-lg">{site.title}</div>
        </div>
        <span 
          className="px-3 py-1 rounded-md text-sm font-medium text-white ml-2"
          style={{ backgroundColor: scoreColor }}
        >
          Score: {site.score}
        </span>
      </div>
      
      {/* Description content with improved expansion behavior */}
      <div className="mb-3 ml-9"> {/* Added left margin to align with title text */}
        {/* Collapsed view with gradient fade */}
        {!showFull && (
          <div className="relative">
            <div 
              className="text-gray-300 text-sm overflow-hidden whitespace-normal"
              style={{
                maxHeight: '4.2em',  /* Show ~3 lines of text */
                position: 'relative',
              }}
            >
              {formatDescriptionText(site.description)}
              {/* Gradient fade overlay when collapsed */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-6" 
                style={{
                  background: 'linear-gradient(to bottom, rgba(31, 41, 55, 0), rgba(31, 41, 55, 0.95))'
                }}
              />
            </div>
          </div>
        )}
        
        {/* Expanded view with full content */}
        {showFull && (
          <div className="text-gray-300 text-sm whitespace-normal">
            {formatDescriptionText(site.description)}
          </div>
        )}
        
        {/* Toggle button always visible */}
        <button 
          onClick={toggleDescription}
          className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
          aria-expanded={showFull}
        >
          {showFull ? "Show less" : "Read more..."}
        </button>
      </div>
      
      <div className="text-gray-500 text-xs flex items-center ml-9 pt-1 border-t border-gray-700">
        <span className="font-medium">Source:</span>
        <span className="ml-1">{site.source}</span>
      </div>
    </div>
  );
};

// Add the NeighborhoodDataDisplay component
const NeighborhoodDataDisplay = ({ data }) => {
  const { name, totalSites, adaptiveReuseSites, developmentSites } = data;
  
  // Limit to first 5 cards for each category
  const limitedAdaptiveReuseSites = adaptiveReuseSites.slice(0, 5);
  const limitedDevelopmentSites = developmentSites.slice(0, 5);
  
  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-bold text-white text-lg mb-2">{name}</h3>
        <p className="text-gray-300 text-sm mb-3">{totalSites} Total Development Sites (Showing first 5 of each type)</p>
        
        {adaptiveReuseSites.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-purple-400 mb-2">
              Adaptive Reuse Sites ({adaptiveReuseSites.length})
            </h4>
            <div>
              {limitedAdaptiveReuseSites.map((site, index) => (
                <NeighborhoodSiteCard key={`ar-${index}`} site={site} />
              ))}
            </div>
            {adaptiveReuseSites.length > 5 && (
              <p className="text-gray-400 text-xs mt-2">+ {adaptiveReuseSites.length - 5} more sites not shown</p>
            )}
          </div>
        )}
        
        {developmentSites.length > 0 && (
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">
              Development Potential Sites ({developmentSites.length})
            </h4>
            <div>
              {limitedDevelopmentSites.map((site, index) => (
                <NeighborhoodSiteCard key={`dev-${index}`} site={site} />
              ))}
            </div>
            {developmentSites.length > 5 && (
              <p className="text-gray-400 text-xs mt-2">+ {developmentSites.length - 5} more sites not shown</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MessageList = ({ 
  messages, 
  isLoading, 
  handlePredefinedQuestion, 
  messagesEndRef,
  selectedModel = 'claude3' // Default to Claude 3
}) => {
  // Create a ref for the loading indicators to properly scroll to them
  const loadingIndicatorsRef = useRef(null);

  // Get model color based on selected model
  const modelColor = MODEL_COLORS[selectedModel] || '#8b5cf6'; // Default to purple if not found

  // Render model-specific avatar icon
  const getModelIcon = () => {
    switch(selectedModel) {
      case 'claude3':
        return (
          <ModelAvatar $bgColor={modelColor}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="5" fill="currentColor"/>
            </svg>
          </ModelAvatar>
        );
      case 'gpt4':
        return (
          <ModelAvatar $bgColor={modelColor}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </ModelAvatar>
        );
      case 'llama3':
        return (
          <ModelAvatar $bgColor={modelColor}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 16V8.5C20 5.46243 17.5376 3 14.5 3H9.5C6.46243 3 4 5.46243 4 8.5V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 21L12 17L15 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </ModelAvatar>
        );
      case 'deepseek':
        return (
          <ModelAvatar $bgColor={modelColor}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 18V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18.3639 5.63604L16.2426 7.75736" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7.75732 16.2426L5.63599 18.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M5.63599 5.63604L7.75731 7.75736" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16.2426 16.2426L18.3639 18.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </ModelAvatar>
        );
      default:
        return (
          <ModelAvatar $bgColor={modelColor}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="5" fill="currentColor"/>
            </svg>
          </ModelAvatar>
        );
    }
  };

  // Custom user avatar
  const userAvatar = (
    <ModelAvatar $bgColor="#2A2A2A">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M4 21V17C4 15.8954 4.89543 15 6 15H18C19.1046 15 20 15.8954 20 17V21" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </ModelAvatar>
  );

  // Effect to handle scrolling to loading indicators when needed
  useEffect(() => {
    // Only auto-scroll when:
    // 1. There's an explicit loading indicator we need to focus on
    // 2. The last message is from the user (meaning the user just sent a message)
    // This prevents auto-scrolling when AI responses come in
    const shouldAutoScroll = window.focusOnLoadingIndicators || 
                           (messages.length > 0 && messages[messages.length - 1].isUser);
    
    if (window.focusOnLoadingIndicators && loadingIndicatorsRef.current) {
      loadingIndicatorsRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (messagesEndRef.current && shouldAutoScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <ChatMessages>
      {messages.map((msg, i) => (
        <Message key={i}>
          <MessageHeader>
            {msg.isUser ? userAvatar : getModelIcon()}
            <Sender>{msg.isUser ? 'You' : 'ATLAS'}</Sender>
          </MessageHeader>
          <MessageContent>
            {msg.isUser ? msg.content : (
              <>
                {/* Processing Steps - Phase 1 - New consolidated format */}
                {msg.content.steps && Array.isArray(msg.content.steps) && (!window.currentLoadingPhase || window.currentLoadingPhase === "PHASE_1_ICONS") && (
                  <div
                    ref={i === messages.length - 1 ? loadingIndicatorsRef : null}
                  >
                    {msg.content.steps.map((step, stepIndex) => (
                      <div 
                        key={stepIndex}
                        className="flex items-center p-2 bg-gray-800 bg-opacity-50 rounded-lg mb-1 animate-pulse"
                      >
                        {step.useWhiteIcons ? (
                          <AnimatedIcon className={step.animation || 'pulse'}>
                            {/* Use SVG icons based on the icon name */}
                            {step.iconType === "svg" && step.icon === "chart" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <path d="M3 3v18h18"></path>
                                <path d="M18 17V9"></path>
                                <path d="M13 17V5"></path>
                                <path d="M8 17v-3"></path>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "map" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                                <line x1="8" y1="2" x2="8" y2="18"></line>
                                <line x1="16" y1="6" x2="16" y2="22"></line>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "route" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <circle cx="4" cy="7" r="2"></circle>
                                <circle cx="20" cy="7" r="2"></circle>
                                <circle cx="4" cy="17" r="2"></circle>
                                <circle cx="20" cy="17" r="2"></circle>
                                <path d="M4 7h16"></path>
                                <path d="M4 17h16"></path>
                                <path d="M4 7v10"></path>
                                <path d="M20 7v10"></path>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "building" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                                <line x1="9" y1="2" x2="9" y2="22"></line>
                                <line x1="15" y1="2" x2="15" y2="22"></line>
                                <line x1="4" y1="12" x2="20" y2="12"></line>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "search" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "connection" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <circle cx="5" cy="5" r="3"></circle>
                                <circle cx="19" cy="5" r="3"></circle>
                                <circle cx="12" cy="19" r="3"></circle>
                                <line x1="5" y1="8" x2="12" y2="16"></line>
                                <line x1="19" y1="8" x2="12" y2="16"></line>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "home" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "target" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="6"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                              </svg>
                            }
                            {/* New icon options */}
                            {step.iconType === "svg" && step.icon === "city" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <path d="M2 12h2v10H2V12z"></path>
                                <path d="M6 8h2v14H6V8z"></path>
                                <path d="M10 4h2v18h-2V4z"></path>
                                <path d="M14 2h2v20h-2V2z"></path>
                                <path d="M18 6h2v16h-2V6z"></path>
                                <path d="M22 12h-2v10h2V12z"></path>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "zoning" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <rect x="3" y="3" width="6" height="6"></rect>
                                <rect x="15" y="3" width="6" height="6"></rect>
                                <rect x="3" y="15" width="6" height="6"></rect>
                                <rect x="15" y="15" width="6" height="6"></rect>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "transit" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <path d="M6 9h12v7H6z"></path>
                                <path d="M19 19H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z"></path>
                                <path d="M8 19v3"></path>
                                <path d="M16 19v3"></path>
                                <path d="M9 5L7 7"></path>
                                <path d="M15 5l2 2"></path>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "analytics" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4"></path>
                                <path d="M12 8h.01"></path>
                              </svg>
                            }
                            {step.iconType === "svg" && step.icon === "infrastructure" && 
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                              </svg>
                            }
                            {step.iconType !== "svg" && step.icon}
                          </AnimatedIcon>
                        ) : (
                          <span className="text-xl mr-3">{step.icon}</span>
                        )}
                        <span className="text-gray-200">{step.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Single Processing Step - Old format (for backward compatibility) */}
                {msg.content.processingStep && !msg.content.steps && (!window.currentLoadingPhase || window.currentLoadingPhase === "PHASE_1_ICONS") && (
                  <div 
                    className="flex items-center p-2 bg-gray-800 bg-opacity-50 rounded-lg mb-1 animate-pulse"
                    ref={i === messages.length - 1 ? loadingIndicatorsRef : null}
                  >
                    {msg.content.useWhiteIcons ? (
                      <AnimatedIcon className={msg.content.animation || 'pulse'}>
                        {/* Use SVG icons based on the icon name */}
                        {msg.content.icon === "chart" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <path d="M3 3v18h18"></path>
                            <path d="M18 17V9"></path>
                            <path d="M13 17V5"></path>
                            <path d="M8 17v-3"></path>
                          </svg>
                        }
                        {msg.content.icon === "map" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                            <line x1="8" y1="2" x2="8" y2="18"></line>
                            <line x1="16" y1="6" x2="16" y2="22"></line>
                          </svg>
                        }
                        {msg.content.icon === "route" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <circle cx="4" cy="7" r="2"></circle>
                            <circle cx="20" cy="7" r="2"></circle>
                            <circle cx="4" cy="17" r="2"></circle>
                            <circle cx="20" cy="17" r="2"></circle>
                            <path d="M4 7h16"></path>
                            <path d="M4 17h16"></path>
                            <path d="M4 7v10"></path>
                            <path d="M20 7v10"></path>
                          </svg>
                        }
                        {msg.content.icon === "building" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                            <line x1="9" y1="2" x2="9" y2="22"></line>
                            <line x1="15" y1="2" x2="15" y2="22"></line>
                            <line x1="4" y1="12" x2="20" y2="12"></line>
                          </svg>
                        }
                        {msg.content.icon === "search" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                        }
                        {msg.content.icon === "connection" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <circle cx="5" cy="5" r="3"></circle>
                            <circle cx="19" cy="5" r="3"></circle>
                            <circle cx="12" cy="19" r="3"></circle>
                            <line x1="5" y1="8" x2="12" y2="16"></line>
                            <line x1="19" y1="8" x2="12" y2="16"></line>
                          </svg>
                        }
                        {msg.content.icon === "home" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                          </svg>
                        }
                        {msg.content.icon === "target" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="6"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                          </svg>
                        }
                        {/* New icon options */}
                        {msg.content.icon === "city" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <path d="M2 12h2v10H2V12z"></path>
                            <path d="M6 8h2v14H6V8z"></path>
                            <path d="M10 4h2v18h-2V4z"></path>
                            <path d="M14 2h2v20h-2V2z"></path>
                            <path d="M18 6h2v16h-2V6z"></path>
                            <path d="M22 12h-2v10h2V12z"></path>
                          </svg>
                        }
                        {msg.content.icon === "zoning" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <rect x="3" y="3" width="6" height="6"></rect>
                            <rect x="15" y="3" width="6" height="6"></rect>
                            <rect x="3" y="15" width="6" height="6"></rect>
                            <rect x="15" y="15" width="6" height="6"></rect>
                          </svg>
                        }
                        {msg.content.icon === "transit" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <path d="M6 9h12v7H6z"></path>
                            <path d="M19 19H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z"></path>
                            <path d="M8 19v3"></path>
                            <path d="M16 19v3"></path>
                            <path d="M9 5L7 7"></path>
                            <path d="M15 5l2 2"></path>
                          </svg>
                        }
                        {msg.content.icon === "analytics" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                          </svg>
                        }
                        {msg.content.icon === "infrastructure" && 
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                          </svg>
                        }
                        {(!msg.content.iconType || msg.content.iconType !== "svg") && msg.content.icon}
                      </AnimatedIcon>
                    ) : (
                    <span className="text-xl mr-3">{msg.content.icon}</span>
                    )}
                    <span className="text-gray-200">{msg.content.text}</span>
                  </div>
                )}

                {/* Skeleton Loading - Only show in Phase 2 */}
                {msg.content.showSkeleton && (!window.currentLoadingPhase || window.currentLoadingPhase === "PHASE_2_SKELETON") && (
                  <div 
                    className="p-3 transition-all duration-500 ease-in-out bg-opacity-10 bg-gray-800 rounded-lg"
                    style={{ 
                      opacity: 1,
                      animation: "fadeIn 0.5s ease-out"
                    }}
                  >
                    <p className="text-white text-lg mb-4 font-medium flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {msg.content.preGraphText}
                    </p>
                    <InterventionSkeleton />
                  </div>
                )}

                {/* Commercial Info case */}
                {msg.content.action === "showCommercialCluster" && (
                  <VisualizationDisplay 
                    visualizationType="commercialCluster"
                    data={msg.content}
                  />
                )}
                
                {/* Urban Impact Analysis case - Only show in Phase 3 */}
                {msg.content.graphData && msg.content.graphData.interventionDetails && (!window.currentLoadingPhase || window.currentLoadingPhase === "PHASE_3_CONTENT") && (
                  <AnimatedContent>
                  <VisualizationDisplay 
                    visualizationType="urbanImpact"
                    data={msg.content}
                  />
                  </AnimatedContent>
                )}
                
                {/* Service Corridors Analysis case */}
                {msg.content.graphData && msg.content.graphData.serviceDetails && (
                  <VisualizationDisplay 
                    visualizationType="serviceCorridors"
                    data={msg.content}
                  />
                )}

                {/* Infrastructure Improvements Analysis case */}
                {msg.content.graphData && msg.content.graphData.infrastructureDetails && (
                  <VisualizationDisplay 
                    visualizationType="infrastructureImprovements"
                    data={msg.content}
                  />
                )}
                
                {/* Renewable Energy Visualization case */}
                {console.log("📊 Checking for renewableEnergy type:", i, msg.content.type)}
                {msg.content.type === "renewableEnergy" && (
                  <VisualizationDisplay 
                    visualizationType="renewableEnergy"
                    data={msg.content}
                  />
                )}
                
                {/* Add handling for neighborhood data */}
                {msg.content.neighborhoodData && (
                  <NeighborhoodDataDisplay data={msg.content.neighborhoodData} />
                )}
                
                {/* Keep all existing conditional rendering */}
                {msg.content.preGraphText && !msg.content.steps && !msg.content.processingStep && (
                  <div className="text-gray-200 mb-3">
                    {msg.content.preGraphText}
                  </div>
                )}

                {/* Follow-up suggestions */}
                {msg.content.followUpSuggestions && msg.content.followUpSuggestions.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    {msg.content.followUpSuggestions.map((action, index) => (
                      <FollowUpButton 
                        key={index}
                        onClick={() => handlePredefinedQuestion(action.prompt || action.text)}
                        $animationDelay={action.animationDelay || index * 0.1}
                      >
                        {action.text}
                      </FollowUpButton>
                    ))}
                  </div>
                )}

                {/* Quick Actions */}
                {msg.content.quickActions && msg.content.quickActions.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    {msg.content.quickActions.map((action, index) => (
                      <FollowUpButton 
                        key={index}
                        onClick={() => handlePredefinedQuestion(action.prompt || action.text)}
                        $animationDelay={action.animationDelay || index * 0.1}
                      >
                        {action.text}
                      </FollowUpButton>
                    ))}
                  </div>
                )}
              </>
            )}
          </MessageContent>
        </Message>
      ))}

      {isLoading && (
        <Message>
          <MessageHeader>
            {getModelIcon()}
            <Sender>ATLAS</Sender>
          </MessageHeader>
          <MessageContent>
            <LoadingMessage>
              <LoadingStep $delay={100}>
                <AnimatedIcon className="pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                    <line x1="9" y1="2" x2="9" y2="22"></line>
                    <line x1="15" y1="2" x2="15" y2="22"></line>
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                  </svg>
                </AnimatedIcon>
                <span className="text">Analyzing neighborhood data...</span>
                <span className="dots" />
              </LoadingStep>
              <LoadingStep $delay={250}>
                <AnimatedIcon className="bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                </AnimatedIcon>
                <span className="text">Processing spatial data...</span>
                <span className="dots" />
              </LoadingStep>
              <LoadingStep $delay={400}>
                <AnimatedIcon className="wave">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                    <path d="M4 7h16"></path>
                    <path d="M4 17h16"></path>
                    <path d="M4 7v10"></path>
                    <path d="M20 7v10"></path>
                  </svg>
                </AnimatedIcon>
                <span className="text">Mapping area connections...</span>
                <span className="dots" />
              </LoadingStep>
              <LoadingStep $delay={550}>
                <AnimatedIcon className="rotate">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "white"}}>
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                </AnimatedIcon>
                <span className="text">Calculating optimization factors...</span>
                <span className="dots" />
              </LoadingStep>
              <InterventionSkeleton />
            </LoadingMessage>
          </MessageContent>
        </Message>
      )}
      <div ref={messagesEndRef} />
    </ChatMessages>
  );
};

export default MessageList; 