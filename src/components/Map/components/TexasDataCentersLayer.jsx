import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../constants';
import { fetchTexasDataCentersGeoJson } from '../../../utils/texasDataCentersDataset';
import {
  deriveTexasDataCenterStatus,
  formatTexasDataCenterStatusLabel,
  isTexasDataCenterOperational
} from '../../../utils/texasDataCenterStatus';
import { logUiEvent } from '../../../services/uiEvents';

// Add custom styles for Texas Data Centers popup to override Mapbox defaults
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('texas-dc-popup-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  const style = document.createElement('style');
  style.id = 'texas-dc-popup-styles';
  style.textContent = `
    .texas-data-center-popup.mapboxgl-popup .mapboxgl-popup-content {
      background: transparent !important;
      border: none !important;
      border-width: 0 !important;
      border-style: none !important;
      border-color: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
      outline: none !important;
    }
    .texas-data-center-popup.mapboxgl-popup .mapboxgl-popup-tip {
      display: none !important;
      border: none !important;
      border-width: 0 !important;
    }
    .texas-data-center-popup.mapboxgl-popup {
      border: none !important;
      outline: none !important;
    }
    .marker-label-popup.mapboxgl-popup .mapboxgl-popup-content {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
    .marker-label-popup.mapboxgl-popup .mapboxgl-popup-tip { display: none !important; }
  `;
  // Append to head, or if MapStyles exists, insert after it
  const mapStyles = document.getElementById('map-styles') || document.querySelector('style[data-styled]');
  if (mapStyles && mapStyles.parentNode) {
    mapStyles.parentNode.insertBefore(style, mapStyles.nextSibling);
  } else {
    document.head.appendChild(style);
  }
}

const DATA_CENTERS_SOURCE_ID = 'texas-data-centers-source';
const DATA_CENTERS_LAYER_ID = 'texas-data-centers-layer';
const DATA_CENTERS_PULSE_LAYER_ID = 'texas-data-centers-pulse-layer';
const CLICK_PULSE_SOURCE_ID = 'texas-data-centers-click-pulse-source';
const CLICK_PULSE_LAYER_ID = 'texas-data-centers-click-pulse-layer';
const CLICK_HIGHLIGHT_SOURCE_ID = 'texas-data-centers-click-highlight-source';
const CLICK_HIGHLIGHT_LAYER_ID = 'texas-data-centers-click-highlight-layer';

const statusColors = {
  'active': '#10b981',
  'uncertain': '#f59e0b',
  'dead_candidate': '#ef4444',
  'revived': '#3b82f6',
  'unknown': '#6b7280'
};

const getStatusColor = (status) => statusColors[status] || statusColors['unknown'];

