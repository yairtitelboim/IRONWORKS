import React, { useState } from 'react';

const FollowUpQuestions = ({ 
  aiState, 
  handleAIQuery, 
  isOSMButtonLoading,
  EXECUTIVE_QUESTIONS,
  toggleFollowupContent
}) => {
  // Track which suggestion was clicked to show loading state
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  // Handle suggestion click
  const handleSuggestionClick = (question) => {
    setSelectedSuggestion(question.id);
    handleAIQuery(question);
  };

  // Reset selected suggestion when loading completes
  React.useEffect(() => {
    if (!aiState.isLoading && selectedSuggestion) {
      setSelectedSuggestion(null);
    }
  }, [aiState.isLoading, selectedSuggestion]);

  return (
    <>
      {/* Follow-up Questions - Skeleton Animation */}
      {false && !aiState.showFollowupContent && !aiState.showFollowupButtons && !aiState.hasShownFollowup && (
        <div style={{ width: '320px' }}>
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              style={{
                width: '320px',
                height: '48px',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                marginBottom: '8px',
                animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                animationDelay: `${index * 0.3}s`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
                animation: 'shimmer 3s infinite',
                animationDelay: `${index * 0.4}s`
              }} />
            </div>
          ))}
        </div>
      )}

      {/* Down Arrow to Show Follow-up Content */}
      {aiState.responses && aiState.responses.length > 0 && !aiState.showFollowupContent && (
        <div style={{
          width: '320px',
          display: 'flex',
          justifyContent: 'center',
          marginTop: '2px',
          marginBottom: '-22px',
          position: 'relative',
          top: '-20px'
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
      {aiState.showFollowupContent && aiState.showFollowupButtons && (
        <div style={{
          opacity: aiState.showFollowupContent ? 1 : 0,
          transform: aiState.showFollowupContent ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {EXECUTIVE_QUESTIONS.followup.map((question, index) => {
            // Show logic:
            // - If loading and this is the selected suggestion: show with loading animation
            // - If loading and this is NOT the selected suggestion: hide
            // - If not loading: show all suggestions
            const shouldShow = !aiState.isLoading || selectedSuggestion === question.id;
            const isSelected = selectedSuggestion === question.id;
            
            if (!shouldShow) return null;
            
            return (
              <button
                key={question.id}
                onClick={() => handleSuggestionClick(question)}
                disabled={aiState.isLoading}
                style={{
                  width: '320px',
                  background: isSelected && aiState.isLoading ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(20px)',
                  border: isSelected && aiState.isLoading ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: aiState.isLoading ? 'not-allowed' : 'pointer',
                  transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`,
                  marginBottom: '6px',
                  textAlign: 'center',
                  opacity: aiState.isLoading && !isSelected ? 0.5 : 1,
                  boxShadow: isSelected && aiState.isLoading ? '0 12px 40px rgba(255, 255, 255, 0.2)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
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
                    e.target.style.background = isSelected && aiState.isLoading ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)';
                    e.target.style.boxShadow = isSelected && aiState.isLoading ? '0 12px 40px rgba(255, 255, 255, 0.2)' : '0 8px 32px rgba(0, 0, 0, 0.1)';
                  }
                }}
              >
                {question.text}
                
                {/* Shimmer overlay when OSM Button is loading */}
                {isOSMButtonLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.08), transparent)',
                    animation: 'buttonShimmer 3s ease-in-out infinite',
                    animationDelay: `${index * 0.4}s`
                  }} />
                )}
                
                {/* Text glow effect when OSM Button is loading */}
                {isOSMButtonLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.15), transparent)',
                    animation: 'buttonShimmer 3s ease-in-out infinite',
                    animationDelay: `${index * 0.4}s`,
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none'
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default FollowUpQuestions;
