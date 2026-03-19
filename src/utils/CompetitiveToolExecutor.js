/**
 * CompetitiveToolExecutor - Competitive analysis specific tool executor
 * Part of Phase 3: Generic ToolExecutor implementation
 * Extends generic ToolExecutor with competitive analysis specific functionality
 */

import { ToolExecutor } from './ToolExecutor.js';
import { CompetitiveStrategy } from './strategies/CompetitiveStrategy.js';

export class CompetitiveToolExecutor extends ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    // Call parent constructor
    super(map, updateToolFeedback, handleMarkerClick);
    
    // Set competitive analysis specific strategy
    this.setStrategy(new CompetitiveStrategy());
  }

  // All generic tool execution methods are inherited from ToolExecutor
  // Only competitive-specific methods would be added here if needed

  /**
   * Update marker styling for competitive analysis
   * Competitive-specific marker styling for data centers and competitors
   */
  updateCompetitiveMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Update the paint properties to highlight competitive markers
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], '#ef4444', // Red for selected marker
      ['==', ['get', 'category'], 'data centers'], '#3b82f6', // Blue for data centers
      ['==', ['get', 'category'], 'colocation'], '#8b5cf6', // Purple for colocation
      ['==', ['get', 'category'], 'competitors'], '#f59e0b', // Orange for competitors
      '#6b7280'
    ]);

    // Make selected marker larger
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 12, // Larger for selected marker
      ['==', ['get', 'category'], 'data centers'], 10,
      ['==', ['get', 'category'], 'colocation'], 8,
      ['==', ['get', 'category'], 'competitors'], 9,
      5
    ]);

    // Make selected marker more opaque
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 1.0, // Full opacity for selected
      0.8
    ]);

    console.log(`🎯 Competitive marker styling updated - selected marker: ${this.selectedMarkerId}`);
  }

  /**
   * Reset competitive marker styling to default state
   */
  resetCompetitiveMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Reset to competitive-specific styling
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'category'], 'data centers'], '#3b82f6',
      ['==', ['get', 'category'], 'colocation'], '#8b5cf6',
      ['==', ['get', 'category'], 'competitors'], '#f59e0b',
      '#6b7280'
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'category'], 'data centers'], 10,
      ['==', ['get', 'category'], 'colocation'], 8,
      ['==', ['get', 'category'], 'competitors'], 9,
      5
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', 0.8);

    // Clear selected marker ID
    this.selectedMarkerId = null;
  }
}

/**
 * Factory function to create CompetitiveToolExecutor instance
 */
export const createCompetitiveToolExecutor = (map, updateToolFeedback, handleMarkerClick = null) => {
  return new CompetitiveToolExecutor(map, updateToolFeedback, handleMarkerClick);
};
