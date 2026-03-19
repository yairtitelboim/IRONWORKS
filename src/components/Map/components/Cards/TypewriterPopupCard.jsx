import React, { useState, useEffect } from 'react';

/**
 * TYPEWRITER ANIMATION IMPLEMENTATION
 * 
 * Creates realistic typing effect with blinking cursor on dark-themed popup cards
 * Enhanced for Pinal County infrastructure analysis popups
 */

// ==========================================
// 1. ANIMATION CONFIGURATION
// ==========================================

const TYPEWRITER_CONFIG = {
  // Speed & Timing
  typingSpeed: 1,               // Halved delay for ~2x speed (faster typing)
  blinkDuration: '1s',          // Cursor blink cycle
  
  // Visual Elements
  cursorChar: '|',              // Pipe character for cursor
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '12px',             // Slightly larger for readability
  lineHeight: '1.4',            // Comfortable line spacing
  
  // Colors by Theme
  themes: {
    green: {
      background: 'rgba(17, 24, 39, 0.96)',  // Dark background matching existing
      border: '#10b981',                      // Green border (emerald-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#10b981',                   // Bright green for bold
      cursorColor: '#10b981'                  // Green cursor
    },
    blue: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#3b82f6',                      // Blue border (blue-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#3b82f6',                   // Bright blue for bold
      cursorColor: '#3b82f6'                  // Blue cursor
    },
    purple: {
      background: 'rgba(17, 24, 39, 0.96)',  // Same dark background
      border: '#7c3aed',                      // Purple border (violet-500)
      textColor: '#d1d5db',                   // Light gray text
      boldColor: '#7c3aed',                   // Bright purple for bold
      cursorColor: '#7c3aed'                  // Purple cursor
    },
    red: {
      background: 'rgba(220, 38, 38, 0.95)',  // Red background matching teardrop marker (#dc2626)
      border: '#dc2626',                      // Red border
      textColor: '#ffffff',                   // White text for contrast
      boldColor: '#fca5a5',                   // Light red for bold
      cursorColor: '#fca5a5'                  // Light red cursor
    },
    orange: {
      background: 'rgba(249, 115, 22, 0.95)',  // Orange background matching teardrop marker (#f97316)
      border: '#f97316',                      // Orange border
      textColor: '#ffffff',                   // White text for contrast
      boldColor: '#fdba74',                   // Light orange for bold
      cursorColor: '#fdba74'                  // Light orange cursor
    }
  }
};

// ==========================================
// 2. TYPEWRITER ANIMATION LOGIC
// ==========================================

// Utility to reduce description length by ~50% while preserving sentence boundaries when possible
const reduceDescriptionByHalf = (text) => {
  if (!text || typeof text !== 'string') return text;
  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) {
    // Fallback: truncate words by half
    const words = text.split(/\s+/);
    const halfWordCount = Math.max(1, Math.ceil(words.length / 2));
    return words.slice(0, halfWordCount).join(' ');
  }
  const halfCount = Math.max(1, Math.ceil(sentences.length / 2));
  return sentences.slice(0, halfCount).join(' ');
};

const useTypewriterAnimation = (content, shouldStart = true, enableTypewriter = true) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showToggleBall, setShowToggleBall] = useState(false);

  // Main typewriter effect
  useEffect(() => {
    if (content?.description && shouldStart && !isTyping) {
      const reduced = reduceDescriptionByHalf(content.description);
      if (enableTypewriter) {
        // Typewriter animation
        setIsTyping(true);
        setDisplayedText('');
        
        const fullText = reduced;
        let currentIndex = 0;
        
        const typeNextChar = () => {
          if (currentIndex < fullText.length) {
            // Add one character at a time
            setDisplayedText(fullText.slice(0, currentIndex + 1));
            currentIndex++;
            
            // Schedule next character
            setTimeout(typeNextChar, TYPEWRITER_CONFIG.typingSpeed);
          } else {
            // Animation complete
            setIsTyping(false);
            
            // Show interactive toggle ball if data exists
            if (content?.data && Object.keys(content.data).length > 0) {
              setTimeout(() => setShowToggleBall(true), 500); // Delay for effect
            }
          }
        };
        
        typeNextChar(); // Start the animation
      } else {
        // Show text immediately without animation
        setDisplayedText(reduced);
        setIsTyping(false);
        
        // Show interactive toggle ball if data exists
        if (content?.data && Object.keys(content.data).length > 0) {
          setTimeout(() => setShowToggleBall(true), 100); // Shorter delay for immediate display
        }
      }
    }
  }, [content?.description, shouldStart, enableTypewriter]);

  return { displayedText, isTyping, showToggleBall };
};

// ==========================================
// 3. CSS ANIMATIONS (Injected Dynamically)
// ==========================================