const parseDateSafe = (value) => {
  if (value === null || value === undefined) return null;

  // Accept epoch millis
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let str = String(value).trim();
  if (!str) return null;

  // Safari/iOS often fails to parse "YYYY-MM-DD HH:mm:ss".
  // Normalize to ISO-ish.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T');
  }

  // Date-only: ensure consistent parsing across browsers.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str = `${str}T00:00:00`;
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown';
  const date = parseDateSafe(dateStr);
  if (!date) return String(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatInstalledMwBadge = (value) => {
  const mw = Number(value);
  if (!Number.isFinite(mw) || mw <= 0) return null;
  const compact = Number.isInteger(mw) ? String(mw) : String(Number(mw.toFixed(1)));
  return `${compact}MW`;
};

const getMarkerBadgeText = (props = {}) => {
  // Priority order:
  // 1) Installed XMW
  // 2) Operational
  // 3) Sources N (N >= 2)
  // 4) no badge
  const installedBadge = formatInstalledMwBadge(props.installed_mw);
  if (installedBadge) return installedBadge;

  if ((props.status || '').toLowerCase() === 'operational') {
    return 'Operational';
  }

  const sourceCount = Number(props.source_count);
  if (Number.isFinite(sourceCount) && sourceCount >= 2) {
    return `Sources ${Math.floor(sourceCount)}`;
  }

  return '';
};

const formatSize = (mw, sqft, acres) => {
  const parts = [];
  if (mw) parts.push(`${mw} MW`);
  if (sqft) parts.push(`${sqft.toLocaleString()} sq ft`);
  if (acres) parts.push(`${acres.toLocaleString()} acres`);
  return parts.length > 0 ? parts.join(' • ') : 'Size not specified';
};

const getProbabilityColor = (score) => {
  switch (score) {
    case 'high': return '#10b981'; // green
    case 'medium': return '#f59e0b'; // orange
    case 'low': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
};

const getProbabilityLabel = (score) => {
  switch (score) {
    case 'high': return 'High Progress Likelihood';
    case 'medium': return 'Medium Progress Likelihood';
    case 'low': return 'Low Progress Likelihood';
    default: return 'Unknown';
  }
};

const getTexasDataCenterLabelTextColor = (mapTheme) => (
  mapTheme === 'light' ? '#000000' : '#ffffff'
);

// GeoJSON / master list use "company" (and city); popup/card previously expected "project_name".
// On laptop, marker click shows both LocationSearchCard and this popup ("second card") — use same display name.
const getProjectDisplayName = (props) => {
  if (!props) return 'Unknown Project';
  const name = props.project_name || props.company || props.name;
  if (name && String(name).trim()) return String(name).trim();
  if (props.city && String(props.city).trim()) return String(props.city).trim();
  return 'Unknown Project';
};

const createPopupHTML = (props) => {
  const uiStatus = deriveTexasDataCenterStatus(props);
  const statusColor = getStatusColor(uiStatus);
  const statusText = formatTexasDataCenterStatusLabel(uiStatus);
  const popupId = `popup-${props.project_id || Math.random().toString(36).substr(2, 9)}`;
  const displayName = getProjectDisplayName(props);

  return `
    <div style="
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      max-width: 240px;
      min-width: 200px;
    ">
      <div 
        id="${popupId}-header"
        onclick="
          const details = document.getElementById('${popupId}-details');
          const header = document.getElementById('${popupId}-header');
          if (details.style.display === 'none') {
            details.style.display = 'block';
          } else {
            details.style.display = 'none';
          }
        "
        style="
          font-weight: 600; 
          font-size: 14px; 
          margin-bottom: 6px; 
          color: #ffffff;
          cursor: pointer;
          user-select: none;
          transition: opacity 0.2s ease;
        "
        onmouseover="this.style.opacity='0.8'"
        onmouseout="this.style.opacity='1'"
      >
        ${displayName}
      </div>
      <div style="
        display: inline-block;
        background: ${statusColor};
        color: #000000;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        margin-bottom: 8px;
        text-transform: capitalize;
      ">
        ${statusText}
      </div>
      <div style="margin-bottom: 3px; font-weight: 500; color: #d1d5db; font-size: 11px;">
        ${props.company || 'Unknown'}
      </div>
      <div style="margin-bottom: 3px; color: #d1d5db; font-size: 11px;">
        ${props.location || 'Unknown Location'}
      </div>
      <div style="margin-bottom: 8px; color: #d1d5db; font-size: 11px;">
        ${formatSize(props.size_mw, props.size_sqft, props.size_acres)}
      </div>
      
      <!-- Additional details (hidden by default) -->
      <div id="${popupId}-details" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        ${props.site_hint ? `
          <div style="margin-bottom: 4px; color: #9ca3af; font-size: 10px;">
            ${props.site_hint}
          </div>
        ` : ''}
        ${props.announced_date ? `
          <div style="margin-bottom: 4px; color: #9ca3af; font-size: 10px;">
            Announced: ${formatDate(props.announced_date)}
          </div>
        ` : ''}
        ${props.expected_completion_date ? `
          <div style="margin-bottom: 4px; color: #9ca3af; font-size: 10px;">
            Expected: ${props.expected_completion_date}
          </div>
        ` : ''}
        ${props.probability_score && props.probability_score !== 'unknown' ? `
          <div style="margin-bottom: 4px; font-size: 10px;">
            <span style="
              display: inline-block;
              background: ${getProbabilityColor(props.probability_score)};
              color: #000000;
              padding: 2px 6px;
              border-radius: 8px;
              font-weight: 500;
            ">
              ${getProbabilityLabel(props.probability_score)}
            </span>
          </div>
        ` : ''}
        ${props.source_url && props.article_title ? `
          <a 
            href="${props.source_url}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="
              color: #60a5fa;
              text-decoration: underline;
              cursor: pointer;
              font-size: 10px;
              display: block;
              margin-top: 6px;
              font-style: italic;
              line-height: 1.3;
            "
          >
            ${props.article_title}
          </a>
        ` : props.source_url ? `
          <a 
            href="${props.source_url}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="
              color: #60a5fa;
              text-decoration: underline;
              cursor: pointer;
              font-size: 11px;
              display: inline-block;
              margin-top: 4px;
            "
          >
            View Article →
          </a>
        ` : ''}
        ${props.source_count > 1 ? `
          <div style="margin-top: 4px; color: #6b7280; font-size: 9px;">
            +${props.source_count - 1} more source${props.source_count - 1 > 1 ? 's' : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

/** Format Texas data center props as markdown for AI response card (mobile) */
export const formatTexasDataCenterForCard = (props) => {
  const statusText = (props.status || 'unknown').replace('_', ' ');
  const sizeStr = formatSize(props.size_mw, props.size_sqft, props.size_acres);
  const displayName = getProjectDisplayName(props);
  let md = `**${displayName}**\n\n`;
  md += `**${statusText}** • ${props.company || 'Unknown'}\n\n`;
  md += `${props.location || 'Unknown Location'}\n\n`;
  md += `${sizeStr}\n\n`;
  if (props.announced_date) md += `Announced: ${formatDate(props.announced_date)}\n\n`;
  if (props.expected_completion_date) md += `Expected: ${props.expected_completion_date}\n\n`;
  if (props.site_hint) md += `${props.site_hint}\n\n`;
  if (props.probability_score && props.probability_score !== 'unknown') {
    md += `${getProbabilityLabel(props.probability_score)}\n\n`;
  }
  return md.trim();
};

const TexasDataCentersLayer = ({ map, visible, mapTheme = 'dark' }) => {
  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const popupRef = useRef(null);
  const replacingPopupRef = useRef(false);
  const pulseAnimationRef = useRef(null);
  const clickPulseAnimationRef = useRef(null);
  const clickLabelPopupRef = useRef(null);
  const dataRef = useRef(null); // Store the GeoJSON data for lookup

  const getPreferredCenterCoordinates = (featureOrProps, fallbackCoordinates) => {
    const props = featureOrProps?.properties || featureOrProps || {};
    const original = props?._original_coords;
    if (Array.isArray(original) && original.length >= 2) {
      const [lng, lat] = original;
      if (Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
        return [Number(lng), Number(lat)];
      }
    }
    return fallbackCoordinates;
  };

  // 2-second bright pulse animation when marker is clicked
  const animateClickPulse = (coordinates, statusColor, name = '') => {
    if (!map.current || !map.current.getLayer(DATA_CENTERS_LAYER_ID)) return;
    if (clickPulseAnimationRef.current) {
      cancelAnimationFrame(clickPulseAnimationRef.current);
      clickPulseAnimationRef.current = null;
    }
    if (clickLabelPopupRef.current) {
      clickLabelPopupRef.current.remove();
      clickLabelPopupRef.current = null;
    }
    if (map.current.getLayer(CLICK_PULSE_LAYER_ID)) map.current.removeLayer(CLICK_PULSE_LAYER_ID);
    if (map.current.getSource(CLICK_PULSE_SOURCE_ID)) map.current.removeSource(CLICK_PULSE_SOURCE_ID);
    if (map.current.getLayer(CLICK_HIGHLIGHT_LAYER_ID)) map.current.removeLayer(CLICK_HIGHLIGHT_LAYER_ID);
    if (map.current.getSource(CLICK_HIGHLIGHT_SOURCE_ID)) map.current.removeSource(CLICK_HIGHLIGHT_SOURCE_ID);

    const highlightFeature = { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { color: statusColor } };
    map.current.addSource(CLICK_HIGHLIGHT_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [highlightFeature] }
    });
    const currentZoom = map.current.getZoom();
    const highlightRadius = currentZoom < 7.5 ? 8 : currentZoom < 12.5 ? 12 : 20;
    map.current.addLayer({
      id: CLICK_HIGHLIGHT_LAYER_ID,
      type: 'circle',
      source: CLICK_HIGHLIGHT_SOURCE_ID,
      paint: {
        'circle-radius': highlightRadius,
        'circle-color': statusColor,
        'circle-opacity': 0.85,
        'circle-stroke-width': 0
      }
    }, DATA_CENTERS_LAYER_ID + '-labels');

    const pulseFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: {}
    };
    map.current.addSource(CLICK_PULSE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [pulseFeature] }
    });
    const baseRadius = currentZoom < 7.5 ? 10 : currentZoom < 12.5 ? 18 : 25;
    map.current.addLayer({
      id: CLICK_PULSE_LAYER_ID,
      type: 'circle',
      source: CLICK_PULSE_SOURCE_ID,
      paint: {
        'circle-radius': baseRadius,
        'circle-color': '#ffffff',
        'circle-opacity': 0.8,
        'circle-blur': 0.2
      }
    }, DATA_CENTERS_LAYER_ID + '-labels');

    // Dim other markers while pulse is active
    if (map.current.getLayer(DATA_CENTERS_LAYER_ID)) map.current.setPaintProperty(DATA_CENTERS_LAYER_ID, 'circle-opacity', 0.2);
    if (map.current.getLayer(DATA_CENTERS_LAYER_ID + '-labels')) map.current.setPaintProperty(DATA_CENTERS_LAYER_ID + '-labels', 'text-opacity', 0.2);
    if (map.current.getLayer(DATA_CENTERS_PULSE_LAYER_ID)) map.current.setPaintProperty(DATA_CENTERS_PULSE_LAYER_ID, 'circle-opacity', 0.1);

    // Show name label above marker (dark theme, small, 2-3 words, 10 seconds)
    if (name) {
      const shortName = name.split(/\s+/).slice(0, 3).join(' ').replace(/</g, '&lt;') || name.replace(/</g, '&lt;');
      const labelHtml = `<div style="background:#1a1a1a;color:#e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${shortName}</div>`;
      clickLabelPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        anchor: 'bottom',
        offset: [0, -18],
        className: 'marker-label-popup'
      }).setLngLat(coordinates).setHTML(labelHtml).addTo(map.current);
      setTimeout(() => {
        if (clickLabelPopupRef.current) {
          clickLabelPopupRef.current.remove();
          clickLabelPopupRef.current = null;
        }
      }, 10000);
    }

    const startTime = Date.now();
    const durationMs = 2000;
    const animate = () => {
      if (!map.current || !map.current.getLayer(CLICK_PULSE_LAYER_ID)) {
        clickPulseAnimationRef.current = null;
        return;
      }
      const elapsed = Date.now() - startTime;
      if (elapsed >= durationMs) {
        if (map.current.getLayer(CLICK_PULSE_LAYER_ID)) map.current.removeLayer(CLICK_PULSE_LAYER_ID);
        if (map.current.getSource(CLICK_PULSE_SOURCE_ID)) map.current.removeSource(CLICK_PULSE_SOURCE_ID);
        if (map.current.getLayer(CLICK_HIGHLIGHT_LAYER_ID)) map.current.removeLayer(CLICK_HIGHLIGHT_LAYER_ID);
        if (map.current.getSource(CLICK_HIGHLIGHT_SOURCE_ID)) map.current.removeSource(CLICK_HIGHLIGHT_SOURCE_ID);
        // Restore other markers
        if (map.current.getLayer(DATA_CENTERS_LAYER_ID)) map.current.setPaintProperty(DATA_CENTERS_LAYER_ID, 'circle-opacity', 0.85);
        if (map.current.getLayer(DATA_CENTERS_LAYER_ID + '-labels')) map.current.setPaintProperty(DATA_CENTERS_LAYER_ID + '-labels', 'text-opacity', 0.95);
        if (map.current.getLayer(DATA_CENTERS_PULSE_LAYER_ID)) map.current.setPaintProperty(DATA_CENTERS_PULSE_LAYER_ID, 'circle-opacity', 0.6);
        clickPulseAnimationRef.current = null;
        return;
      }
      const progress = elapsed / durationMs;
      const pulsePhase = Math.sin(progress * Math.PI);
      const opacity = 0.4 + pulsePhase * 0.6;
      const radius = baseRadius + pulsePhase * 6;
      map.current.setPaintProperty(CLICK_PULSE_LAYER_ID, 'circle-opacity', opacity);
      map.current.setPaintProperty(CLICK_PULSE_LAYER_ID, 'circle-radius', radius);
      clickPulseAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  // Calculate pulse intensity based on article recency
  const getPulseIntensity = (announcedDate) => {
    if (!announcedDate) return 0; // No pulse for unknown dates
    
    const now = new Date();
    const announced = new Date(announcedDate);
    const daysSince = (now - announced) / (1000 * 60 * 60 * 24);
    
    // More recent = deeper pulse (more visible)
    // 0-30 days: 0.6-0.8 pulse depth (very strong pulse)
    // 30-90 days: 0.4-0.6 (strong pulse)
    // 90-180 days: 0.2-0.4 (medium pulse)
    // 180+ days: 0 (no pulse)
    
    if (daysSince < 30) {
      return 0.6 + (0.2 * (1 - daysSince / 30)); // 0.6 to 0.8
    } else if (daysSince < 90) {
      return 0.4 + (0.2 * (1 - (daysSince - 30) / 60)); // 0.4 to 0.6
    } else if (daysSince < 180) {
      return 0.2 + (0.2 * (1 - (daysSince - 90) / 90)); // 0.2 to 0.4
    } else {
      return 0; // No pulse for old articles
    }
  };
  
  // Check if article is recent (for red pulse)
  const isRecent = (announcedDate) => {
    if (!announcedDate) return false;
    const now = new Date();
    const announced = new Date(announcedDate);
    const daysSince = (now - announced) / (1000 * 60 * 60 * 24);
    return daysSince < 90; // Recent = less than 90 days
  };

  // Helper function to show popup for a project
  const showPopupForProject = (props, coordinates, shouldZoom = true, isReplacing = false) => {
    if (!map.current) return;
    
    // Close any existing ERCOT Counties popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    existingPopups.forEach(popup => {
      const popupElement = popup;
      if (popupElement && !popupElement.classList.contains('texas-data-center-popup')) {
        popupElement.remove();
      }
    });
    
    // Zoom in on the marker if requested
    if (shouldZoom) {
      const currentZoom = map.current.getZoom();
      const targetZoom = Math.min(currentZoom + 2, 14); // Zoom in by 2 levels, max 14
      map.current.flyTo({
        center: coordinates,
        zoom: targetZoom,
        duration: 800,
        essential: true
      });
    }
    
    // Remove existing popup (suppress carousel clear when replacing from carousel card click)
    if (popupRef.current) {
      if (isReplacing) replacingPopupRef.current = true;
      popupRef.current.remove();
      popupRef.current = null;
    }
    
    // Create popup HTML
    const popupHTML = createPopupHTML(props);
    
    // Create new popup positioned above the marker
    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'bottom',
      offset: [0, -10], // Position above marker with 10px gap
      maxWidth: '400px',
      className: 'texas-data-center-popup'
    })
      .setLngLat(coordinates)
      .setHTML(popupHTML)
      .addTo(map.current);
    
    // Force remove border from popup content after it's added to DOM
    setTimeout(() => {
      if (popupRef.current) {
        const popupElement = popupRef.current.getElement();
        if (popupElement) {
          const content = popupElement.querySelector('.mapboxgl-popup-content');
          if (content) {
            content.style.background = 'transparent';
            content.style.border = 'none';
            content.style.borderWidth = '0';
            content.style.padding = '0';
            content.style.boxShadow = 'none';
            content.style.outline = 'none';
          }
          const tip = popupElement.querySelector('.mapboxgl-popup-tip');
          if (tip) {
            tip.style.display = 'none';
            tip.style.border = 'none';
          }
        }
      }
    }, 0);
    
    // Handle popup close - clear timeline carousel (unless we're replacing from carousel card click)
    popupRef.current.on('close', () => {
      popupRef.current = null;
      if (!replacingPopupRef.current && window.mapEventBus) {
        window.mapEventBus.emit('timeline:carouselClear', {});
      }
      replacingPopupRef.current = false;
    });
  };

  // Pulse animation function - subtle pulse for operational facilities only
  const animatePulse = (data) => {
    if (!map.current || !map.current.getLayer(DATA_CENTERS_LAYER_ID)) return;
    
    const startTime = Date.now();
    const pulseDuration = 2500; // 2.5s cycle for a calmer "live" signal.
    
    // Pulse only operational facilities.
    const operationalFeatures = data.features.filter((f) => Boolean(f?.properties?._marker_operational));
    
    if (operationalFeatures.length === 0) return;
    
    // Create pulse source with operational features only.
    const pulseSource = map.current.getSource(DATA_CENTERS_SOURCE_ID + '-pulse');
    if (!pulseSource) {
      map.current.addSource(DATA_CENTERS_SOURCE_ID + '-pulse', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: operationalFeatures
        }
      });
      
      // Add pulse layer.
      map.current.addLayer({
        id: DATA_CENTERS_PULSE_LAYER_ID,
        type: 'circle',
        source: DATA_CENTERS_SOURCE_ID + '-pulse',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 4,
            10, 6,
            15, 9
          ],
          'circle-color': '#3CFFB4',
          'circle-opacity': 0.2,
          'circle-stroke-width': 0
        }
      });
    }
    
    const animate = () => {
      if (!map.current || !map.current.getLayer(DATA_CENTERS_PULSE_LAYER_ID)) {
        pulseAnimationRef.current = null;
        return;
      }
      
      const elapsed = (Date.now() - startTime) % pulseDuration;
      const progress = elapsed / pulseDuration;
      const pulsePhase = Math.sin(progress * Math.PI * 2); // -1 to 1
      const normalizedPhase = (pulsePhase + 1) / 2; // 0 to 1
      
      // Subtle pulse opacity: 0.08 to 0.28
      const opacity = 0.08 + (normalizedPhase * 0.2);
      map.current.setPaintProperty(DATA_CENTERS_PULSE_LAYER_ID, 'circle-opacity', opacity);
      
      // Pulse radius: slight breathe effect.
      const currentZoom = map.current.getZoom();
      const baseRadius = currentZoom < 7.5 ? 4 : currentZoom < 12.5 ? 6 : 9;
      const radiusPulse = normalizedPhase * 2;
      map.current.setPaintProperty(DATA_CENTERS_PULSE_LAYER_ID, 'circle-radius', baseRadius + radiusPulse);
      
      pulseAnimationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  useEffect(() => {
    if (!map?.current) return;
    if (!visible) {
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      if (clickPulseAnimationRef.current) {
        cancelAnimationFrame(clickPulseAnimationRef.current);
        clickPulseAnimationRef.current = null;
      }
      if (map.current.getLayer(CLICK_PULSE_LAYER_ID)) map.current.removeLayer(CLICK_PULSE_LAYER_ID);
      if (map.current.getSource(CLICK_PULSE_SOURCE_ID)) map.current.removeSource(CLICK_PULSE_SOURCE_ID);
      if (map.current.getLayer(DATA_CENTERS_PULSE_LAYER_ID)) map.current.removeLayer(DATA_CENTERS_PULSE_LAYER_ID);
      if (map.current.getSource(DATA_CENTERS_SOURCE_ID + '-pulse')) map.current.removeSource(DATA_CENTERS_SOURCE_ID + '-pulse');
      if (map.current.getLayer(DATA_CENTERS_LAYER_ID + '-labels')) map.current.removeLayer(DATA_CENTERS_LAYER_ID + '-labels');
      if (map.current.getLayer(DATA_CENTERS_LAYER_ID)) map.current.removeLayer(DATA_CENTERS_LAYER_ID);
      if (map.current.getSource(DATA_CENTERS_SOURCE_ID)) map.current.removeSource(DATA_CENTERS_SOURCE_ID);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }
    let cancelled = false;
    const addLayer = async () => {
      try {
        const resp = await fetchTexasDataCentersGeoJson();
        if (!resp.ok) {
          throw new Error(`Failed to load Texas data centers (${resp.status})`);
        }
        const data = await resp.json();
        if (!Array.isArray(data?.features)) {
          throw new Error('Texas data centers payload is missing features[]');
        }
        if (cancelled) return;
        
        // Store processed data in ref for lookup (after processing)
        
        if (map.current.getLayer(DATA_CENTERS_LAYER_ID + '-labels')) map.current.removeLayer(DATA_CENTERS_LAYER_ID + '-labels');
        if (map.current.getLayer(DATA_CENTERS_LAYER_ID)) map.current.removeLayer(DATA_CENTERS_LAYER_ID);
        if (map.current.getSource(DATA_CENTERS_SOURCE_ID)) map.current.removeSource(DATA_CENTERS_SOURCE_ID);
        
        // Process data: add recency text and apply offsets for overlapping markers
        const coordinateMap = new Map(); // Track coordinates to detect overlaps
        
        const processedData = {
          ...data,
          features: data.features.map((feature, index) => {
            const coords = feature.geometry.coordinates;
            const coordKey = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
            const badgeText = getMarkerBadgeText(feature.properties || {});
            const rawProps = feature.properties || {};
            const derivedStatus = deriveTexasDataCenterStatus(rawProps);
            const isOperational = isTexasDataCenterOperational(rawProps);
            
            // Check if this coordinate already exists
            if (coordinateMap.has(coordKey)) {
              // Apply small random offset to separate overlapping markers
              const existingCount = coordinateMap.get(coordKey);
              coordinateMap.set(coordKey, existingCount + 1);
              
              // Create a spiral offset pattern for multiple overlaps
              const angle = (existingCount * 137.508) % 360; // Golden angle for even distribution
              const radius = 0.002 * existingCount; // ~200m per overlap
              const offsetLng = coords[0] + radius * Math.cos(angle * Math.PI / 180);
              const offsetLat = coords[1] + radius * Math.sin(angle * Math.PI / 180);
              
              return {
                ...feature,
                geometry: {
                  ...feature.geometry,
                  coordinates: [offsetLng, offsetLat]
                },
                properties: {
                  ...rawProps,
                  status: derivedStatus,
                  recency_text: badgeText,
                  _marker_operational: isOperational,
                  _original_coords: coords, // Store original for reference
                  _offset_applied: true
                }
              };
            } else {
              coordinateMap.set(coordKey, 1);
              return {
                ...feature,
                properties: {
                  ...rawProps,
                  status: derivedStatus,
                  recency_text: badgeText,
                  _marker_operational: isOperational
                }
              };
            }
          })
        };
        
        dataRef.current = processedData;
        map.current.addSource(DATA_CENTERS_SOURCE_ID, { type: 'geojson', data: processedData });
        // Log-scale radius on total_mw with tighter spread:
        // raises small markers and caps large markers.
        // radius = 4 + (ln(clamp(total_mw, 1, 3000)) / ln(3000)) * 5
        const baseRadiusExpression = [
          '+',
          4,
          [
            '*',
            5,
            [
              '/',
              [
                'ln',
                [
                  'min',
                  3000,
                  [
                    'max',
                    1,
                    ['coalesce', ['to-number', ['get', 'total_mw']], 0]
                  ]
                ]
              ],
              Math.log(3000)
            ]
          ]
        ];
        
        map.current.addLayer({
          id: DATA_CENTERS_LAYER_ID,
          type: 'circle',
          source: DATA_CENTERS_SOURCE_ID,
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['get', '_marker_operational'], false],
              baseRadiusExpression,
              ['*', baseRadiusExpression, 0.8] // Non-operational (yellow) markers 20% smaller.
            ],
            'circle-color': [
              'case',
              ['boolean', ['get', '_marker_operational'], false],
              '#3CFFB4',
              '#E8FF3C'
            ],
            'circle-opacity': [
              'case',
              ['boolean', ['get', '_marker_operational'], false],
              0.95,
              [
                'any',
                ['==', ['get', 'probability_score'], 'high'],
                ['==', ['get', 'probability_score'], 'medium']
              ],
              0.92,
              0.82
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.3
          }
        });
        
        // Add text labels layer for recency (after circle layer)
        map.current.addLayer({
          id: DATA_CENTERS_LAYER_ID + '-labels',
          type: 'symbol',
          source: DATA_CENTERS_SOURCE_ID,
          layout: {
            'text-field': [
              'case',
              ['has', 'recency_text'],
              ['get', 'recency_text'],
              ''
            ],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              5, 12,
              10, 14,
              15, 17
            ],
            'text-anchor': 'bottom',
            'text-offset': [0, -1.8],
            'text-allow-overlap': false, // Enable collision detection
            'text-ignore-placement': false,
            'text-optional': false,
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'], // Try multiple positions
            'text-radial-offset': 1.5 // Offset from marker
          },
          paint: {
            'text-color': getTexasDataCenterLabelTextColor(mapTheme),
            'text-halo-width': 0,
            'text-opacity': 0.95
          }
        });
        
        // Move labels layer to top to ensure it's always visible
        try {
          const layers = map.current.getStyle().layers;
          if (layers && layers.length > 0) {
            // Move to top of layer stack
            map.current.moveLayer(DATA_CENTERS_LAYER_ID + '-labels');
          }
        } catch (e) {
          // If moveLayer fails, labels are already on top or map isn't ready
          console.warn('Could not move labels layer to top:', e);
        }
        
        // Start pulse animation after layer is added
        setTimeout(() => {
          animatePulse(processedData);
        }, 100);
        
        // Change cursor on hover
        map.current.on('mouseenter', DATA_CENTERS_LAYER_ID, () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', DATA_CENTERS_LAYER_ID, () => {
          map.current.getCanvas().style.cursor = '';
        });
      } catch (e) {
        console.error('Failed to load Texas data centers markers', e);
      }
    };
    addLayer();

    // Keep the recency label layer above everything else.
    const ensureLabelsOnTop = () => {
      try {
        if (!map.current) return;
        const id = DATA_CENTERS_LAYER_ID + '-labels';
        if (map.current.getLayer(id)) {
          map.current.moveLayer(id);
        }
      } catch {
        // ignore
      }
    };

    // Mobile Safari / style swaps can reshuffle layer order.
    map.current?.on?.('styledata', ensureLabelsOnTop);
    // Also do a best-effort move once the map goes idle after loads.
    map.current?.once?.('idle', ensureLabelsOnTop);

    // Click handler for popups
    const flyToSelectedCenter = (center, zoom, duration = 900) => {
      if (!map.current) return;
      if (isMobile) {
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
        const verticalOffset = viewportHeight > 0 ? Math.round(viewportHeight * -0.18) : -120;
        map.current.flyTo({
          center,
          zoom,
          duration,
          essential: true,
          offset: [0, verticalOffset]
        });
        return;
      }
      map.current.flyTo({ center, zoom, duration, essential: true });
    };

    const handleClick = (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: [DATA_CENTERS_LAYER_ID] });
      if (features && features.length > 0) {
        // Stop event propagation to prevent ERCOT Counties popup from showing
        e.preventDefault?.();
        e.stopPropagation?.();
        
        const f = features[0];
        const props = f.properties;
        const coordinates = f.geometry.coordinates;
        const preferredCenter = getPreferredCenterCoordinates(f, coordinates);
        console.log('[TexasDataCentersLayer] Marker clicked → Timeline carousel', {
          project_id: props.project_id,
          project_name: props.project_name,
          status: props.status,
          willEmit: 'memphis:permitSelected',
          source: 'texas-data-centers',
          groupSize: dataRef.current?.features?.length ?? 0
        });
        
        // Emit event for table highlighting
        if (window.mapEventBus && props.project_id) {
          const payload = {
            project_id: props.project_id,
            properties: props,
            coordinates: preferredCenter
          };
          if (typeof window !== 'undefined') {
            window.__lastTexasDataCenterPowerCircle = {
              center: preferredCenter,
              address: getProjectDisplayName(props)
            };
            window.__lastSelectedTexasDataCenterCardPayload = payload;
          }
          window.mapEventBus.emit('data-center:selected', payload);
        }

        // Emit for timeline carousel (like Memphis permits)
        if (window.mapEventBus && dataRef.current?.features?.length) {
          const allFeatures = dataRef.current.features;
          const MAX_ITEMS = 9;
          const clickedIdx = allFeatures.findIndex((fe) => fe.properties?.project_id === props.project_id);
          let groupFeatures = allFeatures;
          if (allFeatures.length > MAX_ITEMS) {
            const half = Math.floor(MAX_ITEMS / 2);
            let start = clickedIdx >= 0 ? Math.max(0, clickedIdx - half) : 0;
            let end = Math.min(start + MAX_ITEMS, allFeatures.length);
            if (end - start < MAX_ITEMS) start = Math.max(0, end - MAX_ITEMS);
            groupFeatures = allFeatures.slice(start, end);
          }
          const group = groupFeatures.map((fe) => {
            const p = fe.properties || {};
            const coords = fe.geometry?.coordinates;
            const centerCoords = getPreferredCenterCoordinates(fe, coords);
            return {
              ...p,
              _coordinates: centerCoords
            };
          });
          window.mapEventBus.emit('memphis:permitSelected', {
            source: 'texas-data-centers',
            layerLabel: 'Texas Data Centers',
            properties: { ...props, _coordinates: preferredCenter },
            group
          });
          console.log('[TexasDataCentersLayer] Emitted memphis:permitSelected → Timeline bar carousel', { groupLength: group.length });
        }
        
        animateClickPulse(coordinates, getStatusColor(props.status), getProjectDisplayName(props));

        // Privacy-preserving analytics: log marker click (no raw query stored).
        try {
          const loc = String(props.location || '').trim();
          const m = loc.match(/(.+?)\s+County\s*,\s*([A-Z]{2})/i);
          const county = m ? m[1] : null;
          const state = m ? m[2].toUpperCase() : (loc.endsWith(', TX') || loc.endsWith(' TX') ? 'TX' : null);
          const projectId = props.project_id || props.id || props.properties?.project_id || null;
          logUiEvent({
            event_type: 'marker_click',
            asset_type: 'data_center',
            project_id: projectId,
            county,
            state,
            query_text: getProjectDisplayName(props)
          });
        } catch {}

        if (window.mapEventBus) {
          const currentZoom = map.current.getZoom();
          const targetZoom = Math.min(currentZoom + (isMobile ? 2 : 1.5), 14);
          flyToSelectedCenter(preferredCenter, targetZoom, 800);
          if (typeof window !== 'undefined') {
            window.__lastTexasDataCenterPowerCircle = {
              center: preferredCenter,
              address: getProjectDisplayName(props)
            };
          }
          window.mapEventBus.emit('texas-data-center:showInCard', {
            properties: props,
            coordinates: preferredCenter
          });
        } else {
          showPopupForProject(props, preferredCenter, true);
        }
      } else {
        // Close popup if clicking elsewhere
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      }
    };
    map.current.on('click', handleClick);
    
    // Listen for table row clicks to show popup
    const handleTableRowClick = (eventData) => {
      if (!eventData || !eventData.project_id || !map.current || !dataRef.current) return;
      
      // Find the feature by project_id
      const feature = dataRef.current.features.find(
        f => f.properties?.project_id === eventData.project_id
      );
      
      if (feature && feature.geometry && feature.geometry.coordinates) {
        const props = feature.properties;
        const coordinates = feature.geometry.coordinates;
        const preferredCenter = getPreferredCenterCoordinates(feature, coordinates);
        animateClickPulse(coordinates, getStatusColor(props.status), getProjectDisplayName(props));
        const currentZoom = map.current.getZoom();
        const targetZoom = Math.min(Math.max(currentZoom, 11.5), 14);
        flyToSelectedCenter(preferredCenter, targetZoom, 900);
        if (eventData?.suppressCardSync) {
          return;
        }
        if (isMobile && window.mapEventBus) {
          if (typeof window !== 'undefined') {
            window.__lastTexasDataCenterPowerCircle = {
              center: preferredCenter,
              address: getProjectDisplayName(props)
            };
          }
          window.mapEventBus.emit('texas-data-center:showInCard', { properties: props, coordinates: preferredCenter });
        } else {
          setTimeout(() => {
            showPopupForProject(props, preferredCenter, false);
          }, 1000);
        }
      }
    };
    
    let unsubscribeTableClick = null;
    let unsubscribeCarouselFocus = null;
    if (window.mapEventBus) {
      unsubscribeTableClick = window.mapEventBus.on('data-center:show-popup', handleTableRowClick);
      unsubscribeCarouselFocus = window.mapEventBus.on('timeline:carouselFocus', (payload) => {
        if (payload?.source !== 'texas-data-centers' || !payload?.projectId || !map.current || !dataRef.current) return;
        const feature = dataRef.current.features.find((f) => f.properties?.project_id === payload.projectId);
        if (feature?.geometry?.coordinates) {
          const coords = feature.geometry.coordinates;
          const preferredCenter = getPreferredCenterCoordinates(feature, coords);
          const props = feature.properties || {};
          animateClickPulse(coords, getStatusColor(props?.status), getProjectDisplayName(props));
          flyToSelectedCenter(preferredCenter, 14, 1200);
          if (isMobile && window.mapEventBus) {
            if (typeof window !== 'undefined') {
              window.__lastTexasDataCenterPowerCircle = {
                center: preferredCenter,
                address: getProjectDisplayName(props)
              };
            }
            window.mapEventBus.emit('texas-data-center:showInCard', { properties: feature.properties, coordinates: preferredCenter });
          } else {
            showPopupForProject(feature.properties, preferredCenter, false, true);
          }
        }
      });
    }

    return () => {
      cancelled = true;
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      if (clickPulseAnimationRef.current) {
        cancelAnimationFrame(clickPulseAnimationRef.current);
        clickPulseAnimationRef.current = null;
      }
      if (map.current?.getLayer(CLICK_PULSE_LAYER_ID)) map.current.removeLayer(CLICK_PULSE_LAYER_ID);
      if (map.current?.getSource(CLICK_PULSE_SOURCE_ID)) map.current.removeSource(CLICK_PULSE_SOURCE_ID);
      if (map.current?.getLayer(DATA_CENTERS_PULSE_LAYER_ID)) map.current.removeLayer(DATA_CENTERS_PULSE_LAYER_ID);
      if (map.current?.getSource(DATA_CENTERS_SOURCE_ID + '-pulse')) map.current.removeSource(DATA_CENTERS_SOURCE_ID + '-pulse');
      if (map.current?.off) {
        try { map.current.off('styledata', ensureLabelsOnTop); } catch {}
      }
      if (map.current?.getLayer(DATA_CENTERS_LAYER_ID + '-labels')) map.current.removeLayer(DATA_CENTERS_LAYER_ID + '-labels');
      if (map.current?.getLayer(DATA_CENTERS_LAYER_ID)) map.current.removeLayer(DATA_CENTERS_LAYER_ID);
      if (map.current?.getSource(DATA_CENTERS_SOURCE_ID)) map.current.removeSource(DATA_CENTERS_SOURCE_ID);
      map.current?.off('click', handleClick);
      map.current?.off('mouseenter', DATA_CENTERS_LAYER_ID);
      map.current?.off('mouseleave', DATA_CENTERS_LAYER_ID);
      if (unsubscribeTableClick) unsubscribeTableClick();
      if (unsubscribeCarouselFocus) unsubscribeCarouselFocus();
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, visible, mapTheme]);

  return null; // No React rendering needed - popup is handled by Mapbox
};

export default TexasDataCentersLayer;
