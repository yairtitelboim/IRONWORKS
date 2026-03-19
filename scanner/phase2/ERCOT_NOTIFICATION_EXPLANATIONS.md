# ERCOT Notification Messages Explained

## Understanding the Different Notification Types

### ✅ Success Notifications (Green)

**"Fresh ERCOT data downloaded: X new projects, Y updated"**
- **What happened**: Successfully downloaded the latest GIS report from ERCOT website
- **Changes detected**: New projects were added or existing projects were updated
- **Action**: New/updated projects are highlighted with badges

**"Fresh ERCOT data downloaded - No changes detected (already up to date)"**
- **What happened**: Successfully downloaded the latest GIS report from ERCOT website
- **Changes detected**: None - the downloaded data matches what's already in the database
- **Why**: ERCOT hasn't published new data since the last successful download

---

### ⚠️ Warning Notifications (Orange)

**"Download failed - Using existing CSV: X new projects, Y updated"**
- **What happened**: Attempted to download fresh data but it failed, so the system used an existing CSV file
- **Why download failed**: Check the error message in the notification details (click "Show details")
- **Changes detected**: Despite using old CSV, changes were found compared to the database snapshot
- **Possible reasons**: 
  - The existing CSV was updated manually
  - The database snapshot is older than the CSV file
  - Network/timeout issues prevented download

**"Download failed - Using existing CSV - No changes detected"**
- **What happened**: Attempted to download fresh data but it failed, so the system used an existing CSV file
- **Why download failed**: Check the error message in the notification details (click "Show details")
- **Changes detected**: None - the existing CSV matches the database snapshot
- **Why no changes**: 
  - The CSV file hasn't been updated since last run
  - No new projects were added
  - No existing projects were modified
- **Common download failure reasons**:
  - ERCOT website is down or slow
  - Network connectivity issues
  - Playwright couldn't find download links (page structure changed)
  - Timeout waiting for page to load
  - Browser automation failed

---

### 📂 Info Notifications (Blue)

**"Using existing CSV: X new projects, Y updated"**
- **What happened**: No download was attempted (downloadFresh was false or disabled)
- **Changes detected**: Changes found in the existing CSV compared to database
- **Why**: Using pre-existing CSV file instead of downloading fresh data

**"Using existing CSV - No changes detected"**
- **What happened**: No download was attempted (downloadFresh was false or disabled)
- **Changes detected**: None - CSV matches database snapshot
- **Why**: The CSV file hasn't changed since last ingestion

---

### ❌ Error Notifications (Red)

**"Download failed: [error message]"**
- **What happened**: Download failed completely and no fallback CSV was available
- **Why**: Either the download failed AND the fallback CSV file doesn't exist
- **Action needed**: Check server logs for full error details, verify CSV file path exists

---

## How to Debug Download Failures

1. **Click "Show details"** in the notification to see:
   - Full error message
   - Explanation of why no changes were detected

2. **Check browser console** (F12) for:
   - Download status logs
   - Change detection logs
   - Full API response

3. **Check server logs** for:
   - Playwright browser errors
   - Page navigation issues
   - File download errors
   - CSV parsing errors

4. **Common issues**:
   - **"No XLSX download links found"**: ERCOT page structure may have changed
   - **"Timeout"**: ERCOT website is slow or unresponsive
   - **"Network error"**: Internet connectivity issue
   - **"Browser launch failed"**: Playwright Chromium not installed properly

---

## Understanding "No Changes Detected"

"No changes detected" means the **comparison between the CSV file and the database snapshot found no differences**. This can happen when:

1. **Fresh download succeeded but no changes**:
   - ERCOT hasn't published new data since last successful download
   - All projects in the new report match the previous snapshot

2. **Using existing CSV and no changes**:
   - The CSV file hasn't been updated since last ingestion
   - The CSV matches what's already stored in the database

3. **Download failed, using fallback CSV, no changes**:
   - The fallback CSV is the same as what was used in the previous successful ingestion
   - No new data has been added to the CSV file

---

## Next Steps When Download Fails

1. **Check if ERCOT website is accessible**: Visit https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er
2. **Verify Playwright is installed**: Run `npx playwright install chromium`
3. **Check file permissions**: Ensure the download directory is writable
4. **Review error details**: Click "Show details" in the notification
5. **Manual workaround**: Update the CSV file manually and run ingestion again