const TYPEWRITER_CSS = `
  /* Blinking cursor animation */
  @keyframes blink {
    0%, 50% { opacity: 1; }      /* Visible for first half */
    51%, 100% { opacity: 0; }    /* Hidden for second half */
  }
  
  /* Pulsing toggle ball (appears after typing) */
  @keyframes toggleBallPulse {
    0%, 100% { 
      opacity: 0.7;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.1);       /* 10% size increase */
    }
  }
  
  /* Data expansion animations */
  @keyframes dataRowsSlideIn {
    0% {
      max-height: 0;
      opacity: 0;
      transform: translateY(-10px);
    }
    100% {
      max-height: 200px;
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes dataRowFadeIn {
    0% {
      opacity: 0;
      transform: translateX(-5px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

// ==========================================
// 4. TEXT RENDERING WITH MARKDOWN SUPPORT
// ==========================================

const renderTypewriterText = (displayedText, isTyping, theme) => {
  // Validate theme
  const validTheme = TYPEWRITER_CONFIG.themes[theme] ? theme : 'green';
  const themeConfig = TYPEWRITER_CONFIG.themes[validTheme];
  
  return (
    <p style={{
      margin: '0 0 8px 0',
      fontSize: TYPEWRITER_CONFIG.fontSize,
      color: themeConfig.textColor,
      lineHeight: TYPEWRITER_CONFIG.lineHeight,
      fontFamily: TYPEWRITER_CONFIG.fontFamily,
      position: 'relative'
    }}>
      {/* Parse **bold** markdown syntax */}
      {displayedText.split('**').map((part, index) => {
        if (index % 2 === 1) {
          // Bold text (between ** markers)
          return (
            <span key={index} style={{
              fontWeight: 'bold',
              color: themeConfig.boldColor
            }}>
              {part}
            </span>
          );
        }
        return part; // Regular text
      })}
      
      {/* Blinking cursor (only shown while typing) */}
      {isTyping && (
        <span style={{
          color: themeConfig.cursorColor,
          animation: `blink ${TYPEWRITER_CONFIG.blinkDuration} infinite`
        }}>
          {TYPEWRITER_CONFIG.cursorChar}
        </span>
      )}
    </p>
  );
};

// ==========================================
// 5. INTERACTIVE TOGGLE BALL
// ==========================================

const ToggleBall = ({ theme, onClick }) => {
  // Validate theme
  const validTheme = TYPEWRITER_CONFIG.themes[theme] ? theme : 'green';
  const themeConfig = TYPEWRITER_CONFIG.themes[validTheme];
  
  return (
    <span 
      onClick={onClick}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        backgroundColor: themeConfig.boldColor,
        borderRadius: '50%',
        marginLeft: '4px',
        cursor: 'pointer',
        animation: 'toggleBallPulse 2s ease-in-out infinite',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'scale(1.2)'; // 20% larger on hover
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'scale(1)';   // Return to normal
      }}
      title="Click to expand data"
    />
  );
};

// ==========================================
// 6. MAIN COMPONENT
// ==========================================

const TypewriterPopupCard = ({ 
  content, 
  theme = 'green',
  header = null,
  shouldStart = true,
  enableTypewriter = true,
  style = {}
}) => {
  const { displayedText, isTyping, showToggleBall } = useTypewriterAnimation(content, shouldStart, enableTypewriter);
  const [isDataExpanded, setIsDataExpanded] = useState(false);

  // Validate and normalize theme to ensure it exists in TYPEWRITER_CONFIG.themes
  const validTheme = TYPEWRITER_CONFIG.themes[theme] ? theme : 'green';
  const themeConfig = TYPEWRITER_CONFIG.themes[validTheme];

  // Inject CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = TYPEWRITER_CSS;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{
      width: '238px', // Reduced by 15% from 280px
      minHeight: '120px',
      backgroundColor: themeConfig.background,
      border: `1px solid ${themeConfig.border}`,
      borderRadius: '10px',
      padding: '0',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
      fontFamily: TYPEWRITER_CONFIG.fontFamily,
      overflow: 'hidden',
      ...style
    }}>
      {/* Header (if provided) */}
      {header && (
        <div style={{
          padding: '12px 15px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {header}
        </div>
      )}
      
      {/* Content area */}
      <div style={{ padding: '12px 15px' }}>
        {/* Typewriter text with cursor */}
        {content?.description && renderTypewriterText(displayedText, isTyping, validTheme)}
        
        {/* Interactive toggle ball (appears after typing) */}
        {showToggleBall && !isTyping && (
          <ToggleBall 
            theme={validTheme} 
            onClick={() => setIsDataExpanded(!isDataExpanded)} 
          />
        )}
        
        {/* Expandable data section */}
        {isDataExpanded && content?.data && (
          <div style={{ 
            animation: 'dataRowsSlideIn 0.5s ease-out',
            overflow: 'hidden',
            marginTop: '10px'
          }}>
            {Object.entries(content.data).map(([key, value], index) => (
              <div key={key} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                columnGap: '12px',
                fontSize: '11px',
                lineHeight: '1.5',
                marginBottom: '8px',
                animation: `dataRowFadeIn 0.3s ease-out ${index * 0.1}s both`
              }}>
                <span style={{ 
                  color: '#9ca3af',
                  minWidth: '100px',
                  flexShrink: 0
                }}>{key}:</span>
                <span style={{ 
                  color: themeConfig.boldColor,
                  fontWeight: '500',
                  flex: 1,
                  wordWrap: 'break-word'
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export { TypewriterPopupCard, TYPEWRITER_CONFIG };
