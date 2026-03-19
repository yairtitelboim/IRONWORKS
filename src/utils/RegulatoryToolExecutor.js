/**
 * RegulatoryToolExecutor - Regulatory analysis specific tool executor
 * Part of Phase 3: Generic ToolExecutor implementation
 * Extends generic ToolExecutor with regulatory analysis specific functionality
 */

import { ToolExecutor } from './ToolExecutor.js';
import { RegulatoryStrategy } from './strategies/RegulatoryStrategy.js';

export class RegulatoryToolExecutor extends ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    // Call parent constructor
    super(map, updateToolFeedback, handleMarkerClick);
    
    // Set regulatory analysis specific strategy
    this.setStrategy(new RegulatoryStrategy());
  }

  // All generic tool execution methods are inherited from ToolExecutor
  // Only regulatory-specific methods would be added here if needed

  /**
   * Update marker styling for regulatory analysis
   * Regulatory-specific marker styling for zoning and regulatory features
   */
  updateRegulatoryMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Update the paint properties to highlight regulatory markers
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], '#ef4444', // Red for selected marker
      ['==', ['get', 'category'], 'zoning'], '#10b981', // Green for zoning
      ['==', ['get', 'category'], 'permits'], '#f59e0b', // Orange for permits
      ['==', ['get', 'category'], 'regulatory'], '#8b5cf6', // Purple for regulatory
      ['==', ['get', 'category'], 'environmental'], '#06b6d4', // Cyan for environmental
      '#6b7280'
    ]);

    // Make selected marker larger
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 12, // Larger for selected marker
      ['==', ['get', 'category'], 'zoning'], 8,
      ['==', ['get', 'category'], 'permits'], 7,
      ['==', ['get', 'category'], 'regulatory'], 6,
      ['==', ['get', 'category'], 'environmental'], 7,
      5
    ]);

    // Make selected marker more opaque
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 1.0, // Full opacity for selected
      0.8
    ]);

    console.log(`🎯 Regulatory marker styling updated - selected marker: ${this.selectedMarkerId}`);
  }

  /**
   * Reset regulatory marker styling to default state
   */
  resetRegulatoryMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Reset to regulatory-specific styling
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'category'], 'zoning'], '#10b981',
      ['==', ['get', 'category'], 'permits'], '#f59e0b',
      ['==', ['get', 'category'], 'regulatory'], '#8b5cf6',
      ['==', ['get', 'category'], 'environmental'], '#06b6d4',
      '#6b7280'
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'category'], 'zoning'], 8,
      ['==', ['get', 'category'], 'permits'], 7,
      ['==', ['get', 'category'], 'regulatory'], 6,
      ['==', ['get', 'category'], 'environmental'], 7,
      5
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', 0.8);

    // Clear selected marker ID
    this.selectedMarkerId = null;
  }
}

/**
 * Factory function to create RegulatoryToolExecutor instance
 */
export const createRegulatoryToolExecutor = (map, updateToolFeedback, handleMarkerClick = null) => {
  return new RegulatoryToolExecutor(map, updateToolFeedback, handleMarkerClick);
};
