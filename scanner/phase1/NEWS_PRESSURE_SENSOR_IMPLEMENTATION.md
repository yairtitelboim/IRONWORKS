# News Pressure Sensor Implementation

## Philosophy

**ERCOT** = State machine (tracks what changed)  
**News** = Pressure sensor (detects friction and repetition)

News should **never** feel like ERCOT. The goal is not actionability or precision — it's **early detection of friction and repetition**.

---

## Implementation

### 1. Anchor Extraction ✅

Extracts key anchors from news articles:
- **Who**: Developer/company name
- **Where**: County/city
- **Asset**: Project name or asset type
- **Friction Type**: Type of friction (moratorium, lawsuit, zoning, etc.)

**Location**: `scanner/phase1/signal-normalizer.js` → `extractAnchors()`

**How it works:**
- Uses regex patterns to extract company names, locations, asset types
- Detects friction types (moratorium, lawsuit, zoning, opposition, environmental, permit_denial)
- Stores anchors in existing database fields:
  - `company_entities` → who
  - `county`/`city` → where
  - `asset_type_guess` → asset
  - `tags` → friction type

---

### 2. Recurrence Detection ✅

Detects when same anchors appear in previous signals.

**Location**: `scanner/phase1/signal-ingester.js` → `detectRecurrence()`

**How it works:**
- After classification, checks if same anchors (who/where/asset) appear in previous News signals
- Uses OR logic: matches if **any** anchor matches (pressure builds from any anchor)
- Adds `recurrence:X` tag where X is the count of previous signals
- Higher recurrence = more pressure building

**Query Logic:**
```sql
SELECT COUNT(*) 
FROM signals
WHERE source_type = 'TAVILY'
  AND signal_id != ?
  AND (company_entities = ? OR county = ? OR asset_type_guess = ?)
```

---

### 3. Confidence + Lane Labeling ✅

Improved classification for News signals.

**Location**: `scanner/phase1/signal-classifier.js`

**Improvements:**
- Extracts friction types and adds to tags (`friction:moratorium`, `friction:lawsuit`, etc.)
- Better confidence scoring based on friction type detection
- Lane classification (CONSTRAINT, COMMITMENT, CONTEXT) based on friction patterns

**Friction Types Detected:**
- `moratorium`: Ban, prohibition, halt
- `lawsuit`: Legal challenge, court filing
- `zoning`: Zoning change, denial, rezoning
- `opposition`: Community pushback, protests
- `environmental`: EPA, emissions, pollution concerns
- `permit_denial`: Permit rejection, appeal

---

### 4. UI Display ✅

**Location**: `src/components/Map/components/ScannerSignalsPanel.jsx`

**What's shown for News signals:**

1. **Anchors** (Who, Where, Asset):
   - "Who: Company Name"
   - "Where: City, County"
   - "Asset: Asset Type"

2. **Recurrence Indicator**:
   - Badge showing "🔁 Recurrence: X previous signals"
   - Color coding:
     - Orange (≥3): High pressure
     - Yellow (≥1): Building pressure
     - Gray (0): No recurrence yet

3. **Friction Type Badges**:
   - Red badges for each friction type detected
   - Examples: "moratorium", "lawsuit", "zoning"

4. **Lane + Confidence**:
   - Shows lane (CONSTRAINT/COMMITMENT/CONTEXT) and confidence level
   - Event type if available

5. **Summary**:
   - 3-bullet summary from article content

**What's NOT shown** (intentionally different from ERCOT):
- ❌ No "New"/"Updated" badges (those are for state machines)
- ❌ No structured project details (capacity, status, etc.)
- ❌ No links to ERCOT projects
- ❌ No power scale visualizations

---

## Key Differences from ERCOT

| Feature | ERCOT (State Machine) | News (Pressure Sensor) |
|---------|----------------------|------------------------|
| **Indicators** | "New"/"Updated" badges | "Recurrence: X" badge |
| **Information** | Structured (capacity, status, developer) | Anchors (who, where, asset, friction) |
| **Goal** | Track what changed | Detect pressure building |
| **Sorting** | By capacity (largest first) | By recurrence (highest first) |
| **Context** | Developer projects, power scale | Friction types, recurrence count |
| **Actionability** | High (structured data) | Low (early warning system) |

---

## User Workflow

### For News Signals:

1. **Scan for recurrence**: Look for orange/yellow recurrence badges
2. **Check friction types**: See what kind of pressure is building
3. **Review anchors**: Who, where, asset - understand the pressure point
4. **Quick dismiss**: Mark as reviewed if not relevant
5. **Track patterns**: Same developer/county appearing multiple times = pressure building

### For ERCOT Signals:

1. **Check what changed**: Look for "New"/"Updated" badges
2. **Review details**: Capacity, developer, location, status
3. **Understand scale**: Power scale visualization
4. **Track projects**: Developer's other projects
5. **Take action**: Based on structured data

---

## Database Schema

Anchors are stored in existing fields:
- `company_entities` → who
- `county`/`city` → where  
- `asset_type_guess` → asset
- `tags` → friction types + recurrence count

**Example tag array:**
```json
[
  "friction:lawsuit",
  "friction:zoning",
  "recurrence:3",
  "constraint"
]
```

---

## Testing

To test anchor extraction and recurrence:

1. **Run News ingestion**:
   ```bash
   node scanner/phase1/scanner-cli.js ingest "data center moratorium Texas"
   ```

2. **Check extracted anchors**:
   - Look for `company_entities`, `county`, `asset_type_guess` in database
   - Check `tags` for friction types

3. **Test recurrence**:
   - Run ingestion again with similar articles
   - Should see `recurrence:X` tags appear
   - UI should show recurrence badges

---

## Future Enhancements (Not Now)

These are explicitly **NOT** implemented per requirements:
- ❌ ERCOT-style status semantics
- ❌ Over-cleaned News cards
- ❌ Linking to structured projects
- ❌ "New"/"Updated" badges (those are for state machines)

---

## Summary

News is now a **pressure sensor** that:
- ✅ Extracts anchors (who, where, asset, friction)
- ✅ Detects recurrence (same anchors appearing again)
- ✅ Shows friction types (what kind of pressure)
- ✅ Makes signals easy to dismiss quickly
- ✅ Focuses on early detection, not precision

**It feels different from ERCOT** - as it should.

