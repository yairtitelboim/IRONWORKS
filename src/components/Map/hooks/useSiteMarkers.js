import { useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { resolveCoordinatesForSites } from '../../../utils/geocodeSites';
import PINAL_SITES from '../../../data/pinalSites';
import TSMC_PHOENIX_SITES from '../../../data/tsmcPhoenixSites';
import {
  addOsmParticlesLayer,
  startOsmParticleAnimation,
  stopOsmParticleAnimation
} from '../../../utils/osmParticleUtils';
import {
  addOsmPulseSource,
  startOsmPulseAnimation,
  stopOsmPulseAnimation
} from '../../../utils/osmPulseUtils';

/**
 * Hook for managing OSM site markers (TSMC Phoenix, Pinal sites, etc.)
 * Handles geocoding, marker creation, and animation management
 */
export const useSiteMarkers = ({ map, locationKey, ncLayersMounted, ncDataRef }) => {
  const geocodingInProgressRef = useRef(false);

  const createSiteMarkers = useCallback(async (overrideLocationKey = null) => {
    console.log('🔍 [useSiteMarkers] createSiteMarkers called:', {
      overrideLocationKey,
      ncLayersMounted,
      locationKey,
      pinalSiteMarkers: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0,
      geocodingInProgress: geocodingInProgressRef.current,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    
    if (!map?.current) {
      console.warn('🗺️ [useSiteMarkers] Cannot create site markers: map not initialized');
      return;
    }
    
    // CRITICAL: Prevent concurrent geocoding calls
    if (geocodingInProgressRef.current) {
      console.log('🔍 [useSiteMarkers] Geocoding already in progress - preserving existing markers', {
        existingMarkersCount: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Guard: If OSM markers already exist and no explicit location change is requested, preserve them
    const existingMarkersCount = typeof window !== 'undefined' && window.pinalSiteMarkers 
      ? Object.keys(window.pinalSiteMarkers).length 
      : 0;
    
    if (existingMarkersCount > 0 && !overrideLocationKey) {
      console.log('🔍 [useSiteMarkers] PRESERVING existing OSM markers (early return)', {
        existingMarkersCount,
        overrideLocationKey,
        ncLayersMounted,
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack?.split('\n').slice(0, 8).join('\n')
      });
      return;
    }
    
    // Secondary guard: Also check if OSM layers are mounted
    if (ncLayersMounted && !overrideLocationKey) {
      console.log('🔍 [useSiteMarkers] OSM layers already mounted - preserving existing markers (early return)', {
        ncLayersMounted,
        overrideLocationKey,
        existingMarkersCount,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.log('🔍 [useSiteMarkers] PROCEEDING with marker creation (guards did not prevent)', {
      existingMarkersCount,
      overrideLocationKey,
      ncLayersMounted,
      timestamp: new Date().toISOString()
    });

    const effectiveLocationKey = overrideLocationKey || locationKey;
    
    // Check if Phoenix data exists in ref
    const hasPhoenixDataInRef = ncDataRef.current && (ncDataRef.current['tsmc_phoenix'] || ncDataRef.current['tsmc_phoenix_water']);
    
    // Use Phoenix sites if:
    // 1. Override location key is explicitly Phoenix, OR
    // 2. Phoenix data exists in ref (auto-detection)
    const isExplicitPhoenix = effectiveLocationKey === 'tsmc_phoenix' || effectiveLocationKey === 'tsmc_phoenix_water';
    const shouldUsePhoenix = isExplicitPhoenix || hasPhoenixDataInRef;

    try {
      // Use TSMC Phoenix sites if location is tsmc_phoenix or if Phoenix data is loaded
      const SITES_TO_USE = shouldUsePhoenix
        ? TSMC_PHOENIX_SITES 
        : PINAL_SITES;
      
      console.log('🔍 [useSiteMarkers] Using sites', {
        siteList: shouldUsePhoenix ? 'TSMC_PHOENIX_SITES' : 'PINAL_SITES',
        sitesCount: SITES_TO_USE.length,
        shouldUsePhoenix,
        timestamp: new Date().toISOString()
      });

      // Prefer seeded coordinates if present by writing them into cache first
      const sitesWithSeeds = SITES_TO_USE.map(s => ({ ...s }));
      
      // Write seeds to cache for entries with lat/lng provided
      for (const s of sitesWithSeeds) {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          try {
            const { seedKnownCoordinates } = await import('../../../utils/geocodeSites');
            seedKnownCoordinates(s, s.lat, s.lng, { provenanceURLs: [], confidence: 0.95 });
          } catch (e) {
            console.warn('⚠️ [useSiteMarkers] Failed to seed coordinates for', s.id || s.name, e);
          }
        }
      }

      // Only force refresh if explicitly requested (e.g., Ctrl+Click)
      // Don't force refresh just because it's Phoenix - use cached results for speed
      // This prevents slow geocoding that causes component unmount before markers are created
      const shouldForceRefresh = false; // Use cached geocoding results for speed
      
      // Mark geocoding as in progress
      geocodingInProgressRef.current = true;
      
      const geocodeStartTime = performance.now();
      console.log('🔍 [useSiteMarkers] Starting geocoding...', {
        sitesCount: sitesWithSeeds.length,
        shouldForceRefresh,
        timestamp: new Date().toISOString()
      });
      
      let resolvedSites;
      try {
        resolvedSites = await resolveCoordinatesForSites(sitesWithSeeds, { 
          forceRefresh: shouldForceRefresh, 
          parallelLimit: 1 
        });
      } catch (geocodeError) {
        console.error('❌ [useSiteMarkers] Geocoding failed:', geocodeError);
        geocodingInProgressRef.current = false; // Reset flag on error
        throw geocodeError;
      } finally {
        // Always reset the flag when geocoding completes (success or failure)
        geocodingInProgressRef.current = false;
      }
      
      const geocodeEndTime = performance.now();

      const validSites = resolvedSites.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
      const invalidSites = resolvedSites.filter(s => !Number.isFinite(s.lat) || !Number.isFinite(s.lng));
      
      // Always log geocoding completion (not just in debug mode)
      console.log('🔍 [useSiteMarkers] Geocoding complete', {
        geocodeTime: (geocodeEndTime - geocodeStartTime).toFixed(0) + 'ms',
        resolvedSites: resolvedSites.length,
        validSites: validSites.length,
        invalidSites: invalidSites.length,
        validSiteIds: validSites.map(s => s.id),
        timestamp: new Date().toISOString()
      });
      
      if (validSites.length === 0) {
        console.error('❌ [useSiteMarkers] CRITICAL - No valid sites found! Cannot create markers or animations.');
        // CRITICAL: If geocoding failed but markers already exist, preserve them
        const existingMarkersCount = typeof window !== 'undefined' && window.pinalSiteMarkers 
          ? Object.keys(window.pinalSiteMarkers).length 
          : 0;
        if (existingMarkersCount > 0) {
          console.log('🔍 [useSiteMarkers] Geocoding failed but existing markers found - preserving them', {
            existingMarkersCount,
            timestamp: new Date().toISOString()
          });
        }
        return;
      }

      // Processing valid sites
      if (validSites.length > 0) {
        // Check if markers already exist and match the sites we're about to create
        const existingMarkerIds = typeof window !== 'undefined' && window.pinalSiteMarkers 
          ? Object.keys(window.pinalSiteMarkers) 
          : [];
        const newSiteIds = validSites.map(s => s.id).filter(Boolean);
        
        console.log('🔍 [useSiteMarkers] Checking if markers need update:', {
          existingMarkerIds,
          newSiteIds,
          existingCount: existingMarkerIds.length,
          newCount: newSiteIds.length,
          overrideLocationKey,
          shouldForceRefresh
        });
        
        // Only remove markers if we're creating different markers
        const markersNeedUpdate = existingMarkerIds.length === 0 || 
          existingMarkerIds.length !== newSiteIds.length ||
          !newSiteIds.every(id => existingMarkerIds.includes(id));
        
        if (!markersNeedUpdate) {
          // Markers already exist and match, skip marker creation entirely
          console.log('🔍 [useSiteMarkers] Markers already exist and match - skipping marker creation to preserve existing OSM markers', {
            existingMarkerIds,
            newSiteIds
          });
          return;
        }
        
        // CRITICAL GUARD: If markers exist and we're not explicitly changing location, preserve them
        if (existingMarkerIds.length > 0 && !overrideLocationKey && !shouldForceRefresh) {
          console.log('🔍 [useSiteMarkers] PRESERVING existing markers - no location change requested (CRITICAL GUARD)', {
            existingMarkerIds,
            overrideLocationKey,
            shouldForceRefresh,
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // If we get here, we're about to remove markers - log this clearly
        console.log('🔍 [useSiteMarkers] WARNING - About to remove existing markers!', {
          existingMarkerIds,
          newSiteIds,
          overrideLocationKey,
          shouldForceRefresh,
          markersNeedUpdate,
          timestamp: new Date().toISOString()
        });
        
        // CRITICAL FIX: Don't remove existing markers until AFTER new ones are created
        // Store the old markers temporarily so we can remove them after creating new ones
        const oldMarkers = typeof window !== 'undefined' && window.pinalSiteMarkers 
          ? { ...window.pinalSiteMarkers } 
          : {};
        const oldMarkerIds = Object.keys(oldMarkers);
        
        console.log('🔍 [useSiteMarkers] Storing old markers to remove later', {
          oldMarkerCount: oldMarkerIds.length,
          oldMarkerIds,
          timestamp: new Date().toISOString()
        });
        
        // CRITICAL: If we have existing markers, DO NOT remove them until after geocoding completes
        if (oldMarkerIds.length > 0) {
          console.log('🔍 [useSiteMarkers] PRESERVING existing markers during geocoding - will only remove after new ones are created', {
            oldMarkerCount: oldMarkerIds.length,
            oldMarkerIds,
            timestamp: new Date().toISOString()
          });
        }
        
        // Clean any prior vector layer approach
        try {
          if (map.current.getLayer('pinal-sites-layer')) map.current.removeLayer('pinal-sites-layer');
        } catch (e) {}
        try {
          if (map.current.getSource('pinal-sites')) map.current.removeSource('pinal-sites');
        } catch (e) {}

        console.log('🔍 [useSiteMarkers] Preserving old markers until new ones are created', {
          oldMarkerCount: oldMarkerIds.length,
          timestamp: new Date().toISOString()
        });

        // DO NOT clean up particle and pulse animations yet - wait until after new ones are created
        console.log('🔍 [useSiteMarkers] Preserving OSM particle/pulse animations until new ones are created');

        // Create DOM markers for each site
        const isTsmcLocation = shouldUsePhoenix;
        
        let markersCreated = 0;
        let markersFailed = 0;
        
        validSites.forEach((site, index) => {
          try {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.width = '26px';
            el.style.height = '26px';
            el.style.borderRadius = '50%';
            el.style.background = isTsmcLocation 
              ? 'rgba(59, 130, 246, 0.95)' // Blue for semiconductor
              : 'rgba(239, 68, 68, 0.95)'; // Red for other sites
            el.style.border = 'none';
            el.style.boxShadow = isTsmcLocation
              ? '0 2px 8px rgba(59, 130, 246, 0.5)'
              : '0 2px 8px rgba(0,0,0,0.35)';
            el.style.cursor = 'pointer';
            el.style.userSelect = 'none';
            el.title = site.name;

            const provenance = Array.isArray(site.provenanceURLs) ? site.provenanceURLs : [];
            
            if (!map.current) {
              console.error(`❌ [useSiteMarkers] Cannot create marker for ${site.id || site.name}: map.current is null`);
              markersFailed++;
              return;
            }
            
            const marker = new mapboxgl.Marker(el)
              .setLngLat([site.lng, site.lat])
              .addTo(map.current);
            
            // Store marker reference
            if (typeof window !== 'undefined') {
              if (!window.pinalSiteMarkers) window.pinalSiteMarkers = {};
              window.pinalSiteMarkers[site.id] = marker;
              console.log('🟢 [useSiteMarkers] ✅ OSM MARKER MOUNTED', {
                siteId: site.id,
                siteName: site.name,
                coordinates: [site.lng, site.lat],
                totalMarkers: Object.keys(window.pinalSiteMarkers).length,
                allMarkerIds: Object.keys(window.pinalSiteMarkers),
                timestamp: new Date().toISOString()
              });
            }
            
            // Add click handler to emit marker:clicked event
            const clickHandler = (event) => {
              // Log marker click
              console.log('🟢 [useSiteMarkers] OSM SITE MARKER CLICKED (teardrop marker with particles/halo)', {
                siteId: site.id,
                siteName: site.name,
                coordinates: [site.lng, site.lat],
                isTsmcLocation,
                formatter: isTsmcLocation ? 'tsmc-phoenix' : 'pinal',
                timestamp: new Date().toISOString()
              });
              
              // Also log to window for debugging
              if (typeof window !== 'undefined') {
                window.lastOSMMarkerClick = {
                  siteId: site.id,
                  siteName: site.name,
                  timestamp: new Date().toISOString()
                };
                // Also add to an array to track all clicks
                if (!window.osmMarkerClicks) window.osmMarkerClicks = [];
                window.osmMarkerClicks.push({
                  siteId: site.id,
                  siteName: site.name,
                  timestamp: new Date().toISOString()
                });
              }
              
              // Auto-zoom to marker location
              if (map.current && Number.isFinite(site.lng) && Number.isFinite(site.lat)) {
                map.current.flyTo({
                  center: [site.lng, site.lat],
                  zoom: 14,
                  duration: 1000,
                  essential: true
                });
              }

              if (window.mapEventBus) {
                const markerPayload = {
                  id: site.id,
                  name: site.name,
                  type: site.type || 'Key Site',
                  category: site.provider || site.type || 'Infrastructure Site',
                  coordinates: [site.lng, site.lat],
                  formatter: isTsmcLocation ? 'tsmc-phoenix' : 'pinal',
                  zonesAnalyzed: 3,
                  cachedDataAvailable: false, // TODO: pass from parent
                  analysisStatus: `${site.city || ''}${site.city ? ', ' : ''}${site.state || ''}`,
                  provider: site.provider,
                  confidence: site.confidence ? (Number(site.confidence) * 100).toFixed(0) + '%' : '95%',
                  lastVerified: site.lastVerified ? new Date(site.lastVerified).toLocaleString() : new Date().toLocaleString(),
                  provenance: provenance,
                  siteMetadata: site
                };

                // Add Greenstone-specific data if this is a Greenstone site
                if (site.id && site.id.includes('greenstone')) {
                  markerPayload.waterRightsTransaction = true;
                  if (site.landAcres) markerPayload.landAcres = site.landAcres;
                  if (site.purchasePrice) markerPayload.purchasePrice = site.purchasePrice;
                  if (site.waterSold) markerPayload.waterSold = site.waterSold;
                  if (site.profit) markerPayload.profit = site.profit;
                  if (site.seller) markerPayload.seller = site.seller;
                  if (site.buyer) markerPayload.buyer = site.buyer;
                  markerPayload.notes = site.notes || '';
                }

                window.mapEventBus.emit('marker:clicked', markerPayload);
              }
            };
            
            // Attach the click handler with capture phase to catch it early
            const markerEl = marker.getElement();
            
            // Wrap the marker element to ensure our handler fires first
            // Mapbox might be handling clicks internally, so we need to intercept early
            const wrappedClickHandler = (e) => {
              // Stop propagation to prevent Mapbox from handling it
              e.stopPropagation();
              e.stopImmediatePropagation();
              clickHandler(e);
            };
            
            markerEl.addEventListener('click', wrappedClickHandler, true); // Use capture phase - fires FIRST
            
            // Also attach in bubble phase as backup (but don't stop propagation here)
            markerEl.addEventListener('click', (e) => {
              // Backup handler - only log if main handler didn't fire
              // (This is a fallback, main handler should fire in capture phase)
            }, false);
            
            // Also try mousedown as another backup - this fires before click
            markerEl.addEventListener('mousedown', (e) => {
              console.log('🟢 [useSiteMarkers] MOUSEDOWN on marker', {
                siteId: site.id,
                siteName: site.name,
                timestamp: new Date().toISOString()
              });
              // Don't stop propagation here - let click handlers also fire
            }, true); // Use capture phase for mousedown too
            
            // Verify the event listener was attached
            console.log('🟢 [useSiteMarkers] Click handler attached to marker', {
              siteId: site.id,
              siteName: site.name,
              markerElement: markerEl,
              markerElementTag: markerEl?.tagName,
              markerElementId: markerEl?.id,
              markerElementClass: markerEl?.className,
              hasClickHandler: true,
              listenersCount: markerEl ? 'check in devtools' : 'no element',
              timestamp: new Date().toISOString()
            });
            
            // Store reference for debugging
            if (typeof window !== 'undefined') {
              if (!window.osmMarkerDebug) window.osmMarkerDebug = {};
              window.osmMarkerDebug[site.id] = {
                marker,
                element: markerEl,
                clickHandler,
                site
              };
            }
            
            markersCreated++;
          } catch (error) {
            console.error(`❌ [useSiteMarkers] Failed to create marker for ${site.id || site.name}:`, error);
            markersFailed++;
          }
        });

        // Log marker creation summary
        const finalMarkerIds = typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers) : [];
        const finalMarkerDetails = typeof window !== 'undefined' && window.pinalSiteMarkers 
          ? finalMarkerIds.map(id => ({
              id,
              name: validSites.find(s => s.id === id)?.name || 'Unknown'
            }))
          : [];
        
        console.log('🟢 [useSiteMarkers] ✅ OSM MARKER CREATION COMPLETE', {
          markersCreated,
          markersFailed,
          totalMarkers: finalMarkerIds.length,
          markerIds: finalMarkerIds,
          markerDetails: finalMarkerDetails,
          timestamp: new Date().toISOString()
        });

        // NOW remove old markers that don't match the new ones (after new ones are created)
        if (oldMarkerIds.length > 0) {
          console.log('🔍 [useSiteMarkers] Removing old markers that don\'t match new ones', {
            oldMarkerIds,
            newMarkerIds: newSiteIds,
            timestamp: new Date().toISOString()
          });
          
          // Only remove old markers that aren't in the new set
          const markersToRemove = oldMarkerIds.filter(id => !newSiteIds.includes(id));
          
          markersToRemove.forEach(id => {
            if (oldMarkers[id]) {
              try {
                oldMarkers[id].remove();
                console.log('🔍 [useSiteMarkers] Removed old marker:', id);
              } catch (e) {
                console.warn('🔍 [useSiteMarkers] Error removing old marker:', id, e);
              }
            }
          });
          
          // Clean up old markers from window.pinalSiteMarkers (only the ones we removed)
          if (typeof window !== 'undefined' && window.pinalSiteMarkers) {
            markersToRemove.forEach(id => {
              delete window.pinalSiteMarkers[id];
            });
            console.log('🔍 [useSiteMarkers] Cleaned up old markers from window.pinalSiteMarkers', {
              removedCount: markersToRemove.length,
              remainingCount: Object.keys(window.pinalSiteMarkers).length
            });
          }
        }

        // NOW clean up old particle and pulse animations (after new ones are created)
        try {
          console.log('🔍 [useSiteMarkers] Cleaning up old OSM particle/pulse animations');
          stopOsmParticleAnimation();
          stopOsmPulseAnimation(map);
          
          // Remove old particle layers
          if (map.current.getLayer('osm-site-particles-layer')) {
            map.current.removeLayer('osm-site-particles-layer');
          }
          if (map.current.getSource('osm-site-particles')) {
            map.current.removeSource('osm-site-particles');
          }
          
          // Remove old pulse layers
          if (map.current.getLayer('osm-site-pulse-markers')) {
            map.current.removeLayer('osm-site-pulse-markers');
          }
          if (map.current.getSource('osm-site-pulse-source')) {
            map.current.removeSource('osm-site-pulse-source');
          }
        } catch (e) {
          console.warn('⚠️ [useSiteMarkers] Error cleaning up old OSM particle/pulse animations:', e);
        }

        // Add halo particle effects and pulse animations
        if (validSites.length > 0) {
          try {
            // Add pulse source and layer
            addOsmPulseSource(map);
            
            // Add particles layer
            addOsmParticlesLayer(map);
            
            // Start animations with slight delay for visual effect
            setTimeout(() => {
              startOsmParticleAnimation(map, validSites, isTsmcLocation);
              startOsmPulseAnimation(map, validSites, isTsmcLocation);
            }, 100);
          } catch (error) {
            console.error('❌ [useSiteMarkers] Error adding particle/pulse animations:', error);
            console.error('❌ [useSiteMarkers] Error stack:', error.stack);
          }
        } else {
          console.warn('⚠️ [useSiteMarkers] No valid sites, skipping animations');
        }
      } else {
        console.warn('⚠️ [useSiteMarkers] No valid site coordinates available');
      }
    } catch (e) {
      console.error('❌ [useSiteMarkers] Failed to create site markers:', e);
      console.error('❌ [useSiteMarkers] Error stack:', e.stack);
    }
  }, [map, locationKey, ncLayersMounted, ncDataRef]);

  return {
    createSiteMarkers,
    geocodingInProgress: geocodingInProgressRef.current
  };
};

