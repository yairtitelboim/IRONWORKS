// Gentrification Popup Utilities
// Extracted from PerplexityCall.jsx for better organization

import mapboxgl from 'mapbox-gl';
import { GENTRIFICATION_CONFIG } from '../constants/gentrificationConfig';

// Global drag state and functions - defined at module level
window.gentrificationDragState = window.gentrificationDragState || {
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  isDragMode: false,
  currentPopup: null,
  currentContent: null
};

// Global toggle drag mode function
window.toggleDragMode = function(button) {
  const state = window.gentrificationDragState;
  
  // Check if button is enabled (not during animations)
  if (button.style.pointerEvents === 'none') return;
  
  state.isDragMode = !state.isDragMode;
  state.currentPopup = button.closest('.mapboxgl-popup');
  state.currentContent = state.currentPopup.querySelector('.mapboxgl-popup-content');
  
  if (state.isDragMode) {
    button.style.background = 'rgba(59, 130, 246, 0.3)';
    button.style.color = '#60a5fa';
    button.title = 'Exit drag mode';
    state.currentContent.style.cursor = 'move';
    state.currentContent.style.userSelect = 'none';
    
    // Add visual indicator for drag mode
    state.currentContent.style.border = '2px dashed rgba(59, 130, 246, 0.5)';
    state.currentContent.style.borderRadius = '12px';
    
    // Hide Mapbox tip when entering drag mode
    const tip = state.currentPopup.querySelector('.mapboxgl-popup-tip');
    if (tip) {
      tip.style.display = 'none';
    }
    
    // Add mousedown event listener to the entire popup content
    state.currentContent.addEventListener('mousedown', window.handleGentrificationMouseDown);
  } else {
    button.style.background = 'rgba(255, 255, 255, 0.08)';
    button.style.color = 'rgba(255, 255, 255, 0.6)';
    button.title = 'Toggle drag mode';
    state.currentContent.style.cursor = 'default';
    state.currentContent.style.userSelect = 'auto';
    
    // Remove visual indicator
    state.currentContent.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    
    // Remove mousedown event listener
    state.currentContent.removeEventListener('mousedown', window.handleGentrificationMouseDown);
  }
};

// Global mouse event handlers
window.handleGentrificationMouseDown = function(e) {
  const state = window.gentrificationDragState;
  
  if (!state.isDragMode) return;
  
  // Don't drag if clicking on buttons or interactive elements
  if (e.target.tagName === 'BUTTON' || 
      e.target.closest('button') ||
      e.target.closest('[onclick]') ||
      e.target.closest('.toggle-arrow') ||
      e.target.closest('[style*="cursor: pointer"]') ||
      e.target.closest('[style*="Details"]') ||
      e.target.closest('[style*="toggle"]') ||
      e.target.closest('[style*="background: rgba(255, 255, 255, 0.05)"]') ||
      e.target.closest('[style*="background: rgba(255, 255, 255, 0.03)"]')) {
    return;
  }
  
  e.preventDefault();
  e.stopPropagation();
  
  state.isDragging = true;
  
  // Hide the Mapbox popup tip immediately to prevent offset issues
  const tip = state.currentPopup.querySelector('.mapboxgl-popup-tip');
  if (tip) {
    tip.style.display = 'none';
  }
  
  // Get current position AFTER hiding tip
  const rect = state.currentPopup.getBoundingClientRect();
  
  // Force fixed positioning and set initial position based on current screen position
  state.currentPopup.style.position = 'fixed';
  state.currentPopup.style.left = `${rect.left}px`;
  state.currentPopup.style.top = `${rect.top}px`;
  state.currentPopup.style.transform = 'none';
  state.currentPopup.style.margin = '0';
  
  // Get position again after applying fixed positioning to ensure no shift
  const rectAfter = state.currentPopup.getBoundingClientRect();
  if (rectAfter.left !== rect.left || rectAfter.top !== rect.top) {
    // Adjust if there was any shift
    state.currentPopup.style.left = `${rect.left}px`;
    state.currentPopup.style.top = `${rect.top}px`;
  }
  
  // Now calculate offset from the stable position
  state.dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  // Add global event listeners
  document.addEventListener('mousemove', window.handleGentrificationMouseMove);
  document.addEventListener('mouseup', window.handleGentrificationMouseUp);
  
  // Prevent text selection during drag
  document.body.style.userSelect = 'none';
};

