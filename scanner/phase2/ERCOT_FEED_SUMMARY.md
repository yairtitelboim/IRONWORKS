# ERCOT Feed - Separate Pipeline Command

## ✅ Implementation Complete

**Status:** ERCOT is now a **separate feed** in the Scanner CLI, distinct from the main Tavily-based ingestion.

---

## Command

```bash
node scanner/phase1/scanner-cli.js ercot [options]
```

**Description:** Ingest ERCOT interconnection queue data (separate feed)

---

## Key Features

### 1. Separate from Main Pipeline
- **Main Pipeline:** `scanner-cli.js ingest` → Tavily API search
- **ERCOT Feed:** `scanner-cli.js ercot` → ERCOT CSV adapter
- **Distinct:** Different source, different pipeline (Phase 2), same database

### 2. Uses Phase 2 Architecture
- ✅ `SignalIngesterV2` (not Phase 1 ingester)
- ✅ `ERCOTAdapter` (reads from CSV)
- ✅ Source ID-based change detection
- ✅ Multi-source deduplication

### 3. Data Sources
- **Default:** LBL dataset (368 entries, 2023, ≥100 MW)
- **Optional:** GIS reports (89,694 entries, 2018-2025)

---

## Usage

### Basic (LBL Dataset)
```bash
cd scanner/phase1
node scanner-cli.js ercot
```

### GIS Reports (Larger Dataset)
```bash
node scanner-cli.js ercot --gis-reports
```

### Custom Path
```bash
node scanner-cli.js ercot --data-path /path/to/ercot.csv
```

---

## Output Example

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

## Viewing ERCOT Signals

```bash
# List all ERCOT signals
node scanner-cli.js list --source-type ERCOT_QUEUE

# List ERCOT COMMITMENT signals
node scanner-cli.js list --source-type ERCOT_QUEUE --lane COMMITMENT

# Statistics (includes ERCOT breakdown)
node scanner-cli.js stats
```

---

## Architecture

```
ERCOT Feed (Separate)
├── scanner-cli.js ercot
    ├── ERCOTAdapter.fetch() → Reads CSV
    ├── SignalNormalizerV2 → Normalizes to RawSignal
    ├── SignalDeduplicator → Checks for duplicates
    ├── SignalDiffer → Change detection (source_id)
    ├── SignalClassifier → Classification
    └── SignalsDB → Stores in same database

Main Pipeline (Separate)
├── scanner-cli.js ingest
    ├── TavilyClient → API search
    ├── SignalNormalizer → Normalizes
    ├── SignalDiffer → Change detection (url)
    ├── SignalClassifier → Classification
    └── SignalsDB → Stores in same database
```

---

## Differences

| Aspect | Main `ingest` | ERCOT `ercot` |
|--------|---------------|---------------|
| **Source** | Tavily API | ERCOT CSV |
| **Input** | Search query | CSV file |
| **Ingester** | Phase 1 | Phase 2 |
| **Change Detection** | URL-based | Source ID-based |
| **Adapter Pattern** | No | Yes |
| **Deduplication** | Basic | Multi-source |

---

## Integration

Both feeds:
- ✅ Store in same database
- ✅ Use same classification system
- ✅ Support deduplication across sources
- ✅ Can be viewed together with `list` command

**Separation:**
- Different CLI commands
- Different data sources
- Different ingestion pipelines
- Same storage and classification

---

**Status:** ✅ Complete - ERCOT is now a separate feed  
**Command:** `scanner ercot [options]`  
**Documentation:** `scanner/phase2/ERCOT_CLI_COMMAND.md`

