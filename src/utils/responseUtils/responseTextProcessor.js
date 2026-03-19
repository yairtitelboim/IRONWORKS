/**
 * Response Text Processor - Handles text formatting, citations, and truncation
 * 
 * This utility processes AI response text for display, including citation handling,
 * bold text formatting, and truncation with clickable expansion.
 */

import { formatResponseText, processFullResponse } from '../../components/Map/components/Cards/textUtils';

/**
 * Render response with clickable citations, bold formatting, and clickable dots
 * @param {string} responseText - Raw response text
 * @param {Array} citations - Array of citation objects
 * @param {boolean} isExpanded - Whether response is expanded
 * @param {Function} onExpansionChange - Callback for expansion state changes
 * @returns {JSX.Element} Formatted response element
 */
export const renderResponseWithCitations = (responseText, citations, isExpanded, onExpansionChange) => {
  if (!responseText) return null;
  
  // Handle case where responseText might be React elements
  if (typeof responseText !== 'string') {
    return responseText;
  }
  
  if (!citations || citations.length === 0) {
    // No citations, just format bold text and add clickable dots if truncated
    return (
      <>
        {formatResponseText(responseText)}
        {!isExpanded && responseText.includes('...') && (
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              fontWeight: '600',
              marginLeft: '2px'
            }}
            onClick={() => onExpansionChange(true)}
            onMouseEnter={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="Click to show full response"
          >
            ...
          </span>
        )}
      </>
    );
  }
  
  // Handle truncated text with clickable dots
  if (responseText.includes('...')) {
    if (!isExpanded) {
      // Show truncated version with clickable dots
      const lastDotIndex = responseText.lastIndexOf('...');
      if (lastDotIndex !== -1) {
        // Get text before dots
        const beforeDots = responseText.substring(0, lastDotIndex);
        
        // Process the text before dots
        const beforeDotsParts = beforeDots.split(/(\[\d+\])/g);
        const beforeDotsFormatted = beforeDotsParts.map((part, index) => {
          const citationMatch = part.match(/\[(\d+)\]/);
          if (citationMatch) {
            const citationNumber = citationMatch[1];
            const citationIndex = parseInt(citationNumber) - 1;
            const citation = citations[citationIndex];
            
            if (citation) {
              const url = typeof citation === 'string' ? citation : citation.url;
              return (
                <span
                  key={`citation-before-${index}`}
                  style={{
                    color: '#60a5fa',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontWeight: '600',
                    padding: '0px 1px',
                    margin: '0px'
                  }}
                  title={url ? `Click to open: ${url}` : `Source ${citationNumber}`}
                  onClick={() => {
                    if (url) {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  {part}
                </span>
              );
            }
          }
          return formatResponseText(part);
        });
        
        // Flatten the before dots parts
        const beforeDotsFlattened = [];
        beforeDotsFormatted.forEach((part) => {
          if (Array.isArray(part)) {
            beforeDotsFlattened.push(...part);
          } else {
            beforeDotsFlattened.push(part);
          }
        });
        
        // Add clickable dots
        beforeDotsFlattened.push(
          <span
            key="clickable-dots"
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              fontWeight: '600',
              marginLeft: '2px'
            }}
            onClick={() => onExpansionChange(true)}
            onMouseEnter={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="Click to show full response"
          >
            ...
          </span>
        );
        
        return beforeDotsFlattened;
      }
    } else {
      // Show full response when expanded
      return processFullResponse(responseText, citations);
    }
  }
  
  // If no dots, process normally
  return processFullResponse(responseText, citations);
};

/**
 * Get truncated text if needed
 * @param {string} response - Full response text
 * @param {number} truncationLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const getTruncatedText = (response, truncationLength) => {
  if (!response || response.length <= truncationLength) return response;
  
  const truncated = response.substring(0, truncationLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  // Try to truncate at a word boundary
  if (lastSpaceIndex > truncationLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex);
  }
  
  return truncated;
};

/**
 * Render truncated view with clickable dots
 * @param {string} response - Full response text
 * @param {number} truncationLength - Maximum length before truncation
 * @param {Function} onExpansionChange - Callback for expansion state changes
 * @returns {JSX.Element} Truncated view element
 */
export const renderTruncatedView = (response, truncationLength, onExpansionChange) => {
  const truncatedText = getTruncatedText(response, truncationLength);
  
  return (
    <>
      {formatResponseText(truncatedText)}
      <span
        style={{
          color: 'rgba(255, 255, 255, 0.7)',
          cursor: 'pointer',
          fontWeight: '600',
          marginLeft: '2px',
          transition: 'color 0.2s ease'
        }}
        onClick={() => onExpansionChange(true)}
        onMouseEnter={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.9)';
        }}
        onMouseLeave={(e) => {
          e.target.style.color = 'rgba(255, 255, 255, 0.7)';
        }}
        title="Click to show full response"
      >
        ...
      </span>
    </>
  );
};

/**
 * Render full view with scroll
 * @param {string} response - Full response text
 * @param {Array} citations - Array of citation objects
 * @returns {JSX.Element} Full view element
 */
export const renderFullView = (response, citations) => {
  if (citations && citations.length > 0) {
    return processFullResponse(response, citations);
  }
  
  return formatResponseText(response);
};
