# ERCOT Fresh Download Implementation

## Overview

The ERCOT refresh button now downloads the **latest GIS report directly from the ERCOT website** using Playwright, compares it against the previous version, and highlights new and updated projects in the frontend.

## How It Works

### 1. User Clicks "ERCOT" Refresh Button

When the user clicks the ERCOT refresh button in the UI:
- Frontend sends `POST /api/scanner/ingest/ercot` with `{ useGisReports: true, downloadFresh: true }`
- Shows notification: "Downloading latest ERCOT GIS report..."

### 2. Backend Downloads Fresh Data

The server endpoint (`server.js`):
- Creates an `ERCOTAdapter` with `downloadFresh: true` and `useGisReports: true`
- The adapter uses `ERCOTDownloader` to fetch the latest report

### 3. ERCOT Downloader (`ercot-downloader.js`)

Uses Playwright to:
- Navigate to: `https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er`
- Find the most recent XLSX download link
- Download the XLSX file
- Convert it to CSV format
- Save to: `data/ercot/downloads/ercot_gis_report_[DATE].csv`

### 4. ERCOT Adapter Processes Data

The `ERCOTAdapter`:
- Reads the freshly downloaded CSV (or falls back to existing file if download fails)
- Parses CSV entries
- Normalizes each entry to `RawSignal` format
- Returns array of signals

### 5. Signal Ingester Compares & Stores

The `SignalIngesterV2`:
- Loads previous snapshot from database
- Compares new signals against previous snapshot using `source_id` (queue ID)
- Detects:
  - **New projects**: Not in previous snapshot
  - **Updated projects**: Changed fields (capacity, status, etc.)
  - **Withdrawn projects**: Status changed to "withdrawn"
- Stores new/updated signals in database
- Returns `newIds` and `updatedIds` arrays

### 6. Frontend Highlights Changes

The frontend (`ScannerSignalsPanel.jsx`):
- Receives `deltas.newIds` and `deltas.updatedIds` from API response
- Stores them in state: `ercotNewIds` and `ercotUpdatedIds`
- Displays badges:
  - **"New"** badge (green) for new projects
  - **"Updated"** badge (orange) for updated projects
- Sorts cards: highlighted (new/updated) first, then by capacity
- Refreshes the signal list to show changes

## File Structure

```
scanner/phase2/
├── adapters/
│   ├── ercot-adapter.js          # Main adapter (updated to support downloadFresh)
│   ├── ercot-downloader.js       # NEW: Playwright script to download GIS reports
│   └── base-adapter.js            # Base adapter with retry logic
├── signal-ingester-v2.js          # Ingestion pipeline (already returns newIds/updatedIds)
└── ...

data/ercot/downloads/               # NEW: Directory for downloaded reports
├── ercot_gis_report_[DATE].xlsx
└── ercot_gis_report_[DATE].csv
```

## Dependencies

```json
{
  "playwright": "^latest",      // Browser automation
  "xlsx": "^latest",            // XLSX parsing
  "csv-parse": "^latest"        // CSV parsing (already installed)
}
```

## Configuration

### ERCOT Adapter Options

```javascript
const adapter = new ERCOTAdapter({
  useGisReports: true,        // Use GIS reports (more comprehensive than LBL dataset)
  downloadFresh: true,        // Download fresh data from ERCOT website
  downloadDir: './data/ercot/downloads'  // Optional: custom download directory
});
```

### Server Endpoint

The `/api/scanner/ingest/ercot` endpoint accepts:
- `useGisReports` (boolean): Default `true` - use GIS reports format
- `downloadFresh` (boolean): Default `true` - download fresh data
- `dataPath` (string): Optional - custom path to existing CSV
- `gisReportsPath` (string): Optional - custom path to existing GIS CSV

## Error Handling

- **Download fails**: Falls back to existing CSV file (if available)
- **Parse fails**: Returns error to frontend, shows error notification
- **No links found**: Saves screenshot for debugging, throws error

## Testing

To test the fresh download:

1. **First run** (baseline):
   ```bash
   curl -X POST http://localhost:3001/api/scanner/ingest/ercot \
     -H "Content-Type: application/json" \
     -d '{"useGisReports": true, "downloadFresh": true}'
   ```
   - Should download latest report
   - Should store all projects as "NEW"
   - Should return `newIds` array

2. **Second run** (change detection):
   ```bash
   curl -X POST http://localhost:3001/api/scanner/ingest/ercot \
     -H "Content-Type: application/json" \
     -d '{"useGisReports": true, "downloadFresh": true}'
   ```
   - Should download latest report again
   - Should compare against previous snapshot
   - Should detect new/updated projects
   - Should return `newIds` and `updatedIds` arrays

3. **UI Test**:
   - Click "ERCOT" refresh button
   - Should see "Downloading latest ERCOT GIS report..." notification
   - Should see "ERCOT refreshed: X new projects, Y updated" notification
   - New projects should have green "New" badge
   - Updated projects should have orange "Updated" badge

## Future Improvements

1. **Caching**: Only download if report date is newer than last download
2. **Scheduling**: Add cron job to auto-refresh daily
3. **Incremental Updates**: Only process changed rows instead of full re-ingestion
4. **Better Error Messages**: More specific error handling for different failure modes

