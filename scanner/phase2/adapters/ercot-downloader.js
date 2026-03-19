/**
 * ERCOT GIS Report Downloader
 * 
 * Uses Playwright to download the latest ERCOT GIS report from:
 * https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er
 * 
 * The page contains monthly XLSX files that need to be downloaded.
 * This script finds the most recent file and downloads it.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ERCOTDownloader {
  constructor(config = {}) {
    // Output directory for downloaded files
    this.outputDir = config.outputDir || 
      path.join(__dirname, '../../../data/ercot/downloads');
    
    // ERCOT GIS Reports page URL
    this.gisReportsUrl = 'https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er';
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Download the latest ERCOT GIS report
   * @returns {Promise<{xlsxPath: string, csvPath: string, reportDate: string}>}
   */
  async downloadLatestReport() {
    console.log('🌐 [ERCOT Downloader] Starting browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`📥 [ERCOT Downloader] Navigating to: ${this.gisReportsUrl}`);
      await page.goto(this.gisReportsUrl, { waitUntil: 'networkidle' });
      
      // Wait for the page to load - ERCOT page may take time to render
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Try multiple selectors to find download links
      // ERCOT GIS reports page may have links in different formats
      let downloadLinks = [];
      
      // Try finding links with .xlsx or .xls extension
      try {
        await page.waitForSelector('a[href*=".xlsx"], a[href*=".xls"], a[href*="download"]', { timeout: 10000 });
        
        downloadLinks = await page.$$eval('a', (links) => {
          return links
            .filter(link => {
              const href = link.href || '';
              const text = link.textContent?.toLowerCase() || '';
              return href.includes('.xlsx') || href.includes('.xls') || 
                     (href.includes('download') && (text.includes('gis') || text.includes('report')));
            })
            .map(link => ({
              href: link.href,
              text: link.textContent.trim(),
              parentText: link.closest('tr')?.textContent?.trim() || 
                         link.closest('div')?.textContent?.trim() || ''
            }));
        });
      } catch (error) {
        console.warn(`⚠️ [ERCOT Downloader] Could not find download links with standard selectors, trying alternative approach...`);
        
        // Alternative: look for any links that might be downloads
        downloadLinks = await page.$$eval('a', (links) => {
          return links
            .filter(link => {
              const href = link.href || '';
              return href.includes('ercot.com') && (href.includes('download') || href.includes('file'));
            })
            .map(link => ({
              href: link.href,
              text: link.textContent.trim(),
              parentText: link.closest('tr')?.textContent?.trim() || 
                         link.closest('div')?.textContent?.trim() || ''
            }));
        });
      }

      if (downloadLinks.length === 0) {
        // Take a screenshot for debugging
        const screenshotPath = path.join(this.outputDir, 'ercot_page_debug.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        throw new Error(`No XLSX download links found on the page. Screenshot saved to: ${screenshotPath}`);
      }

      console.log(`📊 [ERCOT Downloader] Found ${downloadLinks.length} potential download links`);

      // Find the most recent link (usually the first one or the one with the latest date)
      // ERCOT typically lists the most recent report first
      // Filter to only XLSX/XLS files
      const xlsxLinks = downloadLinks.filter(link => 
        link.href.includes('.xlsx') || link.href.includes('.xls')
      );
      
      const latestLink = xlsxLinks.length > 0 ? xlsxLinks[0] : downloadLinks[0];
      
      console.log(`📥 [ERCOT Downloader] Downloading: ${latestLink.text}`);
      console.log(`   URL: ${latestLink.href}`);

      // Extract report date from link text or parent text
      const reportDate = this.extractReportDate(latestLink.text || latestLink.parentText);
      
      // Download the file
      const response = await page.goto(latestLink.href);
      if (!response || !response.ok()) {
        throw new Error(`Failed to download file: ${response?.status() || 'unknown error'}`);
      }

      const buffer = await response.body();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const xlsxFilename = `ercot_gis_report_${reportDate || timestamp}.xlsx`;
      const xlsxPath = path.join(this.outputDir, xlsxFilename);

      // Save XLSX file
      fs.writeFileSync(xlsxPath, buffer);
      console.log(`✅ [ERCOT Downloader] Saved XLSX to: ${xlsxPath}`);

      // Convert XLSX to CSV
      const csvPath = await this.convertXlsxToCsv(xlsxPath, reportDate || timestamp);
      
      await browser.close();
      
      return {
        xlsxPath,
        csvPath,
        reportDate: reportDate || timestamp
      };
    } catch (error) {
      await browser.close();
      console.error(`❌ [ERCOT Downloader] Error:`, error.message);
      throw error;
    }
  }

  /**
   * Extract report date from text (e.g., "December 2024", "12/2024", etc.)
   * @param {string} text - Text containing date information
   * @returns {string|null} - Extracted date string or null
   */
  extractReportDate(text) {
    if (!text) return null;
    
    // Try to find date patterns
    const patterns = [
      /(\w+\s+\d{4})/i,  // "December 2024"
      /(\d{1,2}\/\d{4})/,  // "12/2024"
      /(\d{4}-\d{2})/,  // "2024-12"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].replace(/\s+/g, '_').replace(/\//g, '-');
      }
    }
    
    return null;
  }

  /**
   * Convert XLSX file to CSV
   * @param {string} xlsxPath - Path to XLSX file
   * @param {string} reportDate - Report date string for filename
   * @returns {Promise<string>} - Path to generated CSV file
   */
  async convertXlsxToCsv(xlsxPath, reportDate) {
    console.log(`🔄 [ERCOT Downloader] Converting XLSX to CSV...`);
    
    try {
      // Read XLSX file
      const workbook = XLSX.readFile(xlsxPath);
      
      // Get the first sheet (ERCOT GIS reports typically have one main sheet)
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to CSV
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      
      // Save CSV
      const csvFilename = `ercot_gis_report_${reportDate}.csv`;
      const csvPath = path.join(this.outputDir, csvFilename);
      fs.writeFileSync(csvPath, csvContent, 'utf-8');
      
      console.log(`✅ [ERCOT Downloader] Saved CSV to: ${csvPath}`);
      
      return csvPath;
    } catch (error) {
      console.error(`❌ [ERCOT Downloader] Failed to convert XLSX:`, error.message);
      throw error;
    }
  }

  /**
   * Get the path to the most recently downloaded CSV
   * @returns {string|null} - Path to latest CSV or null if none found
   */
  getLatestCsvPath() {
    if (!fs.existsSync(this.outputDir)) {
      return null;
    }

    const files = fs.readdirSync(this.outputDir)
      .filter(f => f.endsWith('.csv'))
      .map(f => ({
        name: f,
        path: path.join(this.outputDir, f),
        stat: fs.statSync(path.join(this.outputDir, f))
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    return files.length > 0 ? files[0].path : null;
  }
}

export default ERCOTDownloader;