window.handleGentrificationMouseMove = function(e) {
  const state = window.gentrificationDragState;
  
  if (!state.isDragging || !state.isDragMode) {
    return;
  }
  
  // Simple position calculation like BaseCard.jsx
  const newX = e.clientX - state.dragOffset.x;
  const newY = e.clientY - state.dragOffset.y;
  
  // Apply position directly with minimal overhead
  state.currentPopup.style.left = `${newX}px`;
  state.currentPopup.style.top = `${newY}px`;
};

window.handleGentrificationMouseUp = function() {
  const state = window.gentrificationDragState;
  
  if (!state.isDragging) return;
  
  state.isDragging = false;
  
  // Remove global event listeners
  document.removeEventListener('mousemove', window.handleGentrificationMouseMove);
  document.removeEventListener('mouseup', window.handleGentrificationMouseUp);
  
  // Restore text selection
  document.body.style.userSelect = '';
  
  // Keep popup in fixed position after dragging - don't let Mapbox reposition it
  if (state.currentPopup) {
    // Ensure it stays fixed and doesn't respond to map changes
    state.currentPopup.style.position = 'fixed';
    state.currentPopup.style.transform = 'none';
    state.currentPopup.style.margin = '0';
    
    // Mark as manually positioned to prevent Mapbox from moving it
    state.currentPopup.setAttribute('data-manually-positioned', 'true');
    
    // Remove any Mapbox event listeners that might reposition it
    if (state.currentPopup._mapboxPopup) {
      // Disable Mapbox's positioning system
      state.currentPopup._mapboxPopup.options.closeOnClick = false;
      state.currentPopup._mapboxPopup.options.closeOnMove = false;
    }
    
    // Add event listener to prevent Mapbox from repositioning the popup
    const preventRepositioning = () => {
      if (state.currentPopup && state.currentPopup.getAttribute('data-manually-positioned') === 'true') {
        // Keep the popup in its current fixed position
        const currentLeft = state.currentPopup.style.left;
        const currentTop = state.currentPopup.style.top;
        if (currentLeft && currentTop) {
          state.currentPopup.style.position = 'fixed';
          state.currentPopup.style.left = currentLeft;
          state.currentPopup.style.top = currentTop;
          state.currentPopup.style.transform = 'none';
          state.currentPopup.style.margin = '0';
        }
      }
    };
    
    // Store the prevention function globally so it can be removed later
    window.preventGentrificationRepositioning = preventRepositioning;
    
    // Add map event listeners to prevent repositioning
    if (window.map && window.map.current) {
      window.map.current.on('move', preventRepositioning);
      window.map.current.on('zoom', preventRepositioning);
      window.map.current.on('rotate', preventRepositioning);
      window.map.current.on('pitch', preventRepositioning);
    }
  }
};

// Global cleanup function to remove event listeners
window.cleanupGentrificationPopup = function() {
  if (window.preventGentrificationRepositioning && window.map && window.map.current) {
    window.map.current.off('move', window.preventGentrificationRepositioning);
    window.map.current.off('zoom', window.preventGentrificationRepositioning);
    window.map.current.off('rotate', window.preventGentrificationRepositioning);
    window.map.current.off('pitch', window.preventGentrificationRepositioning);
    window.preventGentrificationRepositioning = null;
  }
};

