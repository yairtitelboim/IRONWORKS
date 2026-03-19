import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as turf from '@turf/turf';

const ScannerSignalsPanel = ({ inline = false }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null); // null = all, 'TAVILY' = news, 'ERCOT_QUEUE' = ercot
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(new Set()); // Track signals being updated
  const [isExpanded, setIsExpanded] = useState(false); // Track panel expansion (deprecated - kept for width control)
  const [showFilterButtons, setShowFilterButtons] = useState(true); // Track filter buttons visibility
  const [highlightedSignals, setHighlightedSignals] = useState(new Set()); // Track highlighted signals
  const [refreshing, setRefreshing] = useState({ news: false, ercot: false }); // Track refresh status
  const [showHeaderMenu, setShowHeaderMenu] = useState(false); // Track header menu visibility
  const [notification, setNotification] = useState(null); // Track notification messages
  const [showNotificationDetails, setShowNotificationDetails] = useState(false); // Show detailed error info
  const [expandedDeveloper, setExpandedDeveloper] = useState(null); // Track which developer's projects are expanded
  const [expandedDevProjects, setExpandedDevProjects] = useState(new Set()); // Track which dev projects show MW value
  const [ercotNewIds, setErcotNewIds] = useState(new Set()); // ERCOT signals that are NEW this refresh
  const [ercotUpdatedIds, setErcotUpdatedIds] = useState(new Set()); // ERCOT signals that are UPDATED this refresh

  const fetchSignals = async (sourceType = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (sourceType) {
        params.append('source_type', sourceType);
      }
      params.append('limit', '100');
      
      const response = await fetch(`/api/scanner/signals?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSignals(data.signals || []);
    } catch (err) {
      console.error('Error fetching signals:', err);
      setError(err.message);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals(selectedSource);
  }, [selectedSource]);

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHeaderMenu && !event.target.closest('.scanner-header-menu')) {
        setShowHeaderMenu(false);
      }
    };
    
    if (showHeaderMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showHeaderMenu]);

  const handleSourceChange = (source) => {
    setSelectedSource(source);
  };

  const handleRefreshNews = async () => {
    setRefreshing(prev => ({ ...prev, news: true }));
    setNotification({ type: 'info', message: 'Searching for recent news articles (last 7 days)...', timestamp: Date.now() });
    
    try {
      const response = await fetch('/api/scanner/ingest/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: '"data center" (moratorium OR lawsuit OR zoning) Texas',
          days: 7 // Only get articles from last 7 days
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('NEWS ingestion completed:', data);
      
      // Build detailed notification message
      let notificationMessage = '';
      let notificationType = 'success';
      
      if (data.signalsFound === 0) {
        notificationMessage = 'No new articles found in the last 7 days';
        notificationType = 'info';
      } else if (data.urlDuplicates === data.signalsFound) {
        notificationMessage = `Found ${data.signalsFound} articles, but all were duplicates (already in database)`;
        notificationType = 'info';
      } else if (data.signalsNew === 0 && data.signalsChanged === 0) {
        notificationMessage = `Found ${data.signalsFound} articles (${data.urlDuplicates} duplicates). No new situations detected.`;
        notificationType = 'info';
      } else {
        const parts = [];
        if (data.signalsNew > 0) parts.push(`${data.signalsNew} new`);
        if (data.signalsEscalated > 0) parts.push(`${data.signalsEscalated} escalated`);
        if (data.signalsRepeated > 0) parts.push(`${data.signalsRepeated} repeated`);
        if (data.urlDuplicates > 0) parts.push(`${data.urlDuplicates} duplicates skipped`);
        
        notificationMessage = `Found ${data.signalsFound} articles: ${parts.join(', ')}`;
        notificationType = 'success';
      }
      
      setNotification({ 
        type: notificationType, 
        message: notificationMessage, 
        timestamp: Date.now() 
      });
      
      // Refresh the signals list
      await fetchSignals(selectedSource);
      setRefreshing(prev => ({ ...prev, news: false }));
      
      // Clear notification after appropriate time
      const clearDelay = notificationType === 'error' ? 6000 : notificationType === 'info' ? 5000 : 4000;
      setTimeout(() => setNotification(null), clearDelay);
    } catch (err) {
      console.error('Error refreshing NEWS:', err);
      setRefreshing(prev => ({ ...prev, news: false }));
      setNotification({ type: 'error', message: `Failed to refresh News: ${err.message}`, timestamp: Date.now() });
      
      // Clear error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleRefreshErcot = async () => {
    setRefreshing(prev => ({ ...prev, ercot: true }));
    setNotification({ type: 'info', message: 'Downloading latest ERCOT GIS report...', timestamp: Date.now() });
    
    try {
      const response = await fetch('/api/scanner/ingest/ercot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          useGisReports: true,  // Use GIS reports (more comprehensive)
          downloadFresh: true   // Download fresh data from ERCOT website
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('ERCOT ingestion completed:', data);
      
      // Log download status for debugging
      if (data?.downloadStatus) {
        console.log('📊 Download Status:', {
          attempted: data.downloadStatus.attempted,
          success: data.downloadStatus.success,
          usedFallback: data.downloadStatus.usedFallback,
          error: data.downloadStatus.error
        });
      }

      // Capture delta IDs from this refresh so we can highlight and sort updated projects
      const newIds = (data?.deltas?.newIds || []).filter(Boolean);
      const updatedIds = (data?.deltas?.updatedIds || []).filter(Boolean);
      const downloadStatus = data?.downloadStatus || null;
      
      console.log('📊 Change Detection:', {
        newProjects: newIds.length,
        updatedProjects: updatedIds.length,
        hasChanges: newIds.length > 0 || updatedIds.length > 0
      });

      setErcotNewIds(new Set(newIds));
      setErcotUpdatedIds(new Set(updatedIds));
      
      // Build explicit notification message based on download status and changes
      let notificationType = 'success';
      let notificationMessage = '';
      let notificationDetails = null; // Additional details for errors/warnings
      
      const hasChanges = newIds.length > 0 || updatedIds.length > 0;
      
      if (downloadStatus?.attempted) {
        if (downloadStatus.success) {
          // Fresh download succeeded
          if (hasChanges) {
            notificationMessage = `✅ Fresh ERCOT data downloaded: ${newIds.length} new project${newIds.length !== 1 ? 's' : ''}, ${updatedIds.length} updated`;
            notificationType = 'success';
          } else {
            notificationMessage = `✅ Fresh ERCOT data downloaded - No changes detected (already up to date)`;
            notificationType = 'info';
          }
        } else if (downloadStatus.usedFallback) {
          // Download failed, used fallback CSV
          const errorDetail = downloadStatus.error ? ` (${downloadStatus.error.substring(0, 50)}${downloadStatus.error.length > 50 ? '...' : ''})` : '';
          if (hasChanges) {
            notificationMessage = `⚠️ Download failed${errorDetail} - Using existing CSV: ${newIds.length} new project${newIds.length !== 1 ? 's' : ''}, ${updatedIds.length} updated`;
            notificationType = 'warning';
          } else {
            notificationMessage = `⚠️ Download failed${errorDetail} - Using existing CSV - No changes detected`;
            notificationType = 'warning';
            notificationDetails = `Why no changes? The existing CSV file matches the previous snapshot in the database. This could mean:\n• The CSV hasn't been updated since last run\n• No new projects were added\n• No existing projects were modified`;
          }
        } else {
          // Download attempted but failed completely
          notificationMessage = `❌ Download failed: ${downloadStatus.error || 'Unknown error'}`;
          notificationType = 'error';
          notificationDetails = downloadStatus.error || 'No error details available';
        }
      } else {
        // No download attempted (using existing CSV)
        if (hasChanges) {
          notificationMessage = `📂 Using existing CSV: ${newIds.length} new project${newIds.length !== 1 ? 's' : ''}, ${updatedIds.length} updated`;
          notificationType = 'info';
        } else {
          notificationMessage = `📂 Using existing CSV - No changes detected`;
          notificationType = 'info';
          notificationDetails = `Why no changes? The existing CSV file matches the previous snapshot in the database.`;
        }
      }
      
      setNotification({ 
        type: notificationType, 
        message: notificationMessage, 
        details: notificationDetails,
        downloadStatus: downloadStatus,
        timestamp: Date.now() 
      });
      
      // Refresh the signals list so the new/updated projects appear
      await fetchSignals(selectedSource);
      setRefreshing(prev => ({ ...prev, ercot: false }));
      
      // Clear notification after appropriate time based on type
      const clearDelay = notificationType === 'error' ? 6000 : notificationType === 'warning' ? 5000 : 4000;
      setTimeout(() => setNotification(null), clearDelay);
    } catch (err) {
      console.error('Error refreshing ERCOT:', err);
      setRefreshing(prev => ({ ...prev, ercot: false }));
      setNotification({ type: 'error', message: `Failed to refresh ERCOT: ${err.message}`, timestamp: Date.now() });
      
      // Clear error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleToggleHighlight = (signalId) => {
    setHighlightedSignals(prev => {
      const next = new Set(prev);
      if (next.has(signalId)) {
        next.delete(signalId);
      } else {
        next.add(signalId);
      }
      return next;
    });
  };

  const handleToggleReviewed = async (signalId, currentStatus) => {
    // Default to 'NEW' if status is not set
    const status = currentStatus || 'NEW';
    const newStatus = status === 'REVIEWED' ? 'NEW' : 'REVIEWED';
    
    // Optimistic update
    setUpdatingStatus(prev => new Set(prev).add(signalId));
    setSignals(prev => prev.map(s => 
      s.signal_id === signalId ? { ...s, status: newStatus } : s
    ));
    
    try {
      const response = await fetch(`/api/scanner/signals/${signalId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      console.error('Error updating signal status:', err);
      // Revert optimistic update on error
      setSignals(prev => prev.map(s => 
        s.signal_id === signalId ? { ...s, status: status } : s
      ));
    } finally {
      setUpdatingStatus(prev => {
        const next = new Set(prev);
        next.delete(signalId);
        return next;
      });
    }
  };

  const getLaneColor = (lane) => {
    switch (lane) {
      case 'CONSTRAINT':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'COMMITMENT':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'CONTEXT':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusBadgeClasses = (status) => {
    if (!status) return 'bg-gray-700/50 text-gray-200';
    const s = status.toLowerCase();
    if (s.includes('active') || s.includes('in service')) {
      return 'bg-green-500/20 text-green-200 border border-green-500/40';
    }
    if (s.includes('withdrawn')) {
      return 'bg-orange-500/15 text-orange-200 border border-orange-400/40';
    }
    return 'bg-gray-700/50 text-gray-200 border border-gray-500/40';
  };

  const getSourceLabel = (sourceType) => {
    switch (sourceType) {
      case 'TAVILY':
        return 'News';
      case 'ERCOT_QUEUE':
        return 'ERCOT';
      default:
        return sourceType || 'Unknown';
    }
  };

  // Calculate pattern metrics for a signal (recurrence patterns)
  const calculatePatternMetrics = (signal, allSignals) => {
    if (!signal || !allSignals) return null;
    
    // Parse tags for existing recurrence count
    let generalRecurrence = 0;
    if (signal.tags) {
      try {
        const tags = JSON.parse(signal.tags || '[]');
        const recurrenceTag = tags.find(t => t.startsWith('recurrence:'));
        if (recurrenceTag) {
          generalRecurrence = parseInt(recurrenceTag.split(':')[1]) || 0;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Time-based recurrence: signals with same anchors in last 14 days BEFORE this signal
    const signalDate = signal.ingested_at ? new Date(signal.ingested_at) : 
                      (signal.published_at ? new Date(signal.published_at) : null);
    
    // Track matches by anchor type and strength
    let timeBasedRecurrenceByAnchor = {
      company: 0,
      county: 0,
      asset: 0,
      strong: 0  // Multiple anchors (company+county, company+asset, etc.)
    };
    let timeBasedRecurrence = 0;
    
    if (signalDate) {
      // Calculate 14 days BEFORE this signal's date (not from now)
      const fourteenDaysBeforeSignal = new Date(signalDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      // Weighted match scoring to prevent false positives
      // who match = +3, asset match = +2, county match = +1
      // Only count if score ≥ 3 (company alone, or asset+county, but not county alone)
      for (const s of allSignals) {
        if (s.signal_id === signal.signal_id) continue;
        if (s.source_type !== signal.source_type) continue;
        
        // Use ingested_at or published_at for comparison
        const sDate = s.ingested_at ? new Date(s.ingested_at) : 
                     (s.published_at ? new Date(s.published_at) : null);
        if (!sDate) continue;
        
        // Must be BEFORE this signal and within 14 days before it
        if (sDate >= signalDate || sDate < fourteenDaysBeforeSignal) continue;
        
        // Check anchor matches
        const sameCompany = signal.company_entities && s.company_entities && 
          signal.company_entities.toLowerCase() === s.company_entities.toLowerCase();
        const sameCounty = signal.county && s.county && 
          signal.county.toLowerCase() === s.county.toLowerCase();
        const sameAsset = signal.asset_type_guess && s.asset_type_guess && 
          signal.asset_type_guess.toLowerCase() === s.asset_type_guess.toLowerCase();
        
        // Calculate weighted score
        // who match = +3, asset match = +2, county match = +1
        const score = (sameCompany ? 3 : 0) + (sameAsset ? 2 : 0) + (sameCounty ? 1 : 0);
        
        // Only count if score ≥ 3 (prevents false positives from county-only or asset-only matches)
        // This means: company alone (3) counts, asset+county (3) counts, but county alone (1) or asset alone (2) don't
        if (score < 3) continue;
        
        // Categorize by match type for display
        if (sameCompany && sameAsset) {
          // Company + Asset (score = 5) - strongest match
          timeBasedRecurrenceByAnchor.strong++;
          timeBasedRecurrence++;
        } else if (sameCompany && sameCounty) {
          // Company + County (score = 4) - strong match
          timeBasedRecurrenceByAnchor.strong++;
          timeBasedRecurrence++;
        } else if (sameCompany) {
          // Company alone (score = 3) - counts
          timeBasedRecurrenceByAnchor.company++;
          timeBasedRecurrence++;
        } else if (sameAsset && sameCounty) {
          // Asset + County (score = 3) - counts
          timeBasedRecurrenceByAnchor.strong++;
          timeBasedRecurrence++;
        }
        // Asset alone (score = 2) and County alone (score = 1) are filtered out by score < 3 check
      }
    }
    
    // Same county count (all signals)
    const sameCountyCount = allSignals.filter(s => {
      if (s.signal_id === signal.signal_id) return false;
      return signal.county && s.county && 
        signal.county.toLowerCase() === s.county.toLowerCase();
    }).length;
    
    // Same county + CONSTRAINT lane count
    const sameCountyConstraints = allSignals.filter(s => {
      if (s.signal_id === signal.signal_id) return false;
      const sameCounty = signal.county && s.county && 
        signal.county.toLowerCase() === s.county.toLowerCase();
      return sameCounty && s.lane === 'CONSTRAINT';
    }).length;
    
    // Determine primary matching anchor for display
    const getPrimaryAnchor = () => {
      // Phase 3: Prioritize strong matches first (multiple anchors = highest confidence)
      if (timeBasedRecurrenceByAnchor.strong > 0) {
        return 'strong';
      }
      // Phase 2: Then show which single anchor is matching (most common)
      const counts = [
        { type: 'company', count: timeBasedRecurrenceByAnchor.company },
        { type: 'county', count: timeBasedRecurrenceByAnchor.county },
        { type: 'asset', count: timeBasedRecurrenceByAnchor.asset }
      ];
      counts.sort((a, b) => b.count - a.count);
      return counts[0].count > 0 ? counts[0].type : null;
    };
    
    return {
      timeBasedRecurrence,
      timeBasedRecurrenceByAnchor,
      primaryAnchor: getPrimaryAnchor(),
      generalRecurrence,
      sameCountyCount,
      sameCountyConstraints
    };
  };

  // Generate "Why this surfaced" explanation for News signals
  // Machine-generated, short, and opinionated to help orient instantly
  // Now incorporates situation-based change types (NEW, ESCALATED, REPEATED)
  const generateWhySurfaced = (signal) => {
    if (signal.source_type !== 'TAVILY') return null;

    const tags = signal.tags ? JSON.parse(signal.tags || '[]') : [];
    const recurrenceTag = tags.find(t => t.startsWith('recurrence:'));
    const frictionTags = tags.filter(t => t.startsWith('friction:'));
    
    const recurrenceCount = recurrenceTag ? parseInt(recurrenceTag.split(':')[1]) || 0 : 0;
    const frictionTypes = frictionTags.map(t => t.replace('friction:', ''));
    
    // Get ordinal (First, Second, Third, etc.)
    const getOrdinal = (n) => {
      const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
      if (n === 0) return null;
      if (n <= 10) return ordinals[n - 1];
      return `${n}th`;
    };

    // Get location context
    const getLocationContext = () => {
      if (signal.county) return `${signal.county} County`;
      if (signal.city) return signal.city;
      return 'Texas';
    };

    // Get asset/entity context - use REAL extracted data only
    const getEntityContext = () => {
      // Priority 1: Use extracted company/developer from anchor extraction (REAL DATA)
      if (signal.company_entities) {
        return signal.company_entities;
      }
      
      // Priority 2: Use extracted asset type from anchor extraction (REAL DATA)
      if (signal.asset_type_guess) {
        const assetType = signal.asset_type_guess.replace(/_/g, ' ').toLowerCase();
        return assetType;
      }
      
      // If no extracted data available, return null (don't generate synthetic data)
      return null;
    };

    // Get friction type description
    const getFrictionDescription = (frictionType) => {
      const descriptions = {
        moratorium: 'moratorium',
        lawsuit: 'lawsuit',
        zoning: 'zoning rejection',
        opposition: 'opposition',
        environmental: 'environmental challenge',
        permit_denial: 'permit denial'
      };
      return descriptions[frictionType] || frictionType.replace(/_/g, ' ');
    };

    // Check if related to ERCOT queue backlog
    const isErcotRelated = signal.headline && /queue|interconnection|ercot|backlog/i.test(signal.headline + (signal.raw_text || ''));

    // Build the explanation - ONLY use REAL extracted data
    const parts = [];
    
    // Only generate explanation if we have enough real data
    const entityContext = getEntityContext();
    const location = getLocationContext();
    const hasFriction = frictionTypes.length > 0 || signal.event_type;
    
    // Need at least: (entity OR friction) AND location to generate meaningful explanation
    if (!entityContext && !hasFriction) {
      return null; // Not enough real data
    }
    if (!location || location === 'Texas') {
      // If only generic "Texas", still allow but prefer more specific
    }
    
    // Start with ordinal if there's recurrence (REAL recurrence count from database)
    if (recurrenceCount > 0) {
      const ordinal = getOrdinal(recurrenceCount + 1);
      if (ordinal) parts.push(ordinal);
    } else if (frictionTypes.length > 0) {
      // Only use "First" if we have real friction type detected
      parts.push('First');
    }

    // Add entity/asset context (REAL extracted data)
    if (entityContext) {
      parts.push(entityContext);
    }

    // Add friction type (REAL extracted from article text)
    if (frictionTypes.length > 0) {
      const primaryFriction = frictionTypes[0];
      parts.push(getFrictionDescription(primaryFriction));
    } else if (signal.event_type) {
      // Use real event_type from classifier (REAL DATA)
      const eventMap = {
        'WITHDRAWN': 'withdrawal',
        'DENIED': 'denial',
        'ESCALATED': 'escalation',
        'LAWSUIT': 'lawsuit',
        'MORATORIUM': 'moratorium'
      };
      const eventDesc = eventMap[signal.event_type] || signal.event_type.toLowerCase().replace(/_/g, ' ');
      parts.push(eventDesc);
    }

    // Add location (REAL extracted from article)
    parts.push(`in ${location}`);

    // Add time context (based on REAL recurrence count)
    if (recurrenceCount >= 2) {
      parts.push('this quarter');
    } else if (recurrenceCount === 1) {
      parts.push('this month');
    }

    // Add ERCOT queue backlog reference (REAL detection from article text)
    if (isErcotRelated) {
      parts.push('tied to ERCOT queue backlog');
    }

    // Only return if we have meaningful parts
    if (parts.length < 3) {
      return null; // Not enough real data to generate explanation
    }

    return parts.join(' ');
  };

  // Parse ERCOT headline to extract capacity and fuel type
  const parseErcotHeadline = (headline) => {
    if (!headline) return { capacity: null, fuelType: null };
    
    // Pattern: "Project Name - XXXMW FuelType"
    // Example: "Rocking X Solar - 602.2MW Solar"
    const mwMatch = headline.match(/(\d+\.?\d*)\s*MW/i);
    const capacity = mwMatch ? parseFloat(mwMatch[1]) : null;
    
    // Extract fuel type (usually after MW)
    const afterMW = headline.split(/\d+\.?\d*\s*MW/i)[1]?.trim();
    const fuelType = afterMW || null;
    
    return { capacity, fuelType };
  };

  // Get power scale context (small/medium/large) with visual indicator
  const getPowerScale = (capacityMW) => {
    if (!capacityMW) return { scale: 'unknown', label: 'Unknown', colorClass: 'bg-gray-500/20 text-gray-300 border-gray-500/30', barClass: 'bg-gray-500', percentage: 0, context: '' };
    
    // Scale definitions (adjusted for accuracy):
    // Small: < 50MW (small commercial, residential solar)
    // Medium: 50-200MW (typical large data center, small power plant)
    // Large: 200-1000MW (major power plant, significant industrial)
    // Very Large: > 1000MW (major power plant scale, nuclear reactor size)
    
    let scale, label, colorClass, barClass, context;
    const maxScale = 1000; // Max for visualization (1GW = one nuclear reactor - good reference point)
    
    if (capacityMW < 50) {
      scale = 'small';
      label = 'Small';
      colorClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      barClass = 'bg-gradient-to-r from-blue-500 to-blue-400';
      context = 'Typical: Small commercial facility or residential solar farm';
    } else if (capacityMW < 200) {
      scale = 'medium';
      label = 'Medium';
      colorClass = 'bg-green-500/20 text-green-300 border-green-500/30';
      barClass = 'bg-gradient-to-r from-green-500 to-green-400';
      context = 'Typical: Large data center (50-200MW) or small power plant';
    } else if (capacityMW < 1000) {
      scale = 'large';
      label = 'Large';
      colorClass = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      barClass = 'bg-gradient-to-r from-orange-500 to-orange-400';
      context = 'Typical: Major industrial facility or mid-size power plant';
    } else {
      scale = 'very-large';
      label = 'Very Large';
      colorClass = 'bg-red-500/20 text-red-300 border-red-500/30';
      barClass = 'bg-gradient-to-r from-red-500 to-red-400';
      context = 'Typical: Nuclear reactor scale or larger';
    }
    
    // Cap percentage at 100% for visualization, but track if it exceeds max
    const percentage = Math.min((capacityMW / maxScale) * 100, 100);
    const exceedsMax = capacityMW > maxScale;
    
    return { scale, label, colorClass, barClass, percentage, context, capacityMW, exceedsMax };
  };

  // Count signals from same developer
  const getDeveloperSignalCount = (developer) => {
    if (!developer) return 0;
    return signals.filter(s => 
      s.company_entities && 
      s.company_entities.toLowerCase() === developer.toLowerCase() &&
      s.source_type === 'ERCOT_QUEUE'
    ).length;
  };

  // Get all ERCOT signals for a developer
  const getDeveloperSignals = (developer) => {
    if (!developer) return [];
    return signals.filter(s => 
      s.company_entities && 
      s.company_entities.toLowerCase() === developer.toLowerCase() &&
      s.source_type === 'ERCOT_QUEUE'
    );
  };

  // Get fuel type icon and styling
  // Handle clicking on county name to select county on map
  const handleCountyClick = async (countyName, signal) => {
    if (!countyName || !window.mapInstance) {
      console.warn('County name or map instance not available');
      return;
    }

    try {
      const mapInstance = window.mapInstance;
      const SOURCE_ID = 'ercot-counties-source';
      const FILL_LAYER_ID = 'ercot-counties-fill';

      // Helper function to get features from source
      const getSourceFeatures = () => {
        const source = mapInstance.getSource(SOURCE_ID);
        if (!source) return null;
        
        // Try getting from source data directly (most reliable)
        if (source._data && source._data.features) {
          return source._data.features;
        }
        
        // Fallback: try querySourceFeatures
        try {
          const features = mapInstance.querySourceFeatures(SOURCE_ID);
          if (features && features.length > 0) {
            return features;
          }
        } catch (e) {
          console.warn('querySourceFeatures failed:', e);
        }
        
        return null;
      };

      // Wait for source to be ready (with timeout)
      const waitForSource = (maxAttempts = 30, delay = 150) => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const checkSource = () => {
            attempts++;
            const source = mapInstance.getSource(SOURCE_ID);
            const features = getSourceFeatures();
            
            if (source && features && features.length > 0) {
              console.log(`✅ Source ready after ${attempts} attempts with ${features.length} features`);
              resolve(features);
            } else if (attempts >= maxAttempts) {
              reject(new Error(`Source not ready after ${maxAttempts} attempts`));
            } else {
              setTimeout(checkSource, delay);
            }
          };
          checkSource();
        });
      };

      // Check if source exists, if not the layer needs to be enabled
      let source = mapInstance.getSource(SOURCE_ID);
      if (!source) {
        console.log('⚠️ ERCOT counties source not found. The layer may not be enabled yet.');
        console.log('💡 Please enable the ERCOT Counties layer in the layer toggle first, then try clicking the county name again.');
        return;
      }

      // Wait for source data to be loaded
      let allFeatures;
      try {
        allFeatures = await waitForSource();
      } catch (error) {
        console.warn('⚠️ Could not load source features:', error);
        // Try one more time with direct query
        allFeatures = getSourceFeatures();
        if (!allFeatures || allFeatures.length === 0) {
          console.warn('❌ ERCOT counties layer data not loaded. Please ensure the ERCOT Counties layer is enabled in the layer toggle.');
          return;
        }
      }
      
      // Normalize county name: remove "County", ", Texas", and trim whitespace
      const normalizedCountyName = countyName
        .toLowerCase()
        .replace(/\s*,\s*texas\s*$/i, '')  // Remove ", Texas"
        .replace(/\s+county\s*$/i, '')      // Remove "County"
        .trim();
      
      console.log(`🔍 Looking for county: "${countyName}" -> normalized: "${normalizedCountyName}"`);
      
      // Find county by matching NAME property (case-insensitive)
      let countyFeature = allFeatures.find(f => {
        const name = f.properties?.NAME || f.properties?.name;
        if (!name) return false;
        const normalizedName = name.toLowerCase().trim();
        // Exact match after normalization
        if (normalizedName === normalizedCountyName) {
          console.log(`✅ Found exact match: "${name}"`);
          return true;
        }
        // Also try matching the original name
        if (name.toLowerCase() === countyName.toLowerCase()) {
          console.log(`✅ Found original match: "${name}"`);
          return true;
        }
        return false;
      });

      // If not found, try more flexible matching (contains)
      if (!countyFeature) {
        console.log(`⚠️ Exact match not found, trying flexible matching...`);
        countyFeature = allFeatures.find(f => {
          const name = f.properties?.NAME || f.properties?.name;
          if (!name) return false;
          const normalizedName = name.toLowerCase().trim();
          // Try partial match (contains)
          const matches = normalizedName.includes(normalizedCountyName) || 
                         normalizedCountyName.includes(normalizedName);
          if (matches) {
            console.log(`✅ Found flexible match: "${name}"`);
          }
          return matches;
        });
      }

      if (!countyFeature || !countyFeature.geometry) {
        // Debug: log available county names for troubleshooting
        const availableCounties = allFeatures
          .map(f => f.properties?.NAME || f.properties?.name)
          .filter(Boolean)
          .sort()
          .slice(0, 20);
        console.warn(`❌ County "${countyName}" (normalized: "${normalizedCountyName}") not found in ERCOT counties layer.`);
        console.warn(`Available counties (sample):`, availableCounties);
        console.warn(`Total counties in data: ${allFeatures.length}`);
        return;
      }
      
      console.log(`✅ Successfully found county: "${countyFeature.properties?.NAME || countyFeature.properties?.name}"`);

      // Calculate centroid of the county
      const centroid = turf.centroid(countyFeature.geometry);
      const [lng, lat] = centroid.geometry.coordinates;

      // Convert geographic coordinates to screen/pixel coordinates
      const point = mapInstance.project([lng, lat]);

      // Query rendered features at this point to see if county is visible
      const renderedFeatures = mapInstance.queryRenderedFeatures(point, {
        layers: [FILL_LAYER_ID]
      });

      if (renderedFeatures.length > 0) {
        // County is visible, trigger click directly
        const clickEvent = {
          point: point,
          lngLat: { lng, lat },
          features: renderedFeatures,
          originalEvent: {
            preventDefault: () => {},
            stopPropagation: () => {}
          }
        };
        
        // Fire the click event on the specific layer
        // Mapbox will route this to the layer's click handler
        mapInstance.fire('click', clickEvent);
      } else {
        // County not currently visible, zoom to it first
        const bbox = turf.bbox(countyFeature.geometry);
        mapInstance.fitBounds(bbox, {
          padding: 50,
          duration: 500,
          maxZoom: 10
        });

        // Wait for zoom animation to complete, then trigger click
        setTimeout(() => {
          const newPoint = mapInstance.project([lng, lat]);
          const newRenderedFeatures = mapInstance.queryRenderedFeatures(newPoint, {
            layers: [FILL_LAYER_ID]
          });

          if (newRenderedFeatures.length > 0) {
            const clickEvent = {
              point: newPoint,
              lngLat: { lng, lat },
              features: newRenderedFeatures,
              originalEvent: {
                preventDefault: () => {},
                stopPropagation: () => {}
              }
            };
            mapInstance.fire('click', clickEvent);
          } else {
            // Still not visible, try dispatching a mouse event on the canvas
            const canvas = mapInstance.getCanvasContainer();
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const x = rect.left + newPoint.x;
              const y = rect.top + newPoint.y;
              
              // Create and dispatch a click event
              const mouseEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0
              });
              
              canvas.dispatchEvent(mouseEvent);
            }
          }
        }, 600);
      }
    } catch (error) {
      console.error('Error clicking county on map:', error);
    }
  };

  const getFuelTypeIcon = (fuelType) => {
    if (!fuelType) return null;
    const normalized = fuelType.toLowerCase();
    
    if (normalized.includes('solar')) {
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        colorClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/20 border-yellow-500/30'
      };
    } else if (normalized.includes('wind')) {
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/20 border-blue-500/30'
      };
    } else if (normalized.includes('battery') || normalized.includes('storage') || normalized.includes('ess')) {
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        colorClass: 'text-green-400',
        bgClass: 'bg-green-500/20 border-green-500/30'
      };
    } else if (normalized.includes('gas') || normalized.includes('natural gas')) {
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
        colorClass: 'text-orange-400',
        bgClass: 'bg-orange-500/20 border-orange-500/30'
      };
    }
    
    // Default icon for other types
    return {
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      colorClass: 'text-gray-400',
      bgClass: 'bg-gray-500/20 border-gray-500/30'
    };
  };

  return (
    <div className={`${inline ? 'relative' : 'fixed top-20 right-4'} max-h-[80vh] ${inline ? 'bg-transparent' : 'bg-[#1a1a1a]'} border border-[#333333] rounded-lg shadow-xl ${inline ? '' : 'z-50'} flex flex-col transition-all duration-300 ${
      isExpanded ? 'w-[768px]' : inline ? 'w-full' : 'w-96'
    }`}>
      {/* Notification Toast */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-lg shadow-lg border ${
            notification.type === 'success'
              ? 'bg-green-900/90 border-green-500 text-green-100'
              :             notification.type === 'error'
              ? 'bg-red-900/90 border-red-500 text-red-100'
              : notification.type === 'warning'
              ? 'bg-orange-900/90 border-orange-500 text-orange-100'
              : 'bg-[#1f1f1f] border-[#333333] text-gray-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {notification.type === 'warning' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {notification.type === 'info' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
              {notification.details && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowNotificationDetails(prev => !prev)}
                    className="text-xs opacity-80 hover:opacity-100 underline"
                  >
                    {showNotificationDetails ? 'Hide details' : 'Show details'}
                  </button>
                  {showNotificationDetails && (
                    <div className="mt-1 text-xs opacity-90 whitespace-pre-line">
                      {notification.details}
                      {notification.downloadStatus?.error && (
                        <div className="mt-2 pt-2 border-t border-current/20">
                          <strong>Full error:</strong> {notification.downloadStatus.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setNotification(null);
                setShowNotificationDetails(false);
              }}
              className="text-current opacity-70 hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-[#333333]">
        <div className="flex items-center justify-between mb-3 relative scanner-header-menu">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowHeaderMenu(!showHeaderMenu);
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <h2 className="text-lg font-semibold text-white">Scanner Signals</h2>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`text-gray-400 transition-transform ${showHeaderMenu ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {/* Header Menu Dropdown */}
          {showHeaderMenu && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-[#1f1f1f] border border-[#333333] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="py-1">
                {/* Refresh NEWS Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshNews();
                    setShowHeaderMenu(false);
                  }}
                  disabled={refreshing.news}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  title="Refresh NEWS data (Tavily)"
                >
                  {refreshing.news ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Refreshing NEWS...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                      <span>Refresh NEWS</span>
                    </>
                  )}
                </button>
                
                {/* Refresh ERCOT Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshErcot();
                    setShowHeaderMenu(false);
                  }}
                  disabled={refreshing.ercot}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  title="Refresh ERCOT data"
                >
                  {refreshing.ercot ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Refreshing ERCOT...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                      <span>Refresh ERCOT</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Toggle Filter Buttons Button */}
          <button
            onClick={() => setShowFilterButtons(!showFilterButtons)}
            className="p-1.5 rounded-md hover:bg-[#333333] transition-colors text-gray-400 hover:text-white"
            title={showFilterButtons ? 'Hide filter buttons' : 'Show filter buttons'}
            aria-label={showFilterButtons ? 'Hide filter buttons' : 'Show filter buttons'}
          >
            {showFilterButtons ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M12 3v18" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Source Filter Buttons */}
        {showFilterButtons && (
        <div className="flex gap-2">
          <button
            onClick={() => handleSourceChange(null)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedSource === null
                ? 'bg-[#1a73e8] text-white'
                : 'bg-[#333333] text-gray-300 hover:bg-[#3c3c3c]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleSourceChange('TAVILY')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedSource === 'TAVILY'
                ? 'bg-[#1a73e8] text-white'
                : 'bg-[#333333] text-gray-300 hover:bg-[#3c3c3c]'
            }`}
          >
            News
          </button>
          <button
            onClick={() => handleSourceChange('ERCOT_QUEUE')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedSource === 'ERCOT_QUEUE'
                ? 'bg-[#1a73e8] text-white'
                : 'bg-[#333333] text-gray-300 hover:bg-[#3c3c3c]'
            }`}
          >
            ERCOT
          </button>
        </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center text-gray-400 py-8">Loading signals...</div>
        )}
        
        {error && (
          <div className="text-center text-red-400 py-8">
            Error: {error}
          </div>
        )}
        
        {!loading && !error && signals.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            No signals found
          </div>
        )}
        
        {!loading && !error && signals.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
                     {signals
                       .sort((a, b) => {
                         // Sort order:
                         // 1) Manually highlighted
                         // 2) ERCOT projects UPDATED this refresh
                         // 3) ERCOT projects NEW this refresh
                         // 4) Non-reviewed vs reviewed
                         // 5) For ERCOT: capacity (larger first)

                         const aReviewed = (a.status || 'NEW') === 'REVIEWED';
                         const bReviewed = (b.status || 'NEW') === 'REVIEWED';
                         const aHighlighted = highlightedSignals.has(a.signal_id);
                         const bHighlighted = highlightedSignals.has(b.signal_id);

                         const aIsErcot = a.source_type === 'ERCOT_QUEUE';
                         const bIsErcot = b.source_type === 'ERCOT_QUEUE';
                         const aUpdated = aIsErcot && ercotUpdatedIds.has(a.signal_id);
                         const bUpdated = bIsErcot && ercotUpdatedIds.has(b.signal_id);
                         const aNew = aIsErcot && ercotNewIds.has(a.signal_id);
                         const bNew = bIsErcot && ercotNewIds.has(b.signal_id);
                         
                         // Highlighted signals always on top
                         if (aHighlighted && !bHighlighted) return -1;
                         if (!aHighlighted && bHighlighted) return 1;

                         // Among non-highlighted: ERCOT UPDATED signals (this refresh) come next
                         if (aUpdated && !bUpdated) return -1;
                         if (!aUpdated && bUpdated) return 1;

                         // Then ERCOT NEW signals (this refresh)
                         if (aNew && !bNew) return -1;
                         if (!aNew && bNew) return 1;
                         
                         // Among remaining: reviewed go to bottom
                         if (!aReviewed && bReviewed) return -1;
                         if (aReviewed && !bReviewed) return 1;
                         
                         // For ERCOT signals: sort by capacity (larger first)
                         if (aIsErcot && bIsErcot) {
                           const aCapacity = parseErcotHeadline(a.headline).capacity || 0;
                           const bCapacity = parseErcotHeadline(b.headline).capacity || 0;
                           return bCapacity - aCapacity; // Descending order (larger first)
                         }

                         // For News signals: sort by recurrence_14d (highest pressure first)
                         const aIsNews = a.source_type === 'TAVILY';
                         const bIsNews = b.source_type === 'TAVILY';
                         if (aIsNews && bIsNews) {
                           // Use recurrence_14d from database (windowed count)
                           const aRecurrence = a.recurrence_14d || 0;
                           const bRecurrence = b.recurrence_14d || 0;
                           return bRecurrence - aRecurrence; // Descending order (highest pressure first)
                         }
                         
                         // If both same review status, maintain original order (by ingested_at DESC)
                         return 0;
                       })
                .map((signal, index) => {
              const isReviewed = (signal.status || 'NEW') === 'REVIEWED';
              const isUpdating = updatingStatus.has(signal.signal_id);
              const isHighlighted = highlightedSignals.has(signal.signal_id);
              
              return (
                <motion.div
                  key={signal.signal_id}
                  layout
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    transition: { duration: 0.3, ease: "easeOut" }
                  }}
                  exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                  transition={{ 
                    layout: { duration: 0.4, ease: "easeInOut" },
                    opacity: { duration: 0.2 }
                  }}
                  className={`bg-[#2a2a2a] border border-[#3c3c3c] rounded-lg p-3 hover:bg-[#333333] ${
                    isHighlighted 
                      ? 'border-2 border-yellow-400 bg-yellow-900/20 shadow-lg shadow-yellow-500/20' 
                      : ''
                  } ${
                    isReviewed ? 'opacity-50' : 'opacity-100'
                  } ${isUpdating ? 'pointer-events-none' : ''}`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className={`text-sm font-medium line-clamp-2 ${
                        isHighlighted
                          ? 'text-yellow-200 font-semibold'
                          : isReviewed 
                            ? 'text-gray-500' 
                            : 'text-white'
                      }`}>
                        {signal.headline || 'Untitled Signal'}
                      </h3>
                      {/* Pattern Indicators - Surface recurrence explicitly */}
                      {signal.source_type === 'TAVILY' && (() => {
                        const patterns = calculatePatternMetrics(signal, signals);
                        if (!patterns) return null;
                        
                        const hasPatterns = patterns.timeBasedRecurrence > 0 || 
                                          patterns.generalRecurrence > 0 || 
                                          patterns.sameCountyConstraints > 0;
                        
                        if (!hasPatterns) return null;
                        
                        return (
                          <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
                            {/* Phase 3: Show strong matches first (multiple anchors) */}
                            {patterns.timeBasedRecurrenceByAnchor?.strong > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 border border-red-500/30 font-medium">
                                {patterns.timeBasedRecurrenceByAnchor.strong}× strong match (multiple anchors)
                              </span>
                            )}
                            {/* Phase 2: Show which anchor is matching with count */}
                            {patterns.timeBasedRecurrence > 0 && patterns.primaryAnchor && (
                              (() => {
                                const anchorLabels = {
                                  company: 'same company',
                                  county: 'same county',
                                  asset: 'same asset type',
                                  strong: 'multiple anchors'
                                };
                                const anchorCount = patterns.primaryAnchor === 'strong' 
                                  ? patterns.timeBasedRecurrenceByAnchor?.strong || 0
                                  : patterns.timeBasedRecurrenceByAnchor?.[patterns.primaryAnchor] || 0;
                                
                                // Only show if there are matches for this anchor type
                                if (anchorCount === 0) return null;
                                
                                // For strong matches, we already showed above, so skip here
                                if (patterns.primaryAnchor === 'strong') return null;
                                
                                return (
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/90 border border-orange-500/20">
                                    Seen {anchorCount}× in last 14 days ({anchorLabels[patterns.primaryAnchor]})
                                  </span>
                                );
                              })()
                            )}
                            {/* Fallback: if no primary anchor but we have matches */}
                            {patterns.timeBasedRecurrence > 0 && !patterns.primaryAnchor && (
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/90 border border-orange-500/20">
                                Seen {patterns.timeBasedRecurrence}× in last 14 days
                              </span>
                            )}
                            {/* Show windowed recurrence counts from database */}
                            {signal.recurrence_14d > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300/90 border border-yellow-500/20">
                                {signal.recurrence_14d}× in last 14 days
                                {signal.recurrence_90d > signal.recurrence_14d && (
                                  <span className="ml-1 text-yellow-400/70">({signal.recurrence_90d}× in 90d)</span>
                                )}
                              </span>
                            )}
                            {/* Fallback to general recurrence if windowed counts not available */}
                            {!signal.recurrence_14d && patterns.generalRecurrence > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300/90 border border-yellow-500/20">
                                Related to {patterns.generalRecurrence} prior signal{patterns.generalRecurrence !== 1 ? 's' : ''}
                              </span>
                            )}
                            {patterns.sameCountyConstraints > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300/90 border border-red-500/20">
                                Same county as {patterns.sameCountyConstraints} other constraint{patterns.sameCountyConstraints !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleHighlight(signal.signal_id);
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                          isHighlighted
                            ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900 shadow-md'
                            : ''
                        } ${getLaneColor(signal.lane)}`}
                        title={isHighlighted ? 'Unhighlight signal' : 'Highlight signal (important)'}
                      >
                        {signal.lane || 'UNKNOWN'}
                      </button>
                    </div>
                  </div>

                  {/* When/What/Where Details - Enhanced for ERCOT */}
                  {signal.source_type === 'ERCOT_QUEUE' ? (() => {
                    const { capacity, fuelType } = parseErcotHeadline(signal.headline);
                    const bodyText = signal.body_text || signal.raw_text || '';
                    
                    // Parse body_text for additional details
                    const poiMatch = bodyText.match(/POI[:\s]+([^\n]+)/i);
                    const poiLocation = poiMatch ? poiMatch[1].trim() : null;
                    const statusMatch = bodyText.match(/Status[:\s]+([^\n]+)/i);
                    const queueStatus = statusMatch ? statusMatch[1].trim() : null;
                    
                    return (
                      <div className="space-y-4 mt-2">
                        {/* WHEN */}
                        {signal.published_at && (() => {
                          const isUpdated = ercotUpdatedIds.has(signal.signal_id);
                          const isNew = ercotNewIds.has(signal.signal_id);
                          
                          return (
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>
                                <span className="font-medium">When:</span>{' '}
                                {new Date(signal.published_at).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </span>
                              {/* Change indicator badge */}
                              {isUpdated && (
                                <span className="px-[0.33rem] py-[0.11rem] rounded text-[0.66rem] font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                  Updated
                                </span>
                              )}
                              {isNew && !isUpdated && (
                                <span className="px-[0.33rem] py-[0.11rem] rounded text-[0.66rem] font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                                  New
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* WHAT - Enhanced with Power Scale */}
                        <div className="mb-2">
                        {(capacity || fuelType || queueStatus) && (() => {
                          const powerScale = capacity ? getPowerScale(capacity) : null;
                          
                          return (
                            <div className="flex items-start gap-2 text-xs">
                              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className={`flex-1 ${isReviewed ? 'text-gray-500' : 'text-gray-300'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">What:</span>
                                  {capacity && (
                                    <span className="font-semibold text-blue-400">{capacity}MW</span>
                                  )}
                                </div>
                                {/* Badges on new line */}
                                {(powerScale || fuelType || queueStatus) && (
                                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                    {powerScale && (
                                      <span className={`inline-flex items-center gap-1 px-[0.33rem] py-[0.11rem] rounded text-[0.66rem] font-medium border ${powerScale.colorClass}`}>
                                        {powerScale.label}
                                      </span>
                                    )}
                                    {fuelType && (() => {
                                      const fuelIcon = getFuelTypeIcon(fuelType);
                                      return fuelIcon ? (
                                        <span className={`inline-flex items-center gap-1 px-[0.33rem] py-[0.11rem] rounded text-[0.66rem] font-medium border ${fuelIcon.bgClass} ${fuelIcon.colorClass}`}>
                                          {fuelIcon.icon}
                                          <span>{fuelType}</span>
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 text-[0.66rem]">{fuelType}</span>
                                      );
                                    })()}
                                    {queueStatus && (
                                      <span className={`px-[0.33rem] py-[0.11rem] rounded text-[0.66rem] ${getStatusBadgeClasses(queueStatus)}`}>
                                        {queueStatus}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Power Scale Visual Bar */}
                                {powerScale && capacity && (
                                  <div className="mt-3 mb-8">
                                    <div className="flex items-start gap-2 text-xs mb-2">
                                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                      </svg>
                                      <div className="flex-1">
                                        <span className={`font-medium ${isReviewed ? 'text-gray-500' : 'text-gray-300'}`}>Scale:</span>
                                        <div className={`mt-1 text-xs ${isReviewed ? 'text-gray-500' : 'text-gray-400'}`}>{powerScale.context}</div>
                                      </div>
                                    </div>
                                    <div className="relative w-full" style={{ marginTop: '25px' }}>
                                      {/* Indicator callout above the bar with arrow */}
                                      <div className="relative w-full mb-1" style={{ height: '20px' }}>
                                        {powerScale.exceedsMax ? (
                                          <>
                                            <span 
                                              className="absolute text-xs text-gray-400 font-medium"
                                              style={{ right: '0.1%', top: '-8px', transform: 'translateX(0)' }}
                                            >
                                              ~{capacity}MW
                                            </span>
                                            {/* Arrow pointing up - positioned at the end of the bar */}
                                            <div 
                                              className="absolute"
                                              style={{ right: 0, top: '12px', transform: 'translateX(0)' }}
                                            >
                                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-gray-400">
                                                <path d="M4 8L0 0H8L4 8Z" fill="currentColor" />
                                              </svg>
                                            </div>
                                          </>
                                        ) : powerScale.percentage > 85 ? (
                                          // For very large values (>85%), position indicator more to the right to avoid going off screen
                                          <>
                                            <span 
                                              className="absolute text-xs text-gray-400 font-medium"
                                              style={{ right: '10%', top: '-4px', transform: 'translateX(0)' }}
                                            >
                                              ~{capacity}MW
                                            </span>
                                            {/* Arrow pointing up - positioned at the end of the bar */}
                                            <div 
                                              className="absolute"
                                              style={{ right: 0, top: '12px', transform: 'translateX(0)' }}
                                            >
                                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-gray-400">
                                                <path d="M4 8L0 0H8L4 8Z" fill="currentColor" />
                                              </svg>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <span 
                                              className="absolute text-xs text-gray-400 font-medium"
                                              style={{ left: `${powerScale.percentage}%`, top: '-4px', transform: 'translateX(-50%)' }}
                                            >
                                              ~{capacity}MW
                                            </span>
                                            {/* Arrow pointing up */}
                                            <div 
                                              className="absolute"
                                              style={{ left: `${powerScale.percentage}%`, top: '12px', transform: 'translateX(-50%)' }}
                                            >
                                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-gray-400">
                                                <path d="M4 8L0 0H8L4 8Z" fill="currentColor" />
                                              </svg>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <div className="w-full bg-[#3c3c3c] rounded-full h-1.5 overflow-hidden">
                                        <div 
                                          className={`h-full ${powerScale.barClass} transition-all duration-300`}
                                          style={{ width: `${powerScale.percentage}%` }}
                                          title={`${capacity}MW (${powerScale.label} scale)`}
                                        />
                                      </div>
                                      {/* End scale labels below the bar */}
                                      <div className="relative w-full mt-1">
                                        <span className="absolute left-0 text-xs text-gray-500">0MW</span>
                                        <span className="absolute right-0 text-xs text-gray-500">1000MW (1 nuclear reactor)</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        </div>
                        
                        {/* WHERE - Enhanced with POI explanation and developer context */}
                        {(signal.county || poiLocation || signal.company_entities) && (
                          <div className="flex items-start gap-2 text-xs mt-2">
                            <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <div className={`flex-1 ${isReviewed ? 'text-gray-500' : 'text-gray-300'}`}>
                              <span className="font-medium">Where:</span>{' '}
                              {signal.county && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCountyClick(signal.county, signal);
                                  }}
                                  className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                  title={`Click to select ${signal.county} County on map`}
                                >
                                  {signal.county} County, Texas
                                </button>
                              )}
                              {poiLocation && (
                                <div className="mt-1 flex items-start gap-1">
                                  <span className="text-gray-400">POI:</span>
                                  <div className="flex-1">
                                    <span className="text-gray-300">{poiLocation}</span>
                                    <div className="mt-0.5 flex items-center gap-1 text-gray-500">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-xs italic">Point of Interconnection (grid connection point)</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {signal.company_entities && (() => {
                                const devCount = getDeveloperSignalCount(signal.company_entities);
                                return (
                                  <>
                                    <div className="mt-4 flex items-start gap-1">
                                      <span className="text-gray-400">Developer:</span>
                                      <div className="flex-1">
                                        <span className="text-gray-300">{signal.company_entities}</span>
                                      </div>
                                    </div>
                                    {devCount > 1 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedDeveloper(prev => prev === signal.company_entities ? null : signal.company_entities);
                                          }}
                                          className="mt-3 inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30 hover:bg-blue-500/30 hover:text-blue-100 transition-colors cursor-pointer"
                                        >
                                          {devCount} project{devCount !== 1 ? 's' : ''} in queue
                                        </button>
                                        {expandedDeveloper === signal.company_entities && (
                                          <div className="mt-2 space-y-1 text-xs text-gray-300 bg-[#2a2a2a] border border-blue-500/30 rounded-md p-2">
                                            {getDeveloperSignals(signal.company_entities).slice(0, 10).map((proj) => {
                                              const { capacity, fuelType } = parseErcotHeadline(proj.headline);
                                              const powerScale = capacity ? getPowerScale(capacity) : null;
                                              const bodyText = proj.body_text || proj.raw_text || '';
                                              const statusMatch = bodyText.match(/Status[:\s]+([^\n]+)/i);
                                              const queueStatus = statusMatch ? statusMatch[1].trim() : proj.status || null;
                                              const isProjectExpanded = expandedDevProjects.has(proj.signal_id);
                                              return (
                                                <div key={proj.signal_id} className="flex items-center justify-between gap-2">
                                                  <div className="flex-1 truncate">
                                                    {powerScale && (
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setExpandedDevProjects(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(proj.signal_id)) {
                                                              next.delete(proj.signal_id);
                                                            } else {
                                                              next.add(proj.signal_id);
                                                            }
                                                            return next;
                                                          });
                                                        }}
                                                        className={`inline-flex items-center px-[0.33rem] py-[0.11rem] rounded text-[0.55rem] font-medium border ${powerScale.colorClass} hover:bg-blue-500/20 hover:text-blue-100 transition-colors`}
                                                      >
                                                        {powerScale.label}
                                                        {isProjectExpanded && capacity && (
                                                          <span className="ml-1 text-[0.55rem] font-normal text-blue-100">
                                                            {capacity}MW
                                                          </span>
                                                        )}
                                                      </button>
                                                    )}
                                                    {fuelType && (() => {
                                                      const fuelIcon = getFuelTypeIcon(fuelType);
                                                      return fuelIcon ? (
                                                        <span className={`ml-2 inline-flex items-center gap-1 px-[0.33rem] py-[0.11rem] rounded text-[0.55rem] font-medium border ${fuelIcon.bgClass} ${fuelIcon.colorClass}`}>
                                                          {fuelIcon.icon}
                                                          <span>{fuelType}</span>
                                                        </span>
                                                      ) : (
                                                        <span className="ml-2 text-gray-400 text-[0.55rem]">{fuelType}</span>
                                                      );
                                                    })()}
                                                    {/* Hide location text when MW figure is shown for clarity */}
                                                    {proj.county && !isProjectExpanded && (
                                                      <span className="ml-2 text-gray-400">
                                                        {proj.county} County
                                                      </span>
                                                    )}
                                                  </div>
                                                  {queueStatus && (
                                                    <span className={`px-[0.33rem] py-[0.11rem] rounded text-[0.55rem] ${getStatusBadgeClasses(queueStatus)}`}>
                                                      {queueStatus}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <>
                      {/* News Signals: Show anchors and recurrence */}
                      {signal.source_type === 'TAVILY' ? (
                        <div className="space-y-2 mt-2">
                          {/* WHEN - Published date and ingested date */}
                          {(signal.published_at || signal.ingested_at) && (
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>
                                {signal.published_at ? (
                                  <>
                                    <span className="font-medium">Published:</span>{' '}
                                    {new Date(signal.published_at).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                    {signal.ingested_at && (
                                      <>
                                        {' • '}
                                        <span className="font-medium">Added:</span>{' '}
                                        {new Date(signal.ingested_at).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit'
                                        })}
                                      </>
                                    )}
                                  </>
                                ) : signal.ingested_at ? (
                                  <>
                                    <span className="font-medium">Added:</span>{' '}
                                    {new Date(signal.ingested_at).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </>
                                ) : null}
                              </span>
                            </div>
                          )}

                          {/* Situation Change Type Badge - Shows NEW, ESCALATED, REPEATED */}
                          {signal.change_type && signal.change_type !== 'UNKNOWN' && signal.change_type !== 'UNCHANGED' && (
                            <div className="mb-2">
                              {signal.change_type === 'NEW' && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  New Situation
                                </span>
                              )}
                              {signal.change_type === 'ESCALATED' && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                  Escalated (Context → Constraint)
                                </span>
                              )}
                              {signal.change_type === 'REPEATED' && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                  Situation Repeating
                                </span>
                              )}
                            </div>
                          )}

                          {/* "Why this surfaced" - Machine-generated, opinionated explanation */}
                          {(() => {
                            const whySurfaced = generateWhySurfaced(signal);
                            return whySurfaced ? (
                              <div className={`text-xs italic ${isReviewed ? 'text-gray-500' : 'text-gray-400'} mb-2`}>
                                <span className="font-medium text-gray-500">Why this surfaced:</span>{' '}
                                <span>{whySurfaced}</span>
                              </div>
                            ) : null;
                          })()}

                          {/* Anchors: Who, Where, Asset, Friction */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {signal.company_entities && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Who:</span>
                                <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>{signal.company_entities}</span>
                              </div>
                            )}
                            {(signal.county || signal.city) && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Where:</span>
                                <div className="flex items-center gap-1">
                                  {signal.city && (
                                    <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>
                                      {signal.city}
                                      {signal.county && ', '}
                                    </span>
                                  )}
                                  {signal.county && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCountyClick(signal.county, signal);
                                      }}
                                      className={`flex items-center gap-1 ${isReviewed ? 'text-gray-500 hover:text-gray-400' : 'text-blue-400 hover:text-blue-300 hover:underline'} cursor-pointer transition-colors font-medium`}
                                      title={`Click to view ${signal.county} County on map`}
                                    >
                                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span>{signal.county} County</span>
                                    </button>
                                  )}
                                  {!signal.city && !signal.county && (
                                    <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>Texas</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {signal.asset_type_guess && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Asset:</span>
                                <span className={isReviewed ? 'text-gray-500' : 'text-gray-300'}>{signal.asset_type_guess.replace(/_/g, ' ')}</span>
                                {/* Reviewed Toggle - Small and hidden */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReviewed(signal.signal_id, signal.status);
                                  }}
                                  disabled={isUpdating}
                                  className={`ml-1.5 flex-shrink-0 w-5 h-3 rounded-full transition-colors opacity-40 hover:opacity-100 focus:outline-none ${
                                    isReviewed
                                      ? 'bg-[#1a73e8]'
                                      : 'bg-[#3c3c3c]'
                                  } ${isUpdating ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  title={isReviewed ? 'Mark as unread' : 'Mark as reviewed'}
                                >
                                  <span
                                    className={`block w-2 h-2 rounded-full bg-white transition-transform ${
                                      isReviewed ? 'translate-x-2.5' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Recurrence indicator (pressure building) */}
                          {signal.tags && (() => {
                            const tags = JSON.parse(signal.tags || '[]');
                            const recurrenceTag = tags.find(t => t.startsWith('recurrence:'));
                            const frictionTags = tags.filter(t => t.startsWith('friction:'));
                            
                            return (
                              <div className="flex flex-wrap gap-2 items-center">
                                {recurrenceTag && (() => {
                                  const count = parseInt(recurrenceTag.split(':')[1]) || 0;
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                      count >= 3 
                                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                                        : count >= 1
                                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                        : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                                    }`}>
                                      🔁 Recurrence: {count} previous signal{count !== 1 ? 's' : ''}
                                    </span>
                                  );
                                })()}
                                {frictionTags.map((tag, idx) => {
                                  const frictionType = tag.replace('friction:', '');
                                  return (
                                    <span key={idx} className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                      {frictionType.replace(/_/g, ' ')}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Lane and Confidence */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className={isReviewed ? 'text-gray-500' : 'text-gray-400'}>
                              {signal.lane} • {signal.confidence || 'LOW'} confidence
                            </span>
                            {signal.event_type && (
                              <>
                                <span className="text-gray-600">•</span>
                                <span className={isReviewed ? 'text-gray-500' : 'text-gray-400'}>{signal.event_type}</span>
                              </>
                            )}
                          </div>

                          {/* Summary */}
                          {signal.summary_3bullets && (
                            <p className={`text-xs line-clamp-2 mt-2 ${
                              isReviewed ? 'text-gray-500' : 'text-gray-300'
                            }`}>
                              {signal.summary_3bullets}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Metadata for other non-ERCOT signals */}
                          <div className={`flex items-center gap-2 text-xs mb-2 ${
                            isReviewed ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            <span>{getSourceLabel(signal.source_type)}</span>
                            {signal.confidence && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{signal.confidence.toLowerCase()}</span>
                              </>
                            )}
                            {signal.event_type && (
                              <>
                                <span>•</span>
                                <span>{signal.event_type}</span>
                              </>
                            )}
                          </div>

                          {/* Summary */}
                          {signal.summary_3bullets && (
                            <p className={`text-xs line-clamp-2 mt-2 ${
                              isReviewed ? 'text-gray-500' : 'text-gray-300'
                            }`}>
                              {signal.summary_3bullets}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* URL - Enhanced with context */}
                  {signal.url && signal.source_type === 'ERCOT_QUEUE' && (
                    <div className="mt-6 space-y-1">
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs flex items-center gap-1 truncate ${
                          isReviewed
                            ? 'text-gray-500 hover:text-gray-400'
                            : 'text-blue-400 hover:text-blue-300'
                        }`}
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="truncate">View Queue Entry on ERCOT</span>
                      </a>
                      <div className="text-xs text-gray-500 flex items-start gap-1">
                        <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs">
                          Shows interconnection queue details. For monthly GIS reports with trend data, visit{' '}
                          <a 
                            href="https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ERCOT GIS Reports
                          </a>
                          {' '}(interconnection milestones & trends)
                        </span>
                      </div>
                    </div>
                  )}
                  {signal.url && signal.source_type !== 'ERCOT_QUEUE' && (
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs mt-3 flex items-center gap-1 truncate ${
                        isReviewed
                          ? 'text-gray-500 hover:text-gray-400'
                          : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="truncate">View Source</span>
                    </a>
                  )}

                  {/* Tags - Only show non-recurrence, non-friction tags for News */}
                  {signal.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {JSON.parse(signal.tags || '[]')
                        .filter(tag => !tag.startsWith('recurrence:') && !tag.startsWith('friction:'))
                        .slice(0, 3)
                        .map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              isReviewed
                                ? 'bg-gray-700/50 text-gray-500'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#333333] text-xs text-gray-400 text-center">
        {signals.length} signal{signals.length !== 1 ? 's' : ''} shown
      </div>
    </div>
  );
};

export default ScannerSignalsPanel;

