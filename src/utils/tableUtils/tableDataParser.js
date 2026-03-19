/**
 * Table Data Parser - Extracts and processes Perplexity response data for table rendering
 * 
 * This utility handles parsing Perplexity responses into structured table data
 * and provides filtering and formatting functions for different table types.
 */

/**
 * Parse Perplexity response into structured data for tables
 * @param {string} response - Raw Perplexity response text
 * @returns {Array} Array of parsed node objects
 */
export const parseTableData = (response) => {
  if (!response || typeof response !== 'string') return [];
  
  const nodes = [];
  const nodeRegex = /## NODE (\d+): \*\*(.*?)\*\*/g;
  let match;
  
  while ((match = nodeRegex.exec(response)) !== null) {
    const nodeNumber = match[1];
    const nodeName = match[2];
    
    // Extract data for this node
    const nodeStart = match.index;
    const remainingText = response.substring(nodeStart + match[0].length);
    const nextNodeMatch = /## NODE (\d+): \*\*(.*?)\*\*/.exec(remainingText);
    const nodeEnd = nextNodeMatch ? nodeStart + match[0].length + nextNodeMatch.index : response.length;
    
    const nodeContent = response.substring(nodeStart, nodeEnd);
    
    // Updated regex patterns to match the actual Perplexity response format
    const typeMatch = nodeContent.match(/\*\*Type:\*\* (.+?)(?:\s*\(|$)/);
    
    // Try to match numeric scores first, then fallback to "Data not available"
    const powerScoreMatch = nodeContent.match(/\*\*1\. POWER SCORE:\*\* \*\*(\d+)\/10\*\*/) || 
                           nodeContent.match(/\*\*1\. POWER SCORE:\*\* (\d+)\/10/) ||
                           nodeContent.match(/\*\*1\. POWER SCORE:\*\* \*\*(\d+)\/10\*\*/);
    const stabilityScoreMatch = nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* \*\*(\d+)\/10\*\*/) || 
                               nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* (\d+)\/10/) ||
                               nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* \*\*(\d+)\/10\*\*/);
    const capacityMatch = nodeContent.match(/\*\*Nameplate Capacity:\*\* \*\*(.+?)\*\*/) ||
                         nodeContent.match(/\*\*Nameplate Capacity:\*\* (.+?)(?:\s*\[|\n|$)/) ||
                         nodeContent.match(/\*\*Nameplate Capacity:\*\* \*(.+?)\*/);
    
    // Extract resilience and redundancy data from the new format
    const resilienceMatch = nodeContent.match(/\*\*Weather Resilience:\*\* \*(.+?)\*/) ||
                           nodeContent.match(/\*\*Weather Resilience:\*\* (.+?)(?:\n|$)/) ||
                           nodeContent.match(/\*\*Reliability Metrics:\*\* \*(.+?)\*/) ||
                           nodeContent.match(/\*\*Reliability Metrics:\*\* (.+?)(?:\n|$)/);
    const redundancyDataMatch = nodeContent.match(/\*\*Transmission Redundancy:\*\* \*(.+?)\*/) ||
                               nodeContent.match(/\*\*Transmission Redundancy:\*\* (.+?)(?:\n|$)/) ||
                               nodeContent.match(/\*\*Power Availability:\*\* \*(.+?)\*/) ||
                               nodeContent.match(/\*\*Power Availability:\*\* \*(.+?)(?:\n|$)/);
    
    // Use stability score as power score if available, otherwise use power score
    const finalPowerScore = stabilityScoreMatch ? parseInt(stabilityScoreMatch[1]) : 
                           (powerScoreMatch ? parseInt(powerScoreMatch[1]) : 0);
    
    // Determine risk level based on power score (primary method)
    let riskLevel = 'N/A';
    const score = finalPowerScore;
    if (score >= 8) {
      riskLevel = 'Low';
    } else if (score >= 5) {
      riskLevel = 'Medium';
    } else if (score > 0) {
      riskLevel = 'High';
    } else {
      riskLevel = 'High'; // Default to High for 0 scores
    }
    
    const nodeData = {
      id: nodeNumber,
      name: nodeName,
      type: typeMatch ? typeMatch[1].trim() : 'Unknown',
      powerScore: finalPowerScore,
      risk: riskLevel,
      capacity: capacityMatch ? capacityMatch[1].trim() : 'N/A',
      queueDepth: 'N/A', // Not available in this response format
      resilience: resilienceMatch ? resilienceMatch[1].trim() : 'N/A',
      redundancy: redundancyDataMatch ? redundancyDataMatch[1].trim() : 'N/A',
      content: nodeContent
    };
    
    nodes.push(nodeData);
  }
  
  return nodes;
};

/**
 * Get type abbreviation for display
 * @param {string} type - Full type string
 * @returns {string} Abbreviated type
 */
export const getTypeAbbreviation = (type) => {
  if (type.includes('Power Plant') || type.includes('Hydroelectric')) return 'PWR';
  if (type.includes('Substation')) return 'TXM';
  if (type.includes('Data Center')) return 'DST';
  if (type.includes('Water')) return 'UTL';
  return 'UNK';
};

/**
 * Filter nodes by category
 * @param {Array} nodes - Array of node objects
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered nodes
 */
export const filterNodesByCategory = (nodes, category) => {
  if (category === 'all') return nodes;
  
  const keywords = {
    'pwr': ['Power Plant', 'Coal-fired', 'Generation', 'plant', 'Hydroelectric'],
    'trn': ['Substation', 'Transmission', '345 kV', '138 kV', 'Grid'],
    'utl': ['Water Supply', 'Water Treatment', 'Utility', 'Municipal'],
    'risk': ['Weather', 'Resilience', 'Redundancy', 'Risk', 'Vulnerable']
  };
  
  const categoryKeywords = keywords[category] || [];
  let filteredNodes = nodes.filter(node => 
    categoryKeywords.some(keyword => 
      node.content.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  // Additional filtering for specific categories
  if (category === 'utl') {
    filteredNodes = filteredNodes.filter(node => 
      node.type.includes('Water') || 
      node.type.includes('Utility')
    );
  }
  if (category === 'trn') {
    filteredNodes = filteredNodes.filter(node => 
      node.type.includes('Substation') || 
      node.type.includes('Transmission')
    );
  }
  if (category === 'pwr') {
    filteredNodes = filteredNodes.filter(node => 
      node.type.includes('Power Plant') || 
      node.type.includes('Generation') ||
      node.type.includes('Hydroelectric')
    );
  }

  return filteredNodes;
};

/**
 * Generate search terms for matching with legend data
 * @param {Object} node - Node object
 * @returns {Array} Array of search terms
 */
export const generateSearchTerms = (node) => {
  const terms = [];
  
  // Add node name words
  if (node.name) {
    terms.push(...node.name.toLowerCase().split(' '));
  }
  
  // Add type-based terms
  if (node.type) {
    const type = node.type.toLowerCase();
    if (type.includes('power') || type.includes('plant')) {
      terms.push('power', 'plant', 'generation');
    }
    if (type.includes('substation') || type.includes('transmission')) {
      terms.push('substation', 'transmission', 'electric', 'utility');
    }
    if (type.includes('water') || type.includes('utility')) {
      terms.push('water', 'utility', 'municipal');
    }
    if (type.includes('data') || type.includes('center')) {
      terms.push('data', 'center', 'facility');
    }
  }
  
  return [...new Set(terms)]; // Remove duplicates
};