// Global refresh analysis function - transforms reasoning section into prompt preview
window.refreshGentrificationAnalysis = function(button) {
  console.log('🔄 Transforming reasoning section to prompt preview...');
  
  // Get the popup element and feature data
  const popup = button.closest('.mapboxgl-popup');
  
  if (!popup) {
    console.error('❌ Could not find popup element');
    return;
  }
  
  // Get the reasoning content container
  const reasoningContent = popup.querySelector('#reasoning-content');
  const skeleton = popup.querySelector('#reasoning-skeleton');
  
  if (!reasoningContent) {
    console.error('❌ Could not find reasoning content');
    return;
  }
  
  // Get the feature properties from the popup
  const neighborhoodName = popup.querySelector('[style*="font-size: 11px; color: #9ca3af"]')?.textContent?.trim() || 'EaDo';
  const riskLevel = popup.querySelector('[style*="font-size: 7px; font-weight: 700"]')?.textContent?.match(/(\d+)%/)?.[1] || '88';
  const timeline = popup.querySelector('[style*="font-size: 14px; font-weight: 600; color: #f59e0b"]')?.textContent?.trim() || '18';
  const radius = popup.querySelector('[style*="font-size: 14px; font-weight: 600; color: #10b981"]')?.textContent?.replace('m', '').trim() || '1500';
  
  // Create a focused query for this specific area
  const focusedQuery = `Analyze the gentrification risk for the ${neighborhoodName} area in Houston, specifically focusing on:

- Current gentrification risk: ${riskLevel}%
- Timeline to unaffordability: ${timeline} months  
- Impact radius: ${radius}m
- Neighborhood characteristics and development patterns
- FIFA investment impact on this specific area
- Recent market trends and displacement factors

Provide a detailed analysis of why this area is at high risk and what specific factors are driving gentrification pressure. Focus on actionable insights and recent developments.`;
  
  // Hide skeleton if visible
  if (skeleton) {
    skeleton.style.display = 'none';
  }
  
  // Transform the reasoning content into prompt preview
  reasoningContent.innerHTML = `
    <!-- Header -->
    <div style="
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      flex-shrink: 0;
    ">
      <div style="font-size: 11px; color: #93c5fd; font-weight: 600;">PROMPT PREVIEW</div>
    </div>
    
    <!-- Content -->
    <div class="prompt-content-body" style="
      flex: 1;
      height: 300px;
      overflow-y: auto;
    ">
      <div style="
        font-size: 10px; 
        color: #d1d5db; 
        line-height: 1.4; 
        margin-bottom: 8px;
                padding-right: 4px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 8px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        white-space: pre-wrap;
      ">${focusedQuery}</div>
      
      <!-- Action Buttons -->
      <div style="
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        flex-shrink: 0;
        margin-top: 8px;
      ">
        <button onclick="window.cancelPromptPreview && window.cancelPromptPreview()" style="
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 500;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'">
          Cancel
        </button>
        <button onclick="window.sendGentrificationAnalysis && window.sendGentrificationAnalysis(this, '${neighborhoodName}', '${riskLevel}', '${timeline}', '${radius}')" style="
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        " onmouseover="this.style.background='linear-gradient(135deg, #2563eb, #1e40af)'" onmouseout="this.style.background='linear-gradient(135deg, #3b82f6, #1d4ed8)'">
          <span>🚀</span>
          <span>SEND</span>
        </button>
      </div>
    </div>
  `;
  
  // Show the transformed content
  reasoningContent.style.opacity = '1';
  
  console.log('✅ Reasoning section transformed to prompt preview');
};


// Global function to open Perplexity modal
window.openPerplexityModal = function(reasoning, sources, neighborhood) {
  // If reasoning is "No analysis available.", try to get the actual text from the popup content
  let actualReasoning = reasoning;
  if (reasoning === 'No analysis available.') {
    const popup = document.querySelector('.mapboxgl-popup');
    if (popup) {
      const reasoningContent = popup.querySelector('.reasoning-content-body div');
      if (reasoningContent) {
        const visibleText = reasoningContent.textContent || reasoningContent.innerText;
        if (visibleText && visibleText.trim() && visibleText !== 'No analysis available.') {
          actualReasoning = visibleText.trim();
        }
      }
    }
  }
  
  // Parse sources if it's a string
  let parsedSources = [];
  try {
    parsedSources = sources ? (typeof sources === 'string' ? JSON.parse(sources) : sources) : [];
  } catch (e) {
    parsedSources = [];
  }
  
  // Dispatch custom event to open modal
  const event = new CustomEvent('openPerplexityModal', {
    detail: {
      reasoning: actualReasoning,
      sources: parsedSources,
      neighborhood: neighborhood
    }
  });
  
  window.dispatchEvent(event);
};

// Global cancel prompt preview function
window.cancelPromptPreview = function() {
  console.log('❌ Canceling prompt preview...');
  
  // Find the popup and reasoning content
  const popup = document.querySelector('.mapboxgl-popup');
  const reasoningContent = popup?.querySelector('#reasoning-content');
  
  if (!reasoningContent) {
    console.error('❌ Could not find reasoning content to restore');
    return;
  }
  
  // Restore original reasoning content with collapsible functionality
  reasoningContent.innerHTML = `
    <!-- Header -->
    <div onclick="window.openPerplexityModal && window.openPerplexityModal('Click the refresh button to generate new analysis for this area.', '[]', 'Houston Area')" style="
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      flex-shrink: 0;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    " onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
      <div style="font-size: 11px; color: #93c5fd; font-weight: 600;">PERPLEXITY REASONING</div>
      <div style="font-size: 8px; color: #9ca3af; margin-left: 6px;">(Click to expand)</div>
    </div>
    
    <!-- Collapsible Content -->
    <div class="reasoning-content-body" style="
      flex: 1;
        height: 300px;
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
        scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
    ">
      <div style="
        font-size: 10px; 
        color: #d1d5db; 
        line-height: 1.4; 
        margin-bottom: 8px;
                padding-right: 4px;
      ">
        Click the refresh button to generate new analysis for this area.
      </div>
    </div>
  `;
  
  console.log('✅ Prompt preview canceled, reasoning section restored');
};

