# ERCOT CLI Command - Separate Feed

## Overview

ERCOT interconnection queue data is now available as a **separate feed** in the Scanner CLI, distinct from the main Tavily-based ingestion pipeline.

---

## Command

```bash
node scanner/phase1/scanner-cli.js ercot [options]
```

**Description:** Ingest ERCOT interconnection queue data (separate feed)

---

## Options

### `--data-path <path>`
- **Description:** Path to ERCOT CSV file (default: LBL dataset)
- **Default:** `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/processed/ercot_2023_100mw_filtered.csv`
- **Example:**
  ```bash
  node scanner/phase1/scanner-cli.js ercot --data-path /path/to/custom/ercot.csv
  ```

### `--gis-reports`
- **Description:** Use GIS reports dataset instead of LBL dataset
- **Default:** false (uses LBL dataset)
- **Example:**
  ```bash
  node scanner/phase1/scanner-cli.js ercot --gis-reports
  ```

### `--gis-path <path>`
- **Description:** Path to GIS reports CSV file
- **Default:** `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_20251212_123725.csv`
- **Example:**
  ```bash
  node scanner/phase1/scanner-cli.js ercot --gis-reports --gis-path /path/to/gis_reports.csv
  ```

---

## Usage Examples

### Basic Usage (LBL Dataset - 368 entries)
```bash
cd scanner/phase1
node scanner-cli.js ercot
```

### Use GIS Reports (89,694 entries)
```bash
node scanner-cli.js ercot --gis-reports
```

### Custom CSV Path
```bash
node scanner-cli.js ercot --data-path /path/to/your/ercot_data.csv
```

---

## Output

The command will:
1. ✅ Read ERCOT CSV data
2. ✅ Normalize to RawSignal format
3. ✅ Check for duplicates across sources
4. ✅ Detect changes (new/changed/withdrawn)
5. ✅ Classify signals
6. ✅ Store in database

**Example Output:**
```
🔌 [ERCOT Feed] Starting ERCOT queue ingestion...

📥 [IngesterV2] Starting ingestion from ERCOT...
📂 [ERCOT] Reading from: /path/to/ercot_2023_100mw_filtered.csv
📊 [ERCOT] Parsed 368 entries from CSV

📊 ERCOT Ingestion Summary:
   Source: ERCOT
   Found: 368 signals
   New: 368
   Changed: 0
   Withdrawn: 0
   Deduplicated: 0
   Stored: 368
```

---

## Differences from Main `ingest` Command

| Feature | `ingest` Command | `ercot` Command |
|---------|-----------------|-----------------|
| **Source** | Tavily API (search) | ERCOT CSV files |
| **Input** | Search query | CSV file path |
| **Pipeline** | Phase 1 (Tavily) | Phase 2 (Adapter) |
| **Ingester** | `SignalIngester` | `SignalIngesterV2` |
| **Change Detection** | URL-based | Source ID-based |
| **Purpose** | General signal discovery | ERCOT queue monitoring |

---

## Viewing ERCOT Signals

After ingestion, view ERCOT signals:

```bash
# List ERCOT signals
node scanner-cli.js list --source-type ERCOT_QUEUE

# List only COMMITMENT signals from ERCOT
node scanner-cli.js list --source-type ERCOT_QUEUE --lane COMMITMENT

# Review new ERCOT signals
node scanner-cli.js review --lane COMMITMENT
```

---

## Statistics

View ERCOT-specific statistics:

```bash
node scanner-cli.js stats
```

This will show breakdown by source type, including ERCOT_QUEUE.

---

## Integration with Main Pipeline

The ERCOT feed is **separate** from the main ingestion pipeline:

- **Main Pipeline:** `scanner-cli.js ingest` → Uses Tavily API
- **ERCOT Feed:** `scanner-cli.js ercot` → Uses ERCOT CSV adapter

Both feeds:
- ✅ Use the same database
- ✅ Use the same classification system
- ✅ Use the same change detection (with different comparison keys)
- ✅ Support deduplication across sources

---

## Scheduling

### Manual Run
```bash
node scanner-cli.js ercot
```

### Daily Cron Job (Future)
```bash
# Add to crontab
0 6 * * * cd /path/to/scanner/phase1 && node scanner-cli.js ercot
```

---

## Troubleshooting

### Error: "ERCOT data file not found"
- **Solution:** Check that the CSV file path exists
- **Fix:** Use `--data-path` to specify correct path

### Error: "Failed to parse CSV"
- **Solution:** Verify CSV format matches expected structure
- **Check:** Ensure CSV has required columns (q_id, project_name, etc.)

### No signals found
- **Solution:** Check CSV file has data
- **Verify:** Open CSV and check row count

---

## Next Steps

1. **Test the command:**
   ```bash
   node scanner-cli.js ercot
   ```

2. **View results:**
   ```bash
   node scanner-cli.js list --source-type ERCOT_QUEUE
   ```

3. **Check statistics:**
   ```bash
   node scanner-cli.js stats
   ```

---

**Status:** ✅ ERCOT command added as separate feed  
**Location:** `scanner/phase1/scanner-cli.js`  
**Command:** `scanner ercot [options]`

