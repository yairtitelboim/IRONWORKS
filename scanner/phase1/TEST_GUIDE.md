# Scanner Phase 1 - Test Guide

## Quick Test (3 Steps)

### Step 1: Navigate to Phase 1 Directory
```bash
cd scanner/phase1
```

### Step 2: Set Environment Variables
```bash
export TAVILY_API_KEY=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
export PRP=YOUR_PERPLEXITY_API_KEY
```

Or add to your `.env` file in the project root:
```bash
TAVILY_API_KEY=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
PRP=YOUR_PERPLEXITY_API_KEY
```

### Step 3: Run Test Commands

#### Test 1: Ingest Signals
```bash
node scanner-cli.js ingest --query "data center moratorium Texas"
```

**Expected output:**
- ✅ Searches Tavily (API call)
- ✅ Finds 10 signals
- ✅ Classifies them (regex + Perplexity if needed)
- ✅ Stores in database
- ✅ Shows summary with counts

#### Test 2: List Signals
```bash
node scanner-cli.js list --lane CONSTRAINT
```

**Expected output:**
- Shows all CONSTRAINT signals
- Displays headline, URL, tags, status

#### Test 3: Review New Signals
```bash
node scanner-cli.js review --lane CONSTRAINT
```

**Expected output:**
- Shows new CONSTRAINT signals with details
- Event type, confidence, tags, summary

#### Test 4: View Statistics
```bash
node scanner-cli.js stats
```

**Expected output:**
- Total signals count
- Breakdown by lane, status, source

#### Test 5: Test Change Detection
```bash
# Run same query twice - second time should show "New: 0"
node scanner-cli.js ingest --query "data center moratorium Texas"
node scanner-cli.js ingest --query "data center moratorium Texas"
```

**Expected output:**
- First run: "New: 10"
- Second run: "New: 0" (change detection working!)

---

## All-in-One Test Script

Create a test script:

```bash
#!/bin/bash
cd scanner/phase1

export TAVILY_API_KEY=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
export PRP=YOUR_PERPLEXITY_API_KEY

echo "🧪 Testing Scanner Phase 1..."
echo ""

echo "1️⃣ Ingesting signals..."
node scanner-cli.js ingest --query "data center moratorium Texas"
echo ""

echo "2️⃣ Listing CONSTRAINT signals..."
node scanner-cli.js list --lane CONSTRAINT --limit 5
echo ""

echo "3️⃣ Viewing statistics..."
node scanner-cli.js stats
echo ""

echo "✅ Test complete!"
```

Save as `test-scanner.sh` and run:
```bash
chmod +x test-scanner.sh
./test-scanner.sh
```

---

## What to Look For

### ✅ Success Indicators:
- Tavily finds 10 signals
- Signals classified (CONSTRAINT/COMMITMENT/CONTEXT)
- Tags populated (e.g., ["moratorium"])
- Database file created: `scanner/scanner.db`
- Change detection works (second run shows "New: 0")

### ❌ Common Issues:
- **"TAVILY_API_KEY not found"** → Set environment variable
- **"PRP not found"** → Set PRP environment variable
- **"Cannot find module"** → Run `npm install` in `scanner/phase1`
- **Database errors** → Check file permissions

---

## Example Output

```
📥 [Ingester] Starting ingestion: "data center moratorium Texas"

1️⃣ [Ingester] Searching Tavily...
🔍 [Tavily] Searching: "data center moratorium Texas"
✅ [Tavily] Found 10 results

2️⃣ [Ingester] Loading previous snapshot...

3️⃣ [Ingester] Normalizing 10 results...

4️⃣ [Ingester] Detecting changes...
   📊 New: 10, Changed: 0, Withdrawn: 0

5️⃣ [Ingester] Classifying signals...
✅ [Classifier] Constraint rule matched: moratorium (HIGH)
✅ [Classifier] Constraint rule matched: moratorium (HIGH)
...

✅ [Ingester] Ingestion complete!
   📊 Found: 10
   🆕 New: 10
   🔄 Changed: 0
   🧠 LLM calls: 1/10
```

---

## Next Steps After Testing

1. Try different queries:
   - `"zoning denial data center Texas"`
   - `"battery storage lawsuit Texas"`
   - `"substation opposition Texas"`

2. Test templates:
   ```bash
   node scanner-cli.js ingest --template constraint
   ```

3. Review signals:
   ```bash
   node scanner-cli.js review --lane CONSTRAINT
   ```

4. Check database:
   ```bash
   sqlite3 scanner/scanner.db "SELECT COUNT(*) FROM signals;"
   ```

