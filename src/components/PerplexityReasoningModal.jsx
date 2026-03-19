import React, { useState, useEffect } from 'react';

const PerplexityReasoningModal = ({ isOpen, onClose, reasoningData, neighborhoodName }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isShowingPrompt, setIsShowingPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [collapsedSources, setCollapsedSources] = useState(new Set());
  const [isMainSourcesCollapsed, setIsMainSourcesCollapsed] = useState(true);

  // Extract the analysis text from various possible sources
  const getAnalysisText = () => {
    if (!reasoningData) return 'No analysis available.';
    
    // Try different possible property names for the analysis text
    const analysisText = reasoningData.analysis || 
                        reasoningData.reasoning || 
                        reasoningData.content ||
                        reasoningData.message ||
                        reasoningData;
    
    // If it's an object, try to extract text from it
    if (typeof analysisText === 'object' && analysisText !== null) {
      return analysisText.content || 
             analysisText.text || 
             analysisText.analysis ||
             JSON.stringify(analysisText, null, 2);
    }
    
    // Handle string values
    if (typeof analysisText === 'string' && analysisText.trim()) {
      return analysisText;
    }
    
    // If we have raw data but no clear text, show a helpful message
    if (reasoningData && Object.keys(reasoningData).length > 0) {
      return `Analysis data received but no readable text found. Raw data: ${JSON.stringify(reasoningData, null, 2)}`;
    }
    
    return 'No analysis available.';
  };


  // Function to generate focused query for this area
  const generateFocusedQuery = () => {
    // Extract risk data from reasoningData if available
    const riskLevel = reasoningData?.rawData?.riskLevel || '88';
    const timeline = reasoningData?.rawData?.timeline || '18';
    const radius = reasoningData?.rawData?.radius || '1500';
    
    return `Analyze the gentrification risk for the ${neighborhoodName} area in Houston, specifically focusing on:

- Current gentrification risk: ${riskLevel}%
- Timeline to unaffordability: ${timeline} months  
- Impact radius: ${radius}m
- Neighborhood characteristics and development patterns
- FIFA investment impact on this specific area
- Recent market trends and displacement factors

Provide a detailed analysis of why this area is at high risk and what specific factors are driving gentrification pressure. Focus on actionable insights and recent developments.`;
  };

  // Function to handle refresh button click
  const handleRefreshClick = () => {
    if (!isShowingPrompt) {
      // When switching to prompt mode, initialize the edited prompt
      setEditedPrompt(generateFocusedQuery());
    }
    setIsShowingPrompt(!isShowingPrompt);
  };

  // Function to handle send analysis
  const handleSendAnalysis = async () => {
    setIsLoading(true);
    
    // Add the prompt to chat history as a user message
    const userMessage = {
      type: 'user',
      content: editedPrompt || generateFocusedQuery(),
      timestamp: Date.now()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentResponse({ type: 'loading', content: '' });
    
    try {
      const focusedQuery = editedPrompt || generateFocusedQuery();
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch('/api/perplexity-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: focusedQuery,
          neighborhood: neighborhoodName,
          riskLevel: reasoningData?.rawData?.riskLevel || '88',
          timeline: reasoningData?.rawData?.timeline || '18',
          radius: reasoningData?.rawData?.radius || '1500'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Update the reasoning data with new analysis
      const newAnalysisText = data.analysis || data.choices?.[0]?.message?.content || 'Analysis updated successfully.';
      const newCitations = data.citations || [];
      
      // Add the response to chat history
      const assistantMessage = {
        type: 'assistant',
        content: newAnalysisText,
        sources: newCitations.map(citation => ({
          title: citation.title || citation.url?.split('/').pop() || 'Source',
          url: citation.url || citation
        })),
        timestamp: Date.now()
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      
      // Add a small delay to ensure skeleton is visible
      setTimeout(() => {
        setCurrentResponse(null);
      }, 500);
      
      // Update the reasoning data
      const updatedReasoningData = {
        ...reasoningData,
        analysis: newAnalysisText,
        reasoning: newAnalysisText,
        sources: newCitations.map(citation => ({
          title: citation.title || citation.url?.split('/').pop() || 'Source',
          url: citation.url || citation
        }))
      };
      
      // Dispatch event to update the parent component
      const event = new CustomEvent('updateReasoningData', {
        detail: updatedReasoningData
      });
      window.dispatchEvent(event);
      
      setIsShowingPrompt(false);
      
    } catch (error) {
      console.error('❌ Error sending analysis:', error);
      
      let errorMessage = 'An unexpected error occurred.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The analysis is taking longer than expected. Please try again.';
      } else if (error.message.includes('504')) {
        errorMessage = 'Server timeout. The analysis request is taking too long. Please try again with a shorter prompt.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (error.message.includes('404')) {
        errorMessage = 'API endpoint not found. Please check the server configuration.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your API permissions.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      // Add error message to chat history
      const errorChatMessage = {
        type: 'assistant',
        content: errorMessage,
        isError: true,
        timestamp: Date.now()
      };
      
      setChatHistory(prev => [...prev, errorChatMessage]);
      
      // Add a small delay to ensure skeleton is visible
      setTimeout(() => {
        setCurrentResponse(null);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };


  // Function to toggle sources collapse
  const toggleSourcesCollapse = (messageIndex) => {
    setCollapsedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  // Function to toggle main sources section
  const toggleMainSources = () => {
    setIsMainSourcesCollapsed(!isMainSourcesCollapsed);
  };


  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = React.useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible, handleKeyDown]);

  if (!isVisible) return null;

  return (
    <>
      {/* Add skeleton animation styles */}
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% {
            opacity: 0.3;
            transform: scaleX(1);
          }
          50% {
            opacity: 0.8;
            transform: scaleX(1.01);
          }
        }
      `}</style>
    <div
      className="perplexity-modal-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="perplexity-modal-content"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.98)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          color: 'white',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#93c5fd',
              margin: 0,
              marginBottom: '4px',
            }}>
              PERPLEXITY REASONING
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: 0,
            }}>
              {neighborhoodName || 'Houston Area'} - Detailed Analysis
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Refresh Button */}
            <button
              onClick={handleRefreshClick}
              disabled={isLoading}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                opacity: isLoading ? 0.5 : 1,
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.target.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.target.style.color = '#93c5fd';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.target.style.color = '#60a5fa';
                }
              }}
              title={isShowingPrompt ? "Show current analysis" : "Refresh analysis for this area"}
            >
{isLoading ? '⏳' : isShowingPrompt ? '📄' : '↻'}
            </button>
            
            {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
            title="Close"
          >
            ×
          </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {isShowingPrompt ? (
            /* Chat Interface */
            <div style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '12px',
            }}>
              {/* Chat Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: '600' }}>CHAT</div>
              </div>
              
              {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minHeight: chatHistory.length > 0 ? '250px' : '80px',
                maxHeight: chatHistory.length > 0 ? '350px' : '120px',
                transition: 'all 0.3s ease',
              }}>
                {/* Chat History */}
                {chatHistory.length > 0 ? (
                  chatHistory.map((message, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    {/* User Message */}
                    {message.type === 'user' && (
                      <div style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#d1d5db',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                        whiteSpace: 'pre-wrap',
                        opacity: 0.7, // Gray out sent messages
                      }}>
                        {message.content}
                      </div>
                    )}
                    
                    {/* Assistant Message */}
                    {message.type === 'assistant' && (
                      <div style={{
                        alignSelf: 'flex-start',
                        maxWidth: '95%',
                        background: message.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                        border: `1px solid ${message.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        color: message.isError ? '#fca5a5' : '#e5e7eb',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {message.content}
                        
                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <div 
                              onClick={() => toggleSourcesCollapse(index)}
                              style={{ 
                                fontSize: '12px', 
                                color: '#93c5fd', 
                                fontWeight: '600', 
                                marginBottom: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'color 0.2s ease',
                              }}
                              onMouseOver={(e) => {
                                e.target.style.color = '#60a5fa';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.color = '#93c5fd';
                              }}
                            >
                              <span>SOURCES ({message.sources.length})</span>
                              <span style={{ 
                                fontSize: '10px',
                                transition: 'transform 0.2s ease',
                                transform: collapsedSources.has(index) ? 'rotate(0deg)' : 'rotate(90deg)'
                              }}>
                                ▶
                              </span>
                            </div>
                            {!collapsedSources.has(index) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {message.sources.map((source, sourceIndex) => (
                                  <a
                                    key={sourceIndex}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontSize: '11px',
                                      color: '#60a5fa',
                                      textDecoration: 'none',
                                      padding: '4px 8px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(59, 130, 246, 0.2)',
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseOver={(e) => {
                                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                                      e.target.style.textDecoration = 'underline';
                                    }}
                                    onMouseOut={(e) => {
                                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                      e.target.style.textDecoration = 'none';
                                    }}
                                  >
                                    {source.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
                ) : (
                  /* Empty State - Collapsed Placeholder */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '11px',
                    textAlign: 'center',
                    padding: '12px',
                    minHeight: '60px',
                  }}>
                    <div style={{
                      fontSize: '18px',
                      marginBottom: '6px',
                      opacity: 0.5,
                    }}>
                      💬
                    </div>
                    <div style={{ marginBottom: '2px', fontSize: '10px' }}>
                      No conversation yet
                    </div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>
                      Click SEND to start the analysis
                    </div>
                  </div>
                )}
                
                {/* Loading Response */}
                {currentResponse && (
                  <div style={{
                    alignSelf: 'flex-start',
                    width: '100%',
                    maxWidth: '100%',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '20px',
                    marginTop: '12px',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '12px',
                      marginBottom: '12px',
                      fontWeight: '500',
                    }}>
                      Generating response...
                    </div>
                    {/* Skeleton Animation */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      <div style={{
                        width: '100%',
                        height: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        animation: 'skeletonPulse 1.5s ease-in-out infinite',
                        boxSizing: 'border-box',
                      }}></div>
                      <div style={{
                        width: '90%',
                        height: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        animation: 'skeletonPulse 1.5s ease-in-out infinite',
                        animationDelay: '0.2s',
                        boxSizing: 'border-box',
                      }}></div>
                      <div style={{
                        width: '75%',
                        height: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        animation: 'skeletonPulse 1.5s ease-in-out infinite',
                        animationDelay: '0.4s',
                        boxSizing: 'border-box',
                      }}></div>
                      <div style={{
                        width: '60%',
                        height: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        animation: 'skeletonPulse 1.5s ease-in-out infinite',
                        animationDelay: '0.6s',
                        boxSizing: 'border-box',
                      }}></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Input Area */}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div>
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '180px',
                        maxHeight: '300px',
                        fontSize: '11px',
                        color: '#d1d5db',
                        lineHeight: '1.4',
                        padding: '8px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      placeholder="Edit your prompt here..."
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      onClick={handleSendAnalysis}
                      disabled={isLoading}
                      style={{
                        background: 'black',
                        border: '1px solid white',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        opacity: isLoading ? 0.7 : 1,
                      }}
                      onMouseOver={(e) => {
                        if (!isLoading) {
                          e.target.style.background = 'rgba(0, 0, 0, 0.8)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isLoading) {
                          e.target.style.background = 'black';
                        }
                      }}
                    >
                      {isLoading ? 'SENDING...' : 'SEND'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Analysis Text */
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#e5e7eb',
              whiteSpace: 'pre-wrap',
            }}>
                {getAnalysisText()}
              </div>
              
            </div>
          )}

          {/* Sources */}
          {reasoningData?.sources && reasoningData.sources.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div 
                onClick={toggleMainSources}
                style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#93c5fd',
                margin: '0 0 12px 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'color 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.target.style.color = '#60a5fa';
                }}
                onMouseOut={(e) => {
                  e.target.style.color = '#93c5fd';
                }}
              >
                <span>SOURCES ({reasoningData.sources.length})</span>
                <span style={{ 
                  fontSize: '12px',
                  transition: 'transform 0.2s ease',
                  transform: isMainSourcesCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                }}>
                  ▶
                </span>
              </div>
              {!isMainSourcesCollapsed && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {reasoningData.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url || source}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: '#60a5fa',
                      textDecoration: 'none',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                      e.target.style.textDecoration = 'underline';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                      e.target.style.textDecoration = 'none';
                    }}
                  >
                    {source.title || source.url || `Source ${index + 1}`}
                  </a>
                ))}
              </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
};

export default PerplexityReasoningModal;
