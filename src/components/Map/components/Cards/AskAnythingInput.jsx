import React, { useEffect, useState } from 'react';
import { logSearch } from '../../../../services/analyticsApi';
import { logUiEvent } from '../../../../services/uiEvents';

const AskAnythingInput = ({ onSubmit, isLoading, disabled, onToggleSuggestions, hasShimmered, isQuickQuestionsOpen, onCloseSuggestions, onSetProcessingQuestion, placeholder = "Search Texas Grid...", isPerplexityMode = false, disableShimmer = false }) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isMenuOpenMobile, setIsMenuOpenMobile] = useState(false);
  const expandedWidth = 320;
  const compressedWidth = 150;
  const anchoredLeftShift = (expandedWidth - compressedWidth) / 2;

  useEffect(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (!isMobileViewport) {
      setIsMenuOpenMobile(false);
      return;
    }

    const handleMapMenuToggle = (event) => {
      const open = !!event?.detail?.open;
      setIsMenuOpenMobile(open);
    };

    window.addEventListener('map:menu:toggle', handleMapMenuToggle);
    return () => window.removeEventListener('map:menu:toggle', handleMapMenuToggle);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading && !disabled) {
      // Add data center context to custom questions
      const enhancedQuery = inputValue.trim();
      
      console.log('🎯 Custom question submitted:', enhancedQuery);
      // Legacy analytics (raw query). Keep for now, but prefer privacy-preserving ui_events.
      logSearch(enhancedQuery, {
        queryType: isPerplexityMode ? 'perplexity' : 'address',
        source: 'ask_anything',
      });

      // Privacy-preserving logging: server hashes query.
      logUiEvent({
        event_type: 'search',
        asset_type: null,
        county: null,
        state: null,
        query_text: enhancedQuery
      });

      // Set processing state to prevent animations
      if (onSetProcessingQuestion) {
        onSetProcessingQuestion(true);
      }
      
      // Close suggestions panel when custom question is submitted
      if (onCloseSuggestions) {
        onCloseSuggestions();
      }
      
      // Execute query immediately
      onSubmit({
        id: 'custom_question',
        text: enhancedQuery,
        query: enhancedQuery,
        isCustom: true
      });
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div
      data-tour="search-bar"
      style={{
        width: isMenuOpenMobile ? `${compressedWidth}px` : `${expandedWidth}px`,
        maxWidth: 'calc(100vw - 24px)',
        marginBottom: '0px',
        position: 'relative',
        transform: isMenuOpenMobile ? `translateX(-${anchoredLeftShift}px)` : 'translateX(0)',
        transition: 'width 0.25s ease, transform 0.25s ease'
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: isPerplexityMode ? 
            (isFocused ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.35)') : 
            (isQuickQuestionsOpen ? 'rgba(55, 65, 81, 0.95)' : 'rgba(55, 65, 81, 0.9)'),
          border: isPerplexityMode ? 
            (isFocused ? '1px solid rgba(59, 130, 246, 0.6)' : '1px solid rgba(59, 130, 246, 0.3)') :
            (isFocused ? '1px solid rgba(255, 255, 255, 0.4)' : isQuickQuestionsOpen ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)'),
          borderRadius: '24px',
          padding: '12px 16px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isPerplexityMode ?
            (isFocused ? '0 8px 32px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.3)' : '0 6px 24px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2)') :
            (isFocused ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)' : isQuickQuestionsOpen ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.2)'),
          overflow: 'hidden'
        }}>
          {/* Shimmer effect overlay - triggers only on first appearance */}
          {!hasShimmered && !disableShimmer && (
            <div style={{
              position: 'absolute',
              top: '0px',
              left: '0px',
              right: '0px',
              bottom: '0px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              animation: 'questionCardShimmer 1.5s ease-out forwards',
              pointerEvents: 'none',
              borderRadius: '24px',
              zIndex: 1
            }} />
          )}

          {/* Toggle Icon - Left (Plus when closed, X when open, or Perplexity icon) */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              marginRight: '12px',
              cursor: isPerplexityMode ? 'default' : 'pointer',
              opacity: 0.8,
              transition: 'all 0.2s ease',
              borderRadius: '50%',
              background: isPerplexityMode ? 
                'rgba(59, 130, 246, 0.2)' : 
                (isQuickQuestionsOpen ? 'rgba(255, 255, 255, 0.1)' : 'transparent'),
              boxShadow: isPerplexityMode ? 
                '0 0 8px rgba(59, 130, 246, 0.3)' : 
                (isQuickQuestionsOpen ? '0 0 8px rgba(255, 255, 255, 0.2)' : 'none')
            }}
            onMouseEnter={(e) => {
              if (!isPerplexityMode) {
                e.target.style.opacity = '1';
                if (isQuickQuestionsOpen) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.3)';
                }
              }
            }}
            onMouseLeave={(e) => {
              if (!isPerplexityMode) {
                e.target.style.opacity = '0.8';
                if (isQuickQuestionsOpen) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.2)';
                } else {
                  e.target.style.background = 'transparent';
                  e.target.style.boxShadow = 'none';
                }
              }
            }}
            onClick={isPerplexityMode ? undefined : onToggleSuggestions}
            title={isPerplexityMode ? "Perplexity AI Mode" : (isQuickQuestionsOpen ? "Click to hide quick questions" : "Click to show quick questions")}
          >
            <span style={{
              color: isPerplexityMode ? '#3b82f6' : 'white',
              fontSize: isPerplexityMode ? '14px' : '16px',
              fontWeight: 'bold',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isQuickQuestionsOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              display: 'inline-block'
            }}>
              {isPerplexityMode ? '🧠' : '+'}
            </span>
          </div>

          {/* Input Field - Center */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyPress={handleKeyPress}
            placeholder={isMenuOpenMobile ? 'Search...' : placeholder}
            disabled={isLoading || disabled}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '16px', // 16px prevents mobile browser auto-zoom on focus (Safari, Chrome, etc.)
              fontWeight: '400',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              caretColor: 'white'
            }}
          />

          {/* Right Icons Container */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '12px'
          }}>
            {/* Microphone Icon - White Outline */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              opacity: 0.8,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '1'}
            onMouseLeave={(e) => e.target.style.opacity = '0.8'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>

            {/* Sound Wave Icon in Circular Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              background: 'rgba(75, 85, 99, 0.9)', // Dark gray background
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(100, 110, 120, 0.6)' // Slightly lighter gray ring
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(75, 85, 99, 1)';
              e.target.style.transform = 'scale(1.1)';
              e.target.style.border = '1px solid rgba(100, 110, 120, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(75, 85, 99, 0.9)';
              e.target.style.transform = 'scale(1)';
              e.target.style.border = '1px solid rgba(100, 110, 120, 0.6)';
            }}
            >
              {/* Five vertical lines of varying heights - sound wave/equalizer */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '12px'
              }}>
                <div style={{
                  width: '1px',
                  height: '6px',
                  background: 'white',
                  borderRadius: '0.5px'
                }} />
                <div style={{
                  width: '1px',
                  height: '9px',
                  background: 'white',
                  borderRadius: '0.5px'
                }} />
                <div style={{
                  width: '1px',
                  height: '12px',
                  background: 'white',
                  borderRadius: '0.5px'
                }} />
                <div style={{
                  width: '1px',
                  height: '9px',
                  background: 'white',
                  borderRadius: '0.5px'
                }} />
                <div style={{
                  width: '1px',
                  height: '6px',
                  background: 'white',
                  borderRadius: '0.5px'
                }} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AskAnythingInput;
