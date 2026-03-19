import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Panel, ChatHeader, DiffusionTag } from './StyledComponents';
import { 
  handlePanelQuestion, 
  handleQuickAction, 
  handleUrbanImpactQuestion, 
  handleServiceCorridorsQuestion,
  handleInfrastructureImprovementsQuestion,
  MOCK_RESPONSES 
} from '../../../services/claude';
import { handlePanelCollapse } from '../hooks/mapAnimations';
import { Sparkles } from 'lucide-react';
import { MODEL_COLORS } from './mockData';

// Import components
import ModelSelector from './components/ModelSelector';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';
import InitialQuestions from './components/InitialQuestions';
import CollapseButton from './components/CollapseButton';

const AIChatPanel = ({ messages, setMessages, handleQuestion, map, initialCollapsed = true }) => {
  // Initialize local messages state if not provided as a prop
  const [localMessages, setLocalMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [selectedModel, setSelectedModel] = useState('claude3');
  const [isDiffusionActive, setIsDiffusionActive] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const messagesEndRef = useRef(null);
  const panelInitializedRef = useRef(false);
  const questionButtonsRef = useRef([]);
  
  // Use provided messages/setMessages if available, otherwise use local state
  const effectiveMessages = messages || localMessages;
  const effectiveSetMessages = setMessages || setLocalMessages;

  // Expose the loading state setter function globally
  useEffect(() => {
    // Make setIsLoading function accessible globally for card click interactions
    window.setAIChatPanelLoading = setIsLoading;
    
    // Also expose the setMessages function for updating messages from external components
    window.setAIChatPanelMessages = setMessages;
    
    // Add a global reference to the collapse state setter
    window.setAIChatPanelCollapsed = setIsCollapsed;
    
    // Cleanup function to remove the global references when component unmounts
    return () => {
      window.setAIChatPanelLoading = null;
      window.setAIChatPanelMessages = null;
      window.setAIChatPanelCollapsed = null;
    };
  }, [setMessages]);

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
      '0, 136, 204'; // Default fallback color
  };

  // Add toggle handler with enhanced debug logging
  const handleCollapseToggle = () => {
    
    const newState = !isCollapsed;
    
    setIsCollapsed(newState);
    
    // Log after state update
    setTimeout(() => {
    }, 0);
  };

  // Add effect to log panel state changes
  useEffect(() => {
  }, [isCollapsed]);

  // Auto-scroll effect
  useEffect(() => {
    // Only auto-scroll in these cases:
    // 1. When explicitly set by another component via focusOnLoadingIndicators
    // 2. When the most recent message is from the user (they just sent something)
    const shouldAutoScroll = 
      window.focusOnLoadingIndicators || 
      (effectiveMessages.length > 0 && effectiveMessages[effectiveMessages.length - 1].isUser);
    
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [effectiveMessages]);

  // Initialize the focusOnLoadingIndicators flag
  useEffect(() => {
    window.focusOnLoadingIndicators = false;
    
    return () => {
      window.focusOnLoadingIndicators = false;
    };
  }, []);

  // Handle panel collapse
  useEffect(() => {
    if (map && map.current) {
      handlePanelCollapse(isCollapsed, map);
    }
  }, [isCollapsed, map]);

  // Special effect for initial load - runs only once on component mount
  useEffect(() => {
    if (!panelInitializedRef.current) {
      setIsCollapsed(true);
      
      // Try multiple times to ensure it stays collapsed during initialization
      const applyCollapse = () => {
        if (map && map.current) {
          handlePanelCollapse(true, map);
        }
      };
      
      // Apply immediately
      applyCollapse();
      
      // And also after short delays to ensure it applies after any other initialization
      const timers = [
        setTimeout(applyCollapse, 100),
        setTimeout(applyCollapse, 500),
        setTimeout(applyCollapse, 1000)
      ];
      
      panelInitializedRef.current = true;
      
      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [map]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    // Emit an event to throttle animations during AI processing
    if (window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
      window.mapEventBus.emit('ai:processing', { action: 'question', text: inputValue });
    }
    
    const question = inputValue.trim();
    setInputValue('');
    
    // When user submits a question, open the panel if it's closed
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    
    await handlePanelQuestion(question, map, effectiveSetMessages, setIsLoading);
  };

  const handleModelChange = (e) => {
    
    const newModel = e.target.value;
    const modelColor = MODEL_COLORS[newModel];
    
    
    // Set loading UI for model selector only
    const modelSelectContainer = document.querySelector('.model-select-container');
    if (modelSelectContainer) {
      modelSelectContainer.classList.add('loading');
    } else {
    }
    
    // Update all buttons simultaneously with the new color
    document.querySelectorAll('.initial-question').forEach((button, index) => {
      
      // Update the CSS variable for RGB
      const rgbValue = hexToRgb(modelColor);
      button.style.setProperty('--model-color-rgb', rgbValue);
      
      // Update the background gradients directly 
      button.style.background = `linear-gradient(135deg, ${modelColor}20, ${modelColor}20)`;
      button.style.setProperty('--hover-gradient', `linear-gradient(135deg, ${modelColor}30, ${modelColor}40)`);
      
      // Update accent colors - this will persist as the stroke color
      button.style.setProperty('--accent-color', modelColor);
      button.style.setProperty('--icon-glow', modelColor);
      
      // Directly style the accent line (::before pseudo-element)
      button.style.borderColor = `${modelColor}30`;
      
      // Special handling for the "See more options" button
      if (button.textContent.trim().includes("See more options")) {
        button.style.setProperty('--see-more-bg', `linear-gradient(135deg, ${modelColor}20, ${modelColor}30)`);
        button.style.setProperty('--see-more-hover-bg', `linear-gradient(135deg, ${modelColor}30, ${modelColor}40)`);
        button.style.borderColor = `${modelColor}40`;
      }
      
      // Apply highlight effect
      button.classList.add('model-highlight');
    });
    
    // Update icon colors
    document.querySelectorAll('.QuestionIcon').forEach((icon, index) => {
      icon.style.color = modelColor;
    });
    
    // Apply the new model selection WITHOUT updating React state yet
    document.querySelectorAll('.model-select').forEach(select => {
      select.value = newModel;
    });
    
    // Use a single timeout for the entire animation - longer duration for visibility
    setTimeout(() => {
      
      // Update the React state
      requestAnimationFrame(() => {
        setSelectedModel(newModel);
      });
      
      // Remove loading UI for model selector
      if (modelSelectContainer) {
        modelSelectContainer.classList.remove('loading');
      }
      
      // After a longer delay, remove ONLY the highlight effect
      // but preserve the color changes
      setTimeout(() => {
        document.querySelectorAll('.initial-question').forEach((button, index) => {
          button.classList.remove('model-highlight');
          
          // Add a persistent style class for the accent
          button.classList.add('model-accent-active');
          
          // Ensure the ::before element keeps the accent color
          const computedStyle = window.getComputedStyle(button, '::before');
          if (computedStyle) {
            button.style.setProperty('--accent-color', modelColor);
          }
        });
      }, 400); // Increased from 100ms to 400ms to match the animation duration
    }, 400); // Increased from 100ms to 400ms
  };

  // Add a safe question handler for predefined questions - wrapped in useCallback to maintain reference
  const handlePredefinedQuestion = useCallback(async (questionText) => {
    
    // When user clicks a question, open the panel if it's closed
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    
    try {
      // Get a valid map reference with enhanced logging
      const directMapRef = map;
      const windowMapRef = window.mapComponent && window.mapComponent.map;
      
      
      // Use the most reliable map reference
      let effectiveMap = directMapRef || windowMapRef;
      
      // Special case for urban impact question
      if (questionText === "Finding Downtown parcels with the highest emergency resilience potential...") {
        
        // If window.mapComponent exists, try to load Scene01
        if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
          window.mapComponent.loadSceneByName("Scene01");
        }
        
        // Add the user question to messages
        effectiveSetMessages(prev => {
          const prevMessages = Array.isArray(prev) ? prev : [];
          return [
            ...prevMessages,
            { isUser: true, content: questionText }
          ];
        });
        
        await handleUrbanImpactQuestion(questionText, effectiveMessages, effectiveSetMessages, setIsLoading);
        return;
      }
      
      // Special case for service corridors question
      if (questionText === "Show potential service corridors around Skid Row") {
        
        // Load the scene immediately before waiting for the service corridors response
        if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
          window.mapComponent.loadSceneByName("Zoning");
        }
        
        // Use Promise.resolve to make this non-blocking
        Promise.resolve().then(() => {
          handleServiceCorridorsQuestion(effectiveMap, effectiveSetMessages, setIsLoading);
        });
        return;
      }
      
      // Special case for Solar Potential Analysis button
      if (questionText === "SHOW_SOLAR_POTENTIAL") {
        
        // Show a notification
        const notification = document.createElement('div');
        notification.textContent = "Loading solar potential analysis...";
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
        
        // Specifically load the "Next" scene as requested
        if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
          window.mapComponent.loadSceneByName("Next");
          
          // Update the AI panel with a message about the solar potential analysis
          effectiveSetMessages(prev => [
            ...prev,
            { isUser: true, content: "View Solar Potential Analysis" },
            { 
              isUser: false, 
              content: { 
                preGraphText: "Loading detailed solar potential analysis for Los Angeles neighborhoods...",
                postGraphText: "This visualization shows the rooftop solar capacity and potential energy generation across different areas. The highlighted regions indicate optimal locations for new solar installations."
              }
            }
          ]);
        }
        
        // Remove the notification after animation completes
        setTimeout(() => {
          document.body.removeChild(notification);
          document.head.removeChild(style);
        }, 2500);
        
        return;
      }
      
      // Special case for infrastructure improvements question
      if (questionText === "What infrastructure improvements would have most impact in Skid Row?") {
        
        // Load the Next scene immediately
        if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
          window.mapComponent.loadSceneByName("Next");
        }
        
        // Use Promise.resolve to make this non-blocking
        Promise.resolve().then(() => {
          handleInfrastructureImprovementsQuestion(effectiveMap, effectiveSetMessages, setIsLoading);
        });
        return;
      }
      
      // For hardcoded questions like "Where are the major flood-prone areas?", 
      // we can directly use the mock response if available
      if (questionText === "Where are the major flood-prone areas?" && 
          MOCK_RESPONSES && MOCK_RESPONSES[questionText]) {
        effectiveSetMessages(prev => [
          ...prev,
          { isUser: true, content: questionText },
          { isUser: false, content: JSON.parse(MOCK_RESPONSES[questionText].content[0].text) }
        ]);
        return;
      }
      
      await handlePanelQuestion(questionText, effectiveMap, effectiveSetMessages, setIsLoading);
    } catch (error) {
      console.error('Error in handlePredefinedQuestion:', error);
      effectiveSetMessages(prev => [...prev, {
        isUser: false,
        content: { 
          preGraphText: "Sorry, I encountered an error processing your request.", 
          postGraphText: "Please try again or select another question." 
        }
      }]);
    }
  }, [isCollapsed, map, selectedModel, effectiveMessages, effectiveSetMessages]);

  // Dependencies for handlePredefinedQuestion are tracked above

  // Add handler for the diffusion tag click
  const handleDiffusionClick = () => {
    
    if (!isDiffusionActive) {
      // Force state updates to be synchronous for animation
      setIsBlinking(true);
      
      // After animation completes, update active state and reset blinking
      setTimeout(() => {
        setIsDiffusionActive(true);
        
        // Small delay before removing blinking class to ensure it completes
        setTimeout(() => {
          setIsBlinking(false);
        }, 50);
        
      }, 300); // Animation duration
    } else {
      // When turning off, just update the state without blinking
      setIsDiffusionActive(false);
    }
  };

  return (
    <>
      <Panel 
        $isCollapsed={isCollapsed}
        style={{ willChange: 'transform' }}
      >
        <ChatHeader>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
            <ModelSelector 
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
            />
            <DiffusionTag 
              className={`${isDiffusionActive ? 'active' : ''} ${isBlinking ? 'blinking' : ''}`}
              onClick={handleDiffusionClick}
            >
              Diffusion
            </DiffusionTag>
          </div>
        </ChatHeader>

        {effectiveMessages.length === 0 ? (
          <InitialQuestions
            handlePredefinedQuestion={handlePredefinedQuestion}
            selectedModel={selectedModel}
            isDiffusionActive={isDiffusionActive}
            key={`questions-${isDiffusionActive ? 'diffusion' : 'normal'}`}
          />
        ) : (
          <MessageList
            messages={effectiveMessages}
            isLoading={isLoading}
            handlePredefinedQuestion={handlePredefinedQuestion}
            messagesEndRef={messagesEndRef}
            selectedModel={selectedModel}
            isDiffusionActive={isDiffusionActive}
          />
        )}

        <InputArea
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSubmit={handleSubmit}
        />
      </Panel>

      <CollapseButton 
        isCollapsed={isCollapsed}
        handleCollapseToggle={handleCollapseToggle}
      />
    </>
  );
};

export default AIChatPanel;
