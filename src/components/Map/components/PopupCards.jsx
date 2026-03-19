
export const formatWaterData = (props) => {
  const groups = {
    main: {
      title: 'Location Information',
      fields: ['SYS NAME', 'WATERBODY'],
      description: 'Primary details about the water intake point'
    },
    ids: {
      title: 'Reference IDs',
      fields: ['OBJECTID', 'PWS ID', 'WTRSRC'],
      description: 'System identification numbers'
    },
    coordinates: {
      title: 'Geographic Coordinates',
      fields: ['LAT DD', 'LONG DD'],
      description: 'Precise location in decimal degrees'
    },
    technical: {
      title: 'Technical Details',
      fields: ['HORZ METH', 'HORZ ACC', 'HORZ REF', 'HORZ DATUM', 'HORZ ORG', 'HORZ DATE'],
      description: 'Horizontal measurement specifications and metadata'
    }
  };

  let html = '';
  
  Object.entries(groups).forEach(([key, group]) => {
    const hasData = group.fields.some(field => props[field]);
    if (hasData) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="color: #4dd4ac; font-size: 14px; font-weight: 500; margin-bottom: 8px; border-bottom: 1px solid rgba(77, 212, 172, 0.3); padding-bottom: 4px;">
            ${group.title}
          </div>
          <div style="color: #888; font-size: 12px; margin-bottom: 8px; font-style: italic;">
            ${group.description}
          </div>
          ${group.fields.map(field => {
            const value = props[field];
            if (!value) return '';
            const formattedKey = field.replace(/_/g, ' ');
            let displayValue = value;
            
            // Format specific fields
            if (field === 'HORZ DATE') {
              displayValue = new Date(value).toLocaleDateString();
            } else if (field === 'LAT DD' || field === 'LONG DD') {
              displayValue = Number(value).toFixed(5) + '°';
            }

            return `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-left: 8px;">
                <span style="color: #bbb;">${formattedKey}:</span>
                <span style="color: white; text-align: right;">${displayValue}</span>
              </div>`;
          }).join('')}
        </div>`;
    }
  });
  return html;
};

export const formatAIConsensusData = (zipCode, modelData) => {
  if (!modelData || !modelData.models) {
    return `
      <div>
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">
          ZIP Code: ${zipCode}
        </div>
        <div style="font-size: 14px; opacity: 0.7;">
          No model predictions available
        </div>
      </div>
    `;
  }

  const modelPredictions = Object.entries(modelData.models)
    .map(([model, value]) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: #888;">${model}:</span>
        <span>${value} ft</span>
      </div>
    `).join('');

  const disagreementColor = modelData.disagreement > 0.7 ? '#ff6b6b' : 
                         modelData.disagreement > 0.4 ? '#ffd93d' : 
                         '#4dd4ac';

  return `
    <div style="
      background: rgba(0, 0, 0, 0.9);
      border-radius: 8px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
          ZIP Code: ${zipCode}
        </div>
        <div style="
          font-size: 14px;
          color: ${disagreementColor};
          margin-bottom: 2px;
        ">
          Disagreement Level: ${(modelData.disagreement * 100).toFixed(1)}%
        </div>
      </div>
      
      <div style="
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 12px;
        font-size: 13px;
      ">
        <div style="margin-bottom: 8px; color: #888;">Model Predictions:</div>
        ${modelPredictions}
      </div>

      <div style="font-size: 13px; margin-bottom: 8px;">
        <span style="color: #888;">Confidence Range:</span>
        <span style="color: #4dd4ac;">${modelData.confidence_range}</span>
      </div>

      <div style="font-size: 13px;">
        <span style="color: #888;">Primary Concern:</span>
        <span style="color: #ff9966;">${modelData.primary_concern}</span>
      </div>
    </div>
  `;
};

export const formatStartupData = (props) => {
  const {
    name,
    category,
    categoryColor,
    fundingStage,
    industries,
    address,
    headquarters,
    geographicIntelligence,
    spatialInsights
  } = props;

  // Parse industries if it's a string
  const industriesList = typeof industries === 'string' 
    ? industries.split(',').map(i => i.trim())
    : Array.isArray(industries) ? industries : [];

  // Parse geographic intelligence if it's a string
  let geoIntelligence = geographicIntelligence;
  if (typeof geographicIntelligence === 'string') {
    try {
      geoIntelligence = JSON.parse(geographicIntelligence);
    } catch (error) {
      console.warn('Failed to parse geographicIntelligence:', error);
      geoIntelligence = null;
    }
  }

  // Parse spatial insights if it's a string
  let spatialData = spatialInsights;
  if (typeof spatialInsights === 'string') {
    try {
      spatialData = JSON.parse(spatialInsights);
    } catch (error) {
      console.warn('Failed to parse spatialInsights:', error);
      spatialData = null;
    }
  }

  const groups = {
    main: {
      title: 'Infrastructure Snapshot',
      fields: [
        { key: 'name', label: 'Company', value: name },
        { key: 'category', label: 'Category', value: category, color: categoryColor },
        { key: 'fundingStage', label: 'Funding Stage', value: fundingStage },
        { key: 'address', label: 'Address', value: address },
        { key: 'headquarters', label: 'Headquarters', value: headquarters }
      ],
      description: 'Key site characteristics and location context'
    },
    industries: {
      title: 'Industries & Focus',
      fields: industriesList.map(industry => ({ key: 'industry', label: industry, value: '✓' })),
      description: 'Primary business sectors and technology focus areas'
    },
    academic: {
      title: 'Academic Proximity',
      fields: geoIntelligence?.academic_proximity ? [
        { key: 'mit', label: 'MIT Distance', value: geoIntelligence.academic_proximity.mit_distance_miles + ' mi' },
        { key: 'harvard', label: 'Harvard Distance', value: geoIntelligence.academic_proximity.harvard_distance_miles + ' mi' },
        { key: 'northeastern', label: 'Northeastern Distance', value: geoIntelligence.academic_proximity.northeastern_distance_miles + ' mi' },
        { key: 'bu', label: 'BU Distance', value: geoIntelligence.academic_proximity.bu_distance_miles + ' mi' },
        { key: 'score', label: 'Academic Arbitrage Score', value: geoIntelligence.academic_proximity.academic_arbitrage_score }
      ] : [],
      description: 'Distance to major universities and academic collaboration potential'
    },
    infrastructure: {
      title: 'Infrastructure Access',
      fields: geoIntelligence?.infrastructure_access ? [
        { key: 't_stop', label: 'Nearest T Stop', value: geoIntelligence.infrastructure_access.nearest_t_stop },
        { key: 'walkability', label: 'Walkability Score', value: geoIntelligence.infrastructure_access.walkability_score },
        { key: 'transit', label: 'Transit Connectivity', value: geoIntelligence.infrastructure_access.transit_connectivity }
      ] : [],
      description: 'Transportation and accessibility metrics'
    },
    economic: {
      title: 'Economic Geography',
      fields: geoIntelligence?.economic_geography ? [
        { key: 'rent', label: 'Rent (psf)', value: geoIntelligence.economic_geography.estimated_rent_psf },
        { key: 'vs_kendall', label: 'vs Kendall Square', value: geoIntelligence.economic_geography.cost_vs_kendall_square },
        { key: 'vs_seaport', label: 'vs Seaport', value: geoIntelligence.economic_geography.cost_vs_seaport },
        { key: 'trends', label: 'Market Trends', value: geoIntelligence.economic_geography.commercial_real_estate_trends }
      ] : [],
      description: 'Real estate costs and market positioning'
    },
    network: {
      title: 'Network Effects',
      fields: geoIntelligence?.network_effects ? [
        { key: 'density', label: 'Startup Density (0.5mi)', value: geoIntelligence.network_effects.startup_density_0_5_miles },
        { key: 'vc_proximity', label: 'VC Proximity', value: geoIntelligence.network_effects.vc_proximity },
        { key: 'clusters', label: 'Tech Clusters', value: geoIntelligence.network_effects.tech_company_clusters },
        { key: 'networking', label: 'Networking Opportunities', value: geoIntelligence.network_effects.networking_opportunities }
      ] : [],
      description: 'Ecosystem density and networking potential'
    },
    insights: {
      title: 'Strategic Insights',
      fields: spatialData ? [
        { key: 'clustering', label: 'Clustering Pattern', value: spatialData.clustering_pattern },
        { key: 'advantages', label: 'Geographic Advantages', value: Array.isArray(spatialData.geographic_advantages) ? spatialData.geographic_advantages.join('; ') : spatialData.geographic_advantages },
        { key: 'risks', label: 'Geographic Risks', value: Array.isArray(spatialData.geographic_risks) ? spatialData.geographic_risks.join('; ') : spatialData.geographic_risks },
        { key: 'positioning', label: 'Ecosystem Positioning', value: spatialData.ecosystem_positioning }
      ] : [],
      description: 'Strategic location analysis and competitive positioning'
    }
  };

  let html = '';
  
  Object.entries(groups).forEach(([key, group]) => {
    const hasData = group.fields && group.fields.length > 0 && group.fields.some(field => field.value);
    if (hasData) {
      // Check if this section should be collapsible and collapsed by default
      const isCollapsible = key === 'main' || key === 'industries';
      const isCollapsed = key === 'industries'; // Only industries section is collapsed by default
      const sectionId = `startup-section-${key}`;
      
      html += `
        <div style="margin-bottom: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2); backdrop-filter: blur(12px);">
          <div class="toggle-header" data-section-id="${sectionId}" style="background: rgba(255, 255, 255, 0.03); color: #ffffff; font-size: 14px; font-weight: 600; margin: -12px -12px 12px -12px; padding: 14px; display: flex; align-items: center; gap: 10px; cursor: ${isCollapsible ? 'pointer' : 'default'}; border-bottom: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px 12px 0 0;">
            <span style="width: 20px; height: 20px; background: ${key === 'main' ? '#3b82f6' : 
              key === 'academic' ? '#10b981' : 
              key === 'infrastructure' ? '#f59e0b' : 
              key === 'economic' ? '#ef4444' : 
              key === 'network' ? '#8b5cf6' : 
              key === 'insights' ? '#06b6d4' : '#6b7280'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">
              ${key === 'main' ? 'CI' : 
                key === 'academic' ? 'AP' : 
                key === 'infrastructure' ? 'IA' : 
                key === 'economic' ? 'EG' : 
                key === 'network' ? 'NE' : 
                key === 'insights' ? 'SI' : 'I'}
            </span>
            ${group.title}
            ${isCollapsible ? `<span class="toggle-arrow" style="margin-left: auto; font-size: 12px; transition: transform 0.2s;">${isCollapsed ? '▶' : '▼'}</span>` : ''}
          </div>
          <div style="color: #9ca3af; font-size: 11px; margin-bottom: 12px; font-style: italic; padding: 0 4px;">
            ${group.description}
          </div>
          <div id="${sectionId}" style="display: ${isCollapsed ? 'none' : 'block'};">
            ${group.fields.map(field => {
              if (!field.value) return '';
              
              let displayValue = field.value;
              let valueColor = '#ffffff';
              
              // Special formatting for certain fields
              if (field.key === 'category' && field.color) {
                valueColor = field.color;
              } else if (field.key === 'score' && field.value.includes('/10')) {
                const score = parseInt(field.value.split('/')[0]);
                valueColor = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444';
              }
              
              return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <span style="color: #d1d5db; font-size: 12px; font-weight: 500;">${field.label}:</span>
                  <span style="color: ${valueColor}; text-align: right; font-size: 12px; max-width: 60%; word-wrap: break-word;">${displayValue}</span>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  });
  
  // Add Key Insights section to match AIResponseDisplayRefactored design with toggle
  const insightsSectionId = 'startup-section-insights';
  html += `
    <div style="margin-top: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2); backdrop-filter: blur(12px);">
      <div class="toggle-header" data-section-id="${insightsSectionId}" style="background: rgba(255, 255, 255, 0.03); color: #ffffff; font-size: 11px; font-weight: 600; margin: -12px -12px 12px -12px; padding: 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px 12px 0 0;">
        <span style="width: 20px; height: 20px; background: #60a5fa; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">
          KI
        </span>
        Key Insights
        <span class="toggle-arrow" style="margin-left: auto; font-size: 10px; transition: transform 0.2s;">▶</span>
      </div>
      <div id="${insightsSectionId}" style="display: none;">
        <div style="color: #9ca3af; font-size: 9px; margin-bottom: 12px; font-style: italic; padding: 0 4px;">
          Strategic analysis and ecosystem insights
        </div>
        <div style="font-size: 10px; color: #d1d5db; line-height: 1.4;">
          • <strong>Startup Ecosystem:</strong> Comprehensive analysis of innovation landscape<br/>
          • <strong>Geographic Intelligence:</strong> Location-based strategic insights<br/>
          • <strong>Network Effects:</strong> Ecosystem density and collaboration potential
        </div>
      </div>
    </div>
  `;
  
  // JavaScript removed - toggle functionality will be handled by React in MarkerPopupCard
  
  return html;
};

export const formatTDLRData = (props) => {
  const {
    name,
    title,
    project_name,
    project_id,
    facility_name,
    work_type,
    status,
    cost,
    address,
    formatted_address,
    city,
    county,
    geocoded_method,
    scraped_at,
    estimated_completion,
    contractor,
    owner,
    type,
    category
  } = props;

  // Format cost with proper currency formatting
  const formatCost = (costValue) => {
    if (!costValue) return 'N/A';
    const numCost = typeof costValue === 'string' ? parseFloat(costValue.replace(/[,$]/g, '')) : costValue;
    if (isNaN(numCost)) return 'N/A';
    
    if (numCost >= 1000000) {
      return `$${(numCost / 1000000).toFixed(1)}M`;
    } else if (numCost >= 1000) {
      return `$${(numCost / 1000).toFixed(0)}K`;
    } else {
      return `$${numCost.toLocaleString()}`;
    }
  };

  // Get work type category and description
  const getWorkTypeInfo = (workType) => {
    const workTypeMap = {
      'New Construction': { category: 'New Build', description: 'New building construction' },
      'Renovation/Alteration': { category: 'Renovation', description: 'Existing building improvements' },
      'Additions to Existing Building': { category: 'Addition', description: 'Building expansion project' }
    };
    return workTypeMap[workType] || { category: 'Construction', description: workType };
  };

  // Get status with context
  const getStatusInfo = (statusValue) => {
    const statusMap = {
      'Project Registered': { status: 'Registered', description: 'Project registered with TDLR' },
      'In Progress': { status: 'Active', description: 'Construction in progress' },
      'Completed': { status: 'Complete', description: 'Project finished' },
      'Cancelled': { status: 'Cancelled', description: 'Project cancelled' }
    };
    return statusMap[statusValue] || { status: statusValue, description: 'Project status' };
  };

  const workTypeInfo = getWorkTypeInfo(work_type);
  const statusInfo = getStatusInfo(status);
  const formattedCost = formatCost(cost);

  const groups = {
    main: {
      title: 'Construction Project',
      fields: [
        { key: 'project_name', label: 'Project', value: project_name || name || title },
        { key: 'project_id', label: 'TDLR ID', value: project_id },
        { key: 'facility_name', label: 'Facility', value: facility_name },
        { key: 'work_type', label: 'Type', value: `${workTypeInfo.category} - ${work_type}` },
        { key: 'status', label: 'Status', value: `${statusInfo.status} - ${status}` }
      ],
      description: workTypeInfo.description
    },
    financial: {
      title: 'Financial Details',
      fields: [
        { key: 'cost', label: 'Project Cost', value: formattedCost },
        { key: 'cost_context', label: 'Scale', value: cost ? (cost >= 1000000 ? 'Major Project' : cost >= 100000 ? 'Mid-Scale' : 'Small Project') : 'N/A' }
      ],
      description: 'Project investment and scale'
    },
    location: {
      title: 'Location Details',
      fields: [
        { key: 'address', label: 'Address', value: formatted_address || address },
        { key: 'city', label: 'City', value: city },
        { key: 'county', label: 'County', value: county },
        { key: 'geocoded', label: 'Location Source', value: geocoded_method ? `Geocoded via ${geocoded_method}` : 'N/A' }
      ],
      description: 'Project location and geographic context'
    },
    timeline: {
      title: 'Project Timeline',
      fields: [
        { key: 'scraped_at', label: 'Data Updated', value: scraped_at ? new Date(scraped_at).toLocaleDateString() : 'N/A' },
        { key: 'estimated_completion', label: 'Est. Completion', value: estimated_completion || 'Not specified' },
        { key: 'contractor', label: 'Contractor', value: contractor || 'Not specified' },
        { key: 'owner', label: 'Project Owner', value: owner || 'Not specified' }
      ],
      description: 'Project timeline and responsible parties'
    }
  };

  let html = '';
  
  Object.entries(groups).forEach(([key, group]) => {
    const hasData = group.fields && group.fields.length > 0 && group.fields.some(field => field.value && field.value !== 'N/A');
    if (hasData) {
      // Check if this section should be collapsible and collapsed by default
      const isCollapsible = key === 'main' || key === 'financial' || key === 'location' || key === 'timeline';
      const isCollapsed = key === 'financial' || key === 'location' || key === 'timeline'; // Collapse all except main by default
      const sectionId = `tdlr-section-${key}`;
      
      html += `
        <div style="margin-bottom: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2); backdrop-filter: blur(12px);">
          <div class="toggle-header" data-section-id="${sectionId}" style="background: rgba(255, 255, 255, 0.03); color: #ffffff; font-size: 11px; font-weight: 600; margin: -12px -12px 12px -12px; padding: 12px; display: flex; align-items: center; gap: 8px; cursor: ${isCollapsible ? 'pointer' : 'default'}; border-bottom: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px 12px 0 0;">
            <span style="width: 20px; height: 20px; background: ${key === 'main' ? '#ef4444' : 
              key === 'financial' ? '#f59e0b' : 
              key === 'location' ? '#10b981' : '#6b7280'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">
              ${key === 'main' ? 'PI' : 
                key === 'financial' ? 'FD' : 
                key === 'location' ? 'LD' : 'I'}
            </span>
            ${group.title}
            ${isCollapsible ? `<span class="toggle-arrow" style="margin-left: auto; font-size: 10px; transition: transform 0.2s;">${isCollapsed ? '▶' : '▼'}</span>` : ''}
          </div>
          <div style="color: #9ca3af; font-size: 9px; margin-bottom: 12px; font-style: italic; padding: 0 4px;">
            ${group.description}
          </div>
          <div id="${sectionId}" style="display: ${isCollapsed ? 'none' : 'block'};">
            ${group.fields.map(field => {
              if (!field.value || field.value === 'N/A') return '';
              
              let displayValue = field.value;
              let valueColor = '#ffffff';
              
              // Special formatting for cost
              if (field.key === 'cost' && field.value !== 'N/A') {
                valueColor = '#f59e0b';
              } else if (field.key === 'status') {
                // Color code status
                const statusLower = field.value.toLowerCase();
                if (statusLower.includes('complete') || statusLower.includes('finished')) {
                  valueColor = '#10b981';
                } else if (statusLower.includes('progress') || statusLower.includes('ongoing')) {
                  valueColor = '#f59e0b';
                } else if (statusLower.includes('planned') || statusLower.includes('pending')) {
                  valueColor = '#3b82f6';
                } else {
                  valueColor = '#ffffff';
                }
              }
              
              return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                  <span style="color: #d1d5db; font-size: 10px; font-weight: 500;">${field.label}:</span>
                  <span style="color: ${valueColor}; text-align: right; font-size: 10px; max-width: 60%; word-wrap: break-word;">${displayValue}</span>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  });
  
  return html;
};

export const formatPinalData = (nodeData) => {
  const name = nodeData.name || 'Pinal County Infrastructure';
  const zone = nodeData.zone_name
    || nodeData.zone
    || nodeData.siteMetadata?.shortName
    || nodeData.siteMetadata?.name
    || 'Unknown Zone';
  const type = nodeData.type || 'Infrastructure Analysis';
  const category = nodeData.category || 'Infrastructure';
  const analysisStatus = nodeData.analysisStatus || 'Analysis complete';
  const zonesAnalyzed = nodeData.zonesAnalyzed || 3;
  const cachedDataAvailable = nodeData.cachedDataAvailable || false;

  // Determine theme based on marker type
  let theme = 'green'; // Default theme
  let enhancedContent = null;
  
  if (name === 'Liberty Focus Area') {
    theme = 'green';
    enhancedContent = {
      description: "**Liberty Focus Area** represents the primary analysis zone near Dogwood Ln in Liberty, North Carolina.",
      data: {
        'County': 'Randolph County, North Carolina',
        'Nearby Highways': 'US-421, NC-49',
        'Region': 'Piedmont Triad'
      }
    };
  } else if (name === 'Lucid Motors') {
    theme = 'blue';
    enhancedContent = {
      description: "**Lucid Motors** operates a state-of-the-art **electric vehicle manufacturing facility** in Casa Grande, Arizona. This **$700M investment** represents Arizona's largest manufacturing project and supports **thousands of jobs**.",
      data: {
        'Investment': '$700M',
        'Facility Size': '2.85M sq ft',
        'Production Capacity': '365,000 vehicles/year',
        'Jobs Created': '~3,000',
        'Vehicle Model': 'Lucid Air',
        'Technology': 'Electric Vehicle'
      }
    };
  } else if (name === 'Liberty Downtown Core') {
    theme = 'purple';
    enhancedContent = {
      description: "**Liberty Downtown Core** represents the civic center and historic downtown of Liberty, North Carolina.",
      data: {
        'County': 'Randolph County',
        'Character': 'Historic Downtown',
        'State': 'North Carolina'
      }
    };
  } else if (name === 'Toyota Battery Manufacturing North Carolina') {
    theme = 'blue';
    enhancedContent = {
      description: "**Toyota Battery Manufacturing North Carolina** is a major EV battery manufacturing facility near Liberty, NC, anchoring regional industrial growth and supply chain development.",
      data: {
        'Focus': 'EV Battery Manufacturing & Supply Chain',
        'Nearby Routes': 'US-421, NC-49',
        'Region': 'Piedmont',
        'Workforce': 'Greensboro–High Point metro access'
      }
    };
  } else if (name === 'Shearon Harris Nuclear Power Plant') {
    theme = 'green';
    enhancedContent = {
      description: "**Shearon Harris Nuclear Power Plant** anchors Duke Energy's baseload capacity southwest of Raleigh, combining **nuclear generation**, **switchyard infrastructure**, and **cooling reservoir operations**.",
      data: {
        'Operator': 'Duke Energy Progress',
        'Reactor Type': 'PWR – Westinghouse 3-loop',
        'Cooling Source': 'Harris Lake (4,100 acre reservoir)',
        'Nearby Transmission': '230 kV & 500 kV corridors',
        'Commissioned': '1987',
        'County': 'Wake / Chatham County line'
      }
    };
  } else if (name === 'TSMC Arizona Semiconductor Fab Complex') {
    theme = 'blue';
    enhancedContent = {
      description: "**TSMC Arizona Semiconductor Fab Complex** is a **$165B investment** representing the largest foreign greenfield investment in U.S. history. The facility will house **6 semiconductor fabs** producing advanced chips for critical applications.",
      data: {
        'Investment': '$165B',
        'Fabs Planned': '6 fabs',
        'Location': '43rd Ave & Dove Valley Rd, North Phoenix',
        'Water Need': '17,200 gal/day (gap: 5,800 gal/day = 6,500 AF/year)',
        'Status': 'Under construction / Operational (Phase 1)',
        'Coordinates': '33.7250°N, 112.1667°W'
      }
    };
  } else if (name === 'Amkor Technology Advanced Packaging & Test Facility') {
    theme = 'purple';
    enhancedContent = {
      description: "**Amkor Technology** operates a **$7B advanced packaging and test facility** in Peoria, supporting the semiconductor supply chain with critical testing and packaging services.",
      data: {
        'Investment': '$7B',
        'Type': 'Advanced Packaging & Test Facility',
        'Location': 'Peoria Innovation Core, NW of Loop 303 & Lake Pleasant Parkway',
        'Water Need': '~2,500 AF/year',
        'Coordinates': '33.7100°N, 112.2800°W'
      }
    };
  } else if (name === 'Intel Ocotillo Campus') {
    theme = 'blue';
    enhancedContent = {
      description: "**Intel Ocotillo Campus** is a **$50B+ semiconductor fab complex** with **5 operational fabs** (Fab 12, 22, 32, 52, 62). The campus includes a **12-acre on-site reclamation facility** with **9M gal/day capacity**, representing 40 years of cumulative investment.",
      data: {
        'Investment': '$50B+ (cumulative over 40 years)',
        'Fabs': 'Fab 12, 22, 32, 52, 62',
        'Location': '4500 S Dobson Rd, Chandler, AZ',
        'Water Need': '~3,000 AF/year',
        'Reclamation Facility': '12 acres, 9M gal/day capacity',
        'Coordinates': '33.2431°N, 111.8844°W'
      }
    };
  } else if (name === 'NXP Semiconductors Fab Complex') {
    theme = 'pink';
    enhancedContent = {
      description: "**NXP Semiconductors** operates a **semiconductor fab complex** with **2 fabs** in Chandler, representing **30+ years of operations** in the Phoenix semiconductor corridor.",
      data: {
        'Type': 'Semiconductor Fab Complex (2 fabs)',
        'Operations': '30+ years',
        'Location': '1300 N Alma School Rd, Chandler, AZ',
        'Water Need': '~1,500 AF/year',
        'Coordinates': '33.3260°N, 111.8617°W'
      }
    };
  } else if (name === 'Linde Industrial Gas Plant') {
    theme = 'green';
    enhancedContent = {
      description: "**Linde Industrial Gas Plant** is a **$600M on-site industrial gas supply facility** providing **N₂, O₂, and Ar** for semiconductor manufacturing operations, strategically located adjacent to the TSMC campus.",
      data: {
        'Investment': '$600M',
        'Type': 'On-site Industrial Gas Supply',
        'Gases Supplied': 'N₂, O₂, Ar (for semiconductors)',
        'Location': 'Adjacent to TSMC campus, North Phoenix',
        'Coordinates': '33.7200°N, 112.1650°W'
      }
    };
  } else if (name === 'Halo Vista Development') {
    theme = 'yellow';
    enhancedContent = {
      description: "**Halo Vista Development** is a **$7B mixed-use ecosystem** spanning **2,300 acres** at the NW corner of I-17 & Loop 303. The development includes **industrial, residential, retail, and office** components supporting the Phoenix semiconductor corridor.",
      data: {
        'Investment': '$7B',
        'Size': '2,300 acres',
        'Type': 'Mixed-use ecosystem (industrial, residential, retail, office)',
        'Location': 'NW corner I-17 & Loop 303, Phoenix',
        'Water Need': '~2,000 AF/year',
        'Coordinates': '33.7150°N, 112.1600°W'
      }
    };
  }

  // Broad switch: if no preset above, build a generic typewriter payload
  if (!enhancedContent) {
    // Check if markerColor is provided (for PA markers) - use it to determine theme
    if (nodeData.markerColor) {
      // PA markers: red (#dc2626) or orange (#f97316)
      if (nodeData.markerColor === '#dc2626') {
        theme = 'red'; // Red theme for selected PA site
      } else if (nodeData.markerColor === '#f97316') {
        theme = 'orange'; // Orange theme for unselected PA site
      }
    }
    
    // Choose a theme based on category/type cues (fallback)
    if (!theme || (theme !== 'red' && theme !== 'orange')) {
      const categoryLower = String(category || '').toLowerCase();
      if (categoryLower.includes('nuclear') || name.toLowerCase().includes('harris')) {
        theme = 'green';
      } else if (categoryLower.includes('battery') || name.toLowerCase().includes('toyota') || type.toLowerCase().includes('battery')) {
        theme = 'blue';
      } else if (name.toLowerCase().includes('liberty') || zone.toLowerCase().includes('downtown')) {
        theme = 'purple';
      } else {
        theme = 'green';
      }
    }

    const coords = Array.isArray(nodeData.coordinates) && nodeData.coordinates.length >= 2 &&
      typeof nodeData.coordinates[0] === 'number' && typeof nodeData.coordinates[1] === 'number'
      ? `${nodeData.coordinates[1].toFixed(4)}, ${nodeData.coordinates[0].toFixed(4)}`
      : 'N/A';

    enhancedContent = {
      description: `**${name}** — ${type} in ${zone}.`,
      data: {
        'Category': category,
        'Status': analysisStatus,
        'Zones Analyzed': String(zonesAnalyzed),
        'Cached Data': cachedDataAvailable ? 'Yes' : 'No',
        'Coordinates': coords
      }
    };
  }

  // Always return typewriter token so MarkerPopupCard renders TypewriterPopupCard
  return `__PINALTYPEWRITER__${JSON.stringify({
    name,
    zone,
    theme,
    enhancedContent
  })}__PINALTYPEWRITER__`;
}; 
