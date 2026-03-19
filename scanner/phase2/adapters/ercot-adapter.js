/**
 * ERCOT Interconnection Queue Adapter
 * 
 * Reads from existing consolidated ERCOT CSV data
 * Supports both LBL dataset and GIS reports format
 * 
 * Data Sources:
 * - LBL dataset: processed/ercot_2023_100mw_filtered.csv
 * - GIS reports: gis_reports/consolidated/ercot_gis_reports_consolidated_latest.csv
 */

import BaseAdapter from './base-adapter.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';
import ERCOTDownloader from './ercot-downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ERCOTAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceType: 'ERCOT_QUEUE',
      maxRetries: 3,
      retryDelay: 2000,
      ...config
    });
    
    // Path to existing ERCOT data
    // Default: LBL dataset (cleaner structure)
    this.dataPath = config.dataPath || 
      '/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/processed/ercot_2023_100mw_filtered.csv';
    
    // Alternative: GIS reports (larger dataset)
    this.gisReportsPath = config.gisReportsPath ||
      '/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_20251212_123725.csv';
    
    this.useGisReports = config.useGisReports || false;
    
    // Option to download fresh data before reading
    this.downloadFresh = config.downloadFresh || false;
    
    // Initialize downloader if needed
    if (this.downloadFresh) {
      this.downloader = new ERCOTDownloader({
        outputDir: config.downloadDir || path.join(__dirname, '../../../data/ercot/downloads')
      });
    }
  }

  /**
   * Fetch ERCOT queue entries from CSV
   * Optionally downloads fresh data from ERCOT website first
   * @returns {Promise<Array>} Array of RawSignal objects
   */
  async fetch() {
    let csvPath = this.useGisReports ? this.gisReportsPath : this.dataPath;
    
    // Initialize download status
    this.downloadStatus = {
      attempted: false,
      success: false,
      usedFallback: false,
      error: null
    };
    
    // If downloadFresh is enabled, download the latest GIS report first
    if (this.downloadFresh && this.useGisReports) {
      this.downloadStatus.attempted = true;
      try {
        console.log(`🌐 [ERCOT] Downloading fresh GIS report from ERCOT website...`);
        const downloadResult = await this.downloader.downloadLatestReport();
        csvPath = downloadResult.csvPath;
        this.downloadStatus.success = true;
        this.downloadStatus.usedFallback = false;
        console.log(`✅ [ERCOT] Using freshly downloaded report: ${csvPath}`);
      } catch (error) {
        console.warn(`⚠️ [ERCOT] Failed to download fresh data, falling back to existing file:`, error.message);
        this.downloadStatus.success = false;
        this.downloadStatus.error = error.message;
        // Fall back to existing file if download fails
        if (!fs.existsSync(csvPath)) {
          throw new Error(`ERCOT data file not found and download failed: ${csvPath}`);
        }
        this.downloadStatus.usedFallback = true;
      }
    }
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`ERCOT data file not found: ${csvPath}`);
    }

    console.log(`📂 [ERCOT] Reading from: ${csvPath}`);
    
    try {
      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      
      // Parse CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      console.log(`📊 [ERCOT] Parsed ${records.length} entries from CSV`);

      // Normalize each record to RawSignal format
      const rawSignals = records.map(record => this.normalize(record));

      // Return signals array (downloadStatus is stored as instance property)
      return rawSignals;
    } catch (error) {
      console.error(`❌ [ERCOT] Failed to parse CSV:`, error.message);
      throw error;
    }
  }

  /**
   * Get download status (called after fetch)
   * @returns {Object} Download status object
   */
  getDownloadStatus() {
    return this.downloadStatus || {
      attempted: false,
      success: false,
      usedFallback: false,
      error: null
    };
  }

  /**
   * Normalize ERCOT entry to RawSignal format
   * Handles both LBL dataset and GIS reports formats
   * @param {Object} ercotEntry - Raw ERCOT queue entry (CSV row)
   * @returns {Object} RawSignal object
   */
  normalize(ercotEntry) {
    // Detect format based on available fields
    const isLblFormat = 'q_id' in ercotEntry;
    const isGisFormat = 'INR' in ercotEntry;

    let queueId, projectName, status, capacity, fuelType, county, poiLocation, developer, proposedDate;

    if (isLblFormat) {
      // LBL dataset format
      queueId = ercotEntry.q_id;
      projectName = ercotEntry.project_name;
      status = ercotEntry.q_status; // active, withdrawn, suspended
      capacity = ercotEntry.mw1;
      fuelType = ercotEntry.type_clean; // Solar, Wind, Battery, Gas
      county = ercotEntry.county;
      poiLocation = ercotEntry.poi_name;
      developer = ercotEntry.developer;
      proposedDate = ercotEntry.prop_date ? this.excelDateToISO(ercotEntry.prop_date) : null;
    } else if (isGisFormat) {
      // GIS reports format
      queueId = ercotEntry.INR;
      projectName = ercotEntry['Project Name'];
      status = ercotEntry['GIM Study Phase'] || 'Unknown';
      capacity = ercotEntry['Capacity (MW)'];
      fuelType = ercotEntry.Fuel;
      county = ercotEntry.County;
      poiLocation = ercotEntry['POI Location'];
      developer = ercotEntry['Interconnecting Entity'];
      proposedDate = ercotEntry['Projected COD'] || null;
    } else {
      // Fallback: try common field names
      queueId = ercotEntry.queue_id || ercotEntry.q_id || ercotEntry.INR || ercotEntry.id;
      projectName = ercotEntry.project_name || ercotEntry['Project Name'] || 'Unknown Project';
      status = ercotEntry.status || ercotEntry.q_status || ercotEntry['GIM Study Phase'] || 'Unknown';
      capacity = ercotEntry.mw || ercotEntry.mw1 || ercotEntry['Capacity (MW)'] || null;
      fuelType = ercotEntry.fuel_type || ercotEntry.type_clean || ercotEntry.Fuel || null;
      county = ercotEntry.county || ercotEntry.County || null;
      poiLocation = ercotEntry.poi_name || ercotEntry['POI Location'] || ercotEntry.interconnection_point || null;
      developer = ercotEntry.developer || ercotEntry['Interconnecting Entity'] || null;
      proposedDate = ercotEntry.prop_date ? this.excelDateToISO(ercotEntry.prop_date) : ercotEntry['Projected COD'] || null;
    }

    // Build headline
    const capacityStr = capacity ? `${capacity}MW` : 'Capacity Unknown';
    const fuelStr = fuelType ? fuelType : '';
    const headline = `${projectName} - ${capacityStr} ${fuelStr}`.trim();

    // Build body text
    const bodyParts = [];
    if (developer) bodyParts.push(`Developer: ${developer}`);
    if (county) bodyParts.push(`County: ${county}`);
    if (status) bodyParts.push(`Status: ${status}`);
    if (fuelType) bodyParts.push(`Fuel Type: ${fuelType}`);
    if (poiLocation) bodyParts.push(`POI: ${poiLocation}`);

    // Build URL - try queue-specific page, fallback to GIS report page
    // Note: Individual queue entry pages may not exist, but this follows the plan
    const queueUrl = queueId 
      ? `https://www.ercot.com/gridinfo/queue/${queueId}`
      : `https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er`;

    return {
      source_type: 'ERCOT_QUEUE',
      source_id: queueId,
      published_at: proposedDate || new Date().toISOString(),
      url: queueUrl,
      headline: headline,
      body_text: bodyParts.join('\n'),
      metadata: {
        queue_id: queueId,
        mw: capacity ? parseFloat(capacity) : null,
        fuel_type: fuelType,
        county: county,
        company: developer,
        project_name: projectName,
        status: status,
        poi_location: poiLocation,
        state: 'TX',
        jurisdiction: 'Texas',
        proposed_date: proposedDate
      }
    };
  }

  /**
   * Convert Excel date number to ISO date string
   * Excel dates are days since 1900-01-01
   * @param {string|number} excelDate - Excel date number
   * @returns {string|null} ISO date string or null
   */
  excelDateToISO(excelDate) {
    if (!excelDate) return null;
    
    try {
      const dateNum = typeof excelDate === 'string' ? parseFloat(excelDate) : excelDate;
      if (isNaN(dateNum)) return null;
      
      // Excel epoch: January 1, 1900
      const excelEpoch = new Date(1900, 0, 1);
      // Excel incorrectly treats 1900 as a leap year, so subtract 1 day
      const daysSinceEpoch = dateNum - 2;
      const date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
      
      return date.toISOString();
    } catch (error) {
      console.warn(`⚠️ [ERCOT] Failed to parse Excel date: ${excelDate}`, error.message);
      return null;
    }
  }
}

export default ERCOTAdapter;