// Global send analysis function
window.sendGentrificationAnalysis = async function(button, neighborhoodName, riskLevel, timeline, radius) {
  console.log('🚀 Sending analysis request...');
  
  // Get the popup element
  const popup = document.querySelector('.mapboxgl-popup');
  const reasoningContent = popup?.querySelector('#reasoning-content');
  const skeleton = popup?.querySelector('#reasoning-skeleton');
  
  if (!reasoningContent || !skeleton) {
    console.error('❌ Could not find reasoning elements');
    return;
  }
  
  // Update button to loading state
  button.innerHTML = '<span>⏳</span><span>SENDING...</span>';
  button.style.pointerEvents = 'none';
  button.style.opacity = '0.7';
  
  // Show skeleton loading
  skeleton.style.display = 'block';
  skeleton.style.opacity = '1';
  reasoningContent.style.opacity = '0';
  
  try {
    // Create the focused query
    const focusedQuery = `Analyze the gentrification risk for the ${neighborhoodName} area in Houston, specifically focusing on:

- Current gentrification risk: ${riskLevel}%
- Timeline to unaffordability: ${timeline} months  
- Impact radius: ${radius}m
- Neighborhood characteristics and development patterns
- FIFA investment impact on this specific area
- Recent market trends and displacement factors

Provide a detailed analysis of why this area is at high risk and what specific factors are driving gentrification pressure. Focus on actionable insights and recent developments.`;
    
    // Call Perplexity API
    const response = await fetch('/api/perplexity-refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: focusedQuery,
        neighborhood: neighborhoodName,
        riskLevel: riskLevel,
        timeline: timeline,
        radius: radius
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update the reasoning content
    const analysisText = data.analysis || data.choices?.[0]?.message?.content || 'Analysis updated successfully.';
    const citations = data.citations || [];
    
    // Restore the reasoning section with new content and collapsible functionality
    reasoningContent.innerHTML = `
      <!-- Collapsible Header -->
      <div onclick="window.toggleReasoningSection && window.toggleReasoningSection(this)" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        flex-shrink: 0;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      " onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
        <div style="font-size: 11px; color: #93c5fd; font-weight: 600;">PERPLEXITY REASONING</div>
        <div class="reasoning-toggle-arrow" style="
          font-size: 10px;
          color: #9ca3af;
          transition: transform 0.2s ease;
        ">▼</div>
      </div>
      
      <!-- Collapsible Content -->
      <div class="reasoning-content-body" style="
        flex: 1;
        height: 300px;
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
        scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
      ">
        <div style="
          font-size: 10px; 
          color: #d1d5db; 
          line-height: 1.4; 
          margin-bottom: 8px;
                padding-right: 4px;
        ">${analysisText}</div>
        ${citations.length > 0 ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(59, 130, 246, 0.2); flex-shrink: 0;">
            <div style="font-size: 9px; color: #93c5fd; font-weight: 600; margin-bottom: 4px;">SOURCES:</div>
            <div style="
              max-height: 40px;
              overflow-y: auto;
              padding-right: 4px;
              scrollbar-width: thin;
              scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
            ">
              ${citations.map(citation => `
                <a href="${citation.url || citation}" target="_blank" style="
                  display: block;
                  font-size: 8px;
                  color: #60a5fa;
                  text-decoration: none;
                  margin-bottom: 2px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                  ${citation.title || citation.url?.split('/').pop() || 'Source'}
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    // Hide skeleton and show updated content
    skeleton.style.opacity = '0';
    skeleton.style.display = 'none';
    reasoningContent.style.opacity = '1';
    
    console.log('✅ Analysis sent and updated successfully');
    
  } catch (error) {
    console.error('❌ Error sending analysis:', error);
    
    // Show error state - restore reasoning section with error and collapsible functionality
    reasoningContent.innerHTML = `
      <!-- Collapsible Header -->
      <div onclick="window.toggleReasoningSection && window.toggleReasoningSection(this)" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        flex-shrink: 0;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      " onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
        <div style="font-size: 11px; color: #93c5fd; font-weight: 600;">PERPLEXITY REASONING</div>
        <div class="reasoning-toggle-arrow" style="
          font-size: 10px;
          color: #9ca3af;
          transition: transform 0.2s ease;
        ">▼</div>
      </div>
      
      <!-- Collapsible Content -->
      <div class="reasoning-content-body" style="
        flex: 1;
        height: 300px;
        overflow-y: auto;
        padding-right: 4px;
        scrollbar-width: thin;
        scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
      ">
        <div style="
          font-size: 10px; 
          color: #ef4444; 
          line-height: 1.4; 
          margin-bottom: 8px;
                padding-right: 4px;
        ">Error refreshing analysis: ${error.message}. Please try again.</div>
      </div>
    `;
    
    // Hide skeleton and show error
    skeleton.style.opacity = '0';
    skeleton.style.display = 'none';
    reasoningContent.style.opacity = '1';
  }
};

// Global reset position function
window.resetGentrificationPopupPosition = function() {
  const state = window.gentrificationDragState;
  if (state.currentPopup) {
    console.log('🔄 Resetting popup position to center');
    
    // Center the popup on screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupRect = state.currentPopup.getBoundingClientRect();
    
    const centerX = (viewportWidth - popupRect.width) / 2;
    const centerY = (viewportHeight - popupRect.height) / 2;
    
    // Override Mapbox positioning completely
    state.currentPopup.style.position = 'fixed';
    state.currentPopup.style.left = centerX + 'px';
    state.currentPopup.style.top = centerY + 'px';
    state.currentPopup.style.transform = 'none';
    state.currentPopup.style.margin = '0';
    
    // Hide the Mapbox popup tip/arrow
    const tip = state.currentPopup.querySelector('.mapboxgl-popup-tip');
    if (tip) {
      tip.style.display = 'none';
    }
    
    // Add a brief highlight effect
    state.currentPopup.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.8)';
    
    // Mark as manually positioned to prevent Mapbox from moving it
    state.currentPopup.setAttribute('data-manually-positioned', 'true');
    
    // Disable Mapbox's positioning system
    if (state.currentPopup._mapboxPopup) {
      state.currentPopup._mapboxPopup.options.closeOnClick = false;
      state.currentPopup._mapboxPopup.options.closeOnMove = false;
    }
    
    // Add event listener to prevent Mapbox from repositioning the popup
    const preventRepositioning = () => {
      if (state.currentPopup && state.currentPopup.getAttribute('data-manually-positioned') === 'true') {
        // Keep the popup in its current fixed position
        const currentLeft = state.currentPopup.style.left;
        const currentTop = state.currentPopup.style.top;
        if (currentLeft && currentTop) {
          state.currentPopup.style.position = 'fixed';
          state.currentPopup.style.left = currentLeft;
          state.currentPopup.style.top = currentTop;
          state.currentPopup.style.transform = 'none';
          state.currentPopup.style.margin = '0';
        }
      }
    };
    
    // Store the prevention function globally so it can be removed later
    window.preventGentrificationRepositioning = preventRepositioning;
    
    // Add map event listeners to prevent repositioning
    if (window.map && window.map.current) {
      window.map.current.on('move', preventRepositioning);
      window.map.current.on('zoom', preventRepositioning);
      window.map.current.on('rotate', preventRepositioning);
      window.map.current.on('pitch', preventRepositioning);
    }
    
    setTimeout(() => {
      state.currentPopup.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3)';
    }, 1000);
    
    console.log('✅ Popup reset to center', { centerX, centerY });
  }
};

