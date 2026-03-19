// Utility functions for text processing in BaseCard

// Convert markdown bold formatting to styled text
export const formatResponseText = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Split text by ** patterns
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Extract text between ** and apply bold styling
      const boldText = part.slice(2, -2); // Remove **
      return (
        <span
          key={`bold-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`}
          style={{
            fontWeight: '900',
            color: '#ffffff'
          }}
        >
          {boldText}
        </span>
      );
    }
    
    // Handle empty parts - skip rendering them
    if (!part || part.trim() === '') {
      return null;
    }
    
    // Apply heavy font weight to non-bold parts as well
    return (
      <span
        key={`text-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`}
        style={{
          fontWeight: '700'
        }}
      >
        {part}
      </span>
    );
  }).filter(Boolean); // Remove null values
};

// Extract better title from URL
export const extractTitleFromUrl = (url) => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Extract meaningful parts from the URL
    if (hostname.includes('cyrusone.com')) {
      if (pathname.includes('press-releases')) {
        if (pathname.includes('calpine')) {
          return 'CyrusOne & Calpine Partnership';
        } else if (pathname.includes('e.on')) {
          return 'CyrusOne & E.ON Partnership';
        } else {
          return 'CyrusOne Press Release';
        }
      }
      return 'CyrusOne Official';
    } else if (hostname.includes('prnewswire.com')) {
      return 'PR Newswire Release';
    } else if (hostname.includes('utilitydive.com')) {
      return 'Utility Dive News';
    } else if (hostname.includes('datacentermap.com')) {
      return 'Data Center Map';
    } else if (hostname.includes('ercot.com')) {
      return 'ERCOT Official Data';
    } else if (hostname.includes('texas.gov')) {
      return 'Texas Government Source';
    } else if (hostname.includes('energy.gov')) {
      return 'US Department of Energy';
    } else {
      // Generic extraction from pathname
      const cleanPath = pathname.replace(/[_-]/g, ' ').replace(/\.html?$/, '');
      if (cleanPath.length > 10) {
        return cleanPath.substring(0, 50) + '...';
      }
      return hostname;
    }
  } catch (error) {
    return url.substring(0, 30) + '...';
  }
};

// Truncate response text to show first sentence by default
export const truncateResponse = (text, expanded = false) => {
  if (!text || expanded) return text;
  
  // Find the first sentence ending
  const firstPeriod = text.indexOf('.');
  const firstExclamation = text.indexOf('!');
  const firstQuestion = text.indexOf('?');
  
  // Find the earliest sentence ending
  let endIndex = -1;
  if (firstPeriod !== -1) endIndex = firstPeriod;
  if (firstExclamation !== -1 && (endIndex === -1 || firstExclamation < endIndex)) endIndex = firstExclamation;
  if (firstQuestion !== -1 && (endIndex === -1 || firstQuestion < endIndex)) endIndex = firstQuestion;
  
  if (endIndex !== -1) {
    return text.substring(0, endIndex + 1) + '...';
  }
  
  // Fallback: show first 100 characters
  return text.length > 100 ? text.substring(0, 100) + '...' : text;
};

// Create clickable truncation with expandable dots
export const createClickableTruncation = (text, expanded = false) => {
  if (!text || expanded) return text;
  
  // Find the first sentence ending
  const firstPeriod = text.indexOf('.');
  const firstExclamation = text.indexOf('!');
  const firstQuestion = text.indexOf('?');
  
  // Find the earliest sentence ending
  let endIndex = -1;
  if (firstPeriod !== -1) endIndex = firstPeriod;
  if (firstExclamation !== -1 && (endIndex === -1 || firstExclamation < endIndex)) endIndex = firstExclamation;
  if (firstQuestion !== -1 && (endIndex === -1 || firstQuestion < endIndex)) endIndex = firstQuestion;
  
  if (endIndex !== -1) {
    const truncatedText = text.substring(0, endIndex + 1);
    return truncatedText + '...';
  }
  
  // Fallback: show first 100 characters
  if (text.length > 100) {
    const truncatedText = text.substring(0, 100);
    return truncatedText + '...';
  }
  
  return text;
};

// Helper function to process full response
export const processFullResponse = (responseText, citations) => {
  // Split text by citation patterns like [1], [2], etc.
  const parts = responseText.split(/(\[\d+\])/g);
  
  const formattedParts = parts.map((part, index) => {
    const citationMatch = part.match(/\[(\d+)\]/);
    if (citationMatch) {
      const citationNumber = citationMatch[1];
      const citationIndex = parseInt(citationNumber) - 1;
      const citation = citations[citationIndex];
      
      if (citation) {
        // Handle both URL strings and citation objects
        const url = typeof citation === 'string' ? citation : citation.url;
        
        return (
          <span
            key={`citation-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`}
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
    
    // Format bold text in non-citation parts
    const formattedPart = formatResponseText(part);
    return formattedPart;
  });
  
  // Flatten the array to avoid React rendering issues
  const flattenedParts = [];
  formattedParts.forEach((part) => {
    if (Array.isArray(part)) {
      flattenedParts.push(...part);
    } else {
      flattenedParts.push(part);
    }
  });
  
  return flattenedParts;
};