// Add click handler for gentrification circles
export const addGentrificationClickHandler = (map) => {
  console.log('📍 Adding click handler for layer:', GENTRIFICATION_CONFIG.LAYER_IDS.circles);
  
  map.current.on('click', GENTRIFICATION_CONFIG.LAYER_IDS.circles, (e) => {
    console.log('🎯 Gentrification circle clicked');
    
    const feature = e.features[0];
    const properties = feature.properties;
    console.log('🔍 Clicked feature:', properties.neighborhood_name || properties.block_id);
    
    
    
    // Get risk level and color
    const riskLevel = properties.gentrification_risk || 0;
    const riskColor = riskLevel >= 0.8 ? '#dc2626' : riskLevel >= 0.6 ? '#ea580c' : '#f59e0b';
    const riskLabel = riskLevel >= 0.8 ? 'CRITICAL' : riskLevel >= 0.6 ? 'HIGH' : riskLevel >= 0.4 ? 'MEDIUM' : 'LOW';
    
    // Create concise, high-value popup with better visual hierarchy
    
    new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'gentrification-popup',
      maxWidth: 'none'
    })
    .setLngLat(e.lngLat)
    .setHTML(`
      <div style="
        background: rgba(17, 24, 39, 0.98);
        border-radius: 12px;
        padding: 16px;
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.08);
        width: 260px;

        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(20px);
        position: relative;
      ">
        <!-- Control Buttons -->
        <div style="
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 6px;
        ">
          <!-- Refresh Analysis Button -->
          <button id="refresh-analysis-btn" onclick="window.refreshGentrificationAnalysis && window.refreshGentrificationAnalysis(this)" style="
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            width: 20px;
            height: 20px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
            opacity: 0.8;
          " onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'; this.style.color='#93c5fd'; this.style.borderColor='rgba(59, 130, 246, 0.5)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.color='#60a5fa'; this.style.borderColor='rgba(59, 130, 246, 0.3)'" title="Refresh Perplexity analysis for this area">
            🔄
          </button>
          
          <!-- Drag Toggle Button -->
          <button id="drag-toggle-btn" style="
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: rgba(255, 255, 255, 0.6);
            width: 20px;
            height: 20px;
            border-radius: 6px;
            cursor: not-allowed;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
            opacity: 0.3;
            pointer-events: none;
          " onmouseover="if(this.style.pointerEvents !== 'none') { this.style.background='rgba(255, 255, 255, 0.15)'; this.style.color='white'; }" onmouseout="if(this.style.pointerEvents !== 'none') { this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='rgba(255, 255, 255, 0.6)'; }" title="Wait for animations to complete...">
            ⋮⋮
          </button>
          
          <!-- Reset Position Button -->
          <button id="reset-position-btn" onclick="window.resetGentrificationPopupPosition && window.resetGentrificationPopupPosition()" style="
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: rgba(255, 255, 255, 0.6);
            width: 20px;
            height: 20px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
            opacity: 0.7;
          " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.color='white'" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='rgba(255, 255, 255, 0.6)'" title="Reset popup position">
            ⌂
          </button>
          
          <!-- Close Button -->
          <button onclick="window.cleanupGentrificationPopup && window.cleanupGentrificationPopup(); this.closest('.mapboxgl-popup').remove()" style="
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: rgba(255, 255, 255, 0.6);
            width: 20px;
            height: 20px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'; this.style.color='white'" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='rgba(255, 255, 255, 0.6)'" title="Close">
            ×
          </button>
        </div>
        
        <!-- Header with Risk Indicator -->
        <div style="margin-bottom: 16px;">
          <div style="margin-bottom: 6px;">
            <div style="font-size: 14px; font-weight: 600; color: white; line-height: 1.2;">
              Risk Analysis
            </div>
            <div style="font-size: 11px; color: #9ca3af; font-weight: 500; margin-bottom: 4px;">
              ${properties.neighborhood_name || properties.block_id || 'Houston Block'}
            </div>
            <div style="
              background: linear-gradient(135deg, ${riskColor}30, ${riskColor}50);
              border: 1px solid ${riskColor};
              border-radius: 6px;
              padding: 4px 8px;
              font-size: 7px;
              font-weight: 700;
              color: white;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              display: inline-block;
            ">
              ${(riskLevel * 100).toFixed(0)}% ${riskLabel}
            </div>
          </div>
        </div>
        
        <!-- Perplexity Reasoning Section with Loading State -->
        <div id="reasoning-container" style="
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          position: relative;
          height: 120px;
          overflow: hidden;
          animation: containerExpand 0.3s ease-out 1s forwards;
        ">
          <!-- Skeleton Loading State -->
          <div id="reasoning-skeleton" style="
            display: block;
            animation: reasoningFadeOut 0.3s ease-out 1s forwards;
          ">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <div style="
                width: 120px;
                height: 12px;
                background: rgba(147, 197, 253, 0.3);
                border-radius: 4px;
                animation: skeletonPulse 1.5s ease-in-out infinite;
              "></div>
            </div>
            <div style="
              width: 100%;
              height: 8px;
              background: rgba(209, 213, 219, 0.2);
              border-radius: 4px;
              margin-bottom: 6px;
              animation: skeletonPulse 1.5s ease-in-out infinite;
              animation-delay: 0.1s;
            "></div>
            <div style="
              width: 95%;
              height: 8px;
              background: rgba(209, 213, 219, 0.2);
              border-radius: 4px;
              margin-bottom: 6px;
              animation: skeletonPulse 1.5s ease-in-out infinite;
              animation-delay: 0.2s;
            "></div>
            <div style="
              width: 75%;
              height: 8px;
              background: rgba(209, 213, 219, 0.2);
              border-radius: 4px;
              margin-bottom: 8px;
              animation: skeletonPulse 1.5s ease-in-out infinite;
              animation-delay: 0.3s;
            "></div>
            <div style="
              width: 60px;
              height: 6px;
              background: rgba(147, 197, 253, 0.3);
              border-radius: 3px;
              margin-bottom: 4px;
              animation: skeletonPulse 1.5s ease-in-out infinite;
              animation-delay: 0.4s;
            "></div>
            <div style="
              width: 80%;
              height: 6px;
              background: rgba(96, 165, 250, 0.2);
              border-radius: 3px;
              animation: skeletonPulse 1.5s ease-in-out infinite;
              animation-delay: 0.5s;
            "></div>
          </div>
          
          <!-- Actual Content -->
          <div id="reasoning-content" style="
            opacity: 0;
            animation: reasoningFadeIn 0.3s ease-in 1s forwards;
            height: 100%;
            display: flex;
            flex-direction: column;
          ">
            <!-- Header -->
            <div onclick="window.openPerplexityModal && window.openPerplexityModal('${properties.analysis || properties.perplexity_reasoning || properties.perplexity_analysis || 'No analysis available.'}', '${properties.analysis_sources ? JSON.stringify(properties.analysis_sources) : '[]'}', '${properties.neighborhood_name || properties.block_id || 'Houston Area'}')" style="
              display: flex;
              align-items: center;
              margin-bottom: 8px;
              flex-shrink: 0;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              transition: background-color 0.2s ease;
            " onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
              <div style="font-size: 11px; color: #93c5fd; font-weight: 600;">PERPLEXITY REASONING</div>
            </div>
            
            <!-- Content -->
            <div class="reasoning-content-body" style="
              flex: 1;
              overflow-y: auto;
            ">
              <div style="
                font-size: 10px; 
                color: #d1d5db; 
                line-height: 1.4; 
                margin-bottom: 8px;
                height: 100%;
                overflow-y: auto;
                padding-right: 4px;
                scrollbar-width: thin;
                scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
              ">
                ${properties.analysis || properties.perplexity_reasoning || properties.perplexity_analysis || `Perplexity AI identified this ${properties.neighborhood_name || 'area'} location as high-risk due to proximity to FIFA investment clusters (${properties.investment_cluster_proximity || 'major development zones'}), rapid development momentum (${properties.development_momentum_score || 'N/A'}/10), and ${(riskLevel * 100).toFixed(0)}% gentrification probability based on real estate market analysis.`}
              </div>
              ${properties.analysis_sources && properties.analysis_sources.length > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(59, 130, 246, 0.2); flex-shrink: 0;">
                  <div style="font-size: 9px; color: #93c5fd; font-weight: 600; margin-bottom: 4px;">SOURCES:</div>
                  <div style="
                    max-height: 40px;
                    overflow-y: auto;
                    padding-right: 4px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
                  ">
                    ${properties.analysis_sources.map(source => `
                      <a href="${source.url}" target="_blank" style="
                        display: block;
                        font-size: 8px;
                        color: #60a5fa;
                        text-decoration: none;
                        margin-bottom: 2px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                        ${source.title || source.url}
                      </a>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- CSS Animations -->
          <style>
            @keyframes skeletonPulse {
              0%, 100% {
                opacity: 0.4;
              }
              50% {
                opacity: 0.8;
              }
            }
            
            @keyframes reasoningFadeOut {
              to {
                opacity: 0;
                pointer-events: none;
                display: none;
              }
            }
            
            @keyframes reasoningFadeIn {
              0% {
                opacity: 0;
              }
              100% {
                opacity: 1;
              }
            }
            
            @keyframes containerExpand {
              from {
                height: 60px;
              }
              to {
                height: 165px;
              }
            }
            
            @keyframes detailsFadeIn {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            /* Custom scrollbar styling */
            .gentrification-popup ::-webkit-scrollbar {
              width: 4px;
            }
            
            .gentrification-popup ::-webkit-scrollbar-track {
              background: rgba(59, 130, 246, 0.1);
              border-radius: 2px;
            }
            
            .gentrification-popup ::-webkit-scrollbar-thumb {
              background: rgba(59, 130, 246, 0.4);
              border-radius: 2px;
            }
            
            .gentrification-popup ::-webkit-scrollbar-thumb:hover {
              background: rgba(59, 130, 246, 0.6);
            }
          </style>
        </div>
        
        <!-- Drag Functionality Script -->
        <script>
          // Functions are now defined globally at module level
          // This script just ensures they're available when the popup is created
          console.log('🔧 Gentrification popup script loaded, functions available:', {
            toggleDragMode: typeof window.toggleDragMode,
            handleMouseDown: typeof window.handleGentrificationMouseDown,
            handleMouseMove: typeof window.handleGentrificationMouseMove,
            handleMouseUp: typeof window.handleGentrificationMouseUp
          });
          
          // Add CSS to ensure popup stays visible during drag
          const style = document.createElement('style');
          style.textContent = \`
            .gentrification-popup {
              position: fixed !important;
              z-index: 10000 !important;
            }
            .gentrification-popup .mapboxgl-popup-content {
              position: relative !important;
            }
            .gentrification-popup .mapboxgl-popup-tip {
              display: none !important;
            }
          \`;
          document.head.appendChild(style);
          
          // Dynamic height adjustment for reasoning container
          setTimeout(() => {
            const container = document.getElementById('reasoning-container');
            const content = document.getElementById('reasoning-content');
            if (container && content) {
              // Calculate the natural height needed for the content
              const contentHeight = content.scrollHeight;
              const padding = 24; // 12px top + 12px bottom
              const naturalHeight = contentHeight + padding;
              
              // Only expand if content is taller than current height
              if (naturalHeight > 180) {
                container.style.height = naturalHeight + 'px';
                container.style.transition = 'height 0.3s ease-out';
                console.log('📏 Reasoning container expanded to fit content:', naturalHeight + 'px');
              }
            }
          }, 1500); // Wait for all animations to complete
        </script>
        
        <!-- Details section removed -->
      </div>
    `)
    .addTo(map.current);
    
    // Initialize drag functionality after popup animations complete
    setTimeout(() => {
      const popupElement = document.querySelector('.mapboxgl-popup');
      const dragButton = document.getElementById('drag-toggle-btn');
      if (popupElement && dragButton) {
        // Initially disable drag button during animations
        dragButton.style.opacity = '0.3';
        dragButton.style.pointerEvents = 'none';
        dragButton.style.cursor = 'not-allowed';
        dragButton.title = 'Wait for animations to complete...';
        
        // Function to enable drag functionality
        const enableDragButton = () => {
          console.log('🔧 enableDragButton called', {
            dragButton: dragButton,
            currentStyle: {
              opacity: dragButton.style.opacity,
              pointerEvents: dragButton.style.pointerEvents,
              cursor: dragButton.style.cursor
            }
          });
          
          dragButton.style.opacity = '1';
          dragButton.style.pointerEvents = 'auto';
          dragButton.style.cursor = 'pointer';
          dragButton.title = 'Toggle drag mode';
          
          // Add click event listener programmatically
          dragButton.addEventListener('click', function(e) {
            console.log('🖱️ Drag button clicked via event listener', this);
            e.preventDefault();
            e.stopPropagation();
            window.toggleDragMode(this);
          });
          
          console.log('✅ Gentrification popup drag functionality enabled after animations', {
            newStyle: {
              opacity: dragButton.style.opacity,
              pointerEvents: dragButton.style.pointerEvents,
              cursor: dragButton.style.cursor
            }
          });
        };
        
        // Simple approach: enable after a reasonable delay
        // The longest animation is detailsFadeIn at 2s, so wait 2.5s total
        setTimeout(() => {
          console.log('Enabling drag button after animation timeout');
          enableDragButton();
          
          // Test if button click is working
          setTimeout(() => {
            console.log('🧪 Testing button click detection...');
            const testButton = document.getElementById('drag-toggle-btn');
            if (testButton) {
              console.log('🧪 Button found:', testButton);
              console.log('🧪 Button onclick attribute:', testButton.getAttribute('onclick'));
              console.log('🧪 Button style:', {
                opacity: testButton.style.opacity,
                pointerEvents: testButton.style.pointerEvents,
                cursor: testButton.style.cursor
              });
              
              // Test click programmatically
              console.log('🧪 Testing programmatic click...');
              testButton.click();
            } else {
              console.log('❌ Button not found!');
            }
          }, 1000);
        }, 2500);
      }
    }, 200);
  });
};

// Add hover effects for gentrification circles
export const addGentrificationHoverEffects = (map) => {
  // Change cursor on hover
  map.current.on('mouseenter', GENTRIFICATION_CONFIG.LAYER_IDS.circles, () => {
    map.current.getCanvas().style.cursor = 'pointer';
  });
  
  map.current.on('mouseleave', GENTRIFICATION_CONFIG.LAYER_IDS.circles, () => {
    map.current.getCanvas().style.cursor = '';
  });
};
