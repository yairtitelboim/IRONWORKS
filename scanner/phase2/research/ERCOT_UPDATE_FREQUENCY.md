# ERCOT GIS Reports Update Frequency

## Summary

Based on research and analysis of ERCOT's data structure:

**ERCOT GIS Interconnection Queue Reports are updated MONTHLY**

---

## Evidence

### 1. Historical Data Pattern
- **90 monthly Excel files** covering the period **2018-2025**
- This indicates one report per month over ~7.5 years
- Files are typically named with month/year identifiers

### 2. Report Type
- **GIS Reports** (Generator Interconnection Status Reports)
- Published on ERCOT's Market Information System (MIS)
- URL: `https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er`

### 3. Update Schedule
- **Frequency**: **Monthly** (typically published once per month)
- **Timing**: Usually published mid-to-late month for the previous month's data
- **Format**: XLSX files containing interconnection queue status

---

## Implications for Our System

### Current Implementation
- ✅ **Fresh Download**: Our Playwright script downloads the latest report when the button is clicked
- ✅ **Change Detection**: Compares against previous snapshot to detect new/updated projects
- ✅ **Fallback**: Uses existing CSV if download fails

### Recommended Update Schedule

Based on monthly updates, we should:

1. **Manual Refresh**: Users can click the ERCOT button anytime to check for updates
2. **Automated Schedule**: Run daily checks (even though updates are monthly)
   - **Why daily?** ERCOT may publish updates at any time during the month
   - **Why not monthly?** We want to catch updates as soon as they're published
   - **Cost**: Minimal - only downloads if a new file is available

### Optimal Strategy

```javascript
// Daily check (recommended)
// Even though updates are monthly, check daily to catch updates immediately
cron.schedule('0 6 * * *', async () => {
  // Download fresh data
  // If no new file, will use existing CSV
  // Change detection will show "no changes" if nothing new
});
```

**Benefits:**
- ✅ Catches updates as soon as ERCOT publishes them
- ✅ No wasted downloads (change detection prevents duplicate processing)
- ✅ User gets notified immediately when new data is available

---

## Other ERCOT Data Update Frequencies

For reference, other ERCOT datasets have different update frequencies:

- **Real-Time Market (RTM) Data**: Every 15 minutes
- **Daily Market Updates**: Daily at 18:00 UTC
- **Historical Data**: Various granularities (5-minute to yearly)
- **GIS Interconnection Queue Reports**: **Monthly** ← This is what we're using

---

## Verification

To verify the current update frequency:

1. **Check ERCOT Website**: Visit https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er
2. **Look at File Dates**: Check the publication dates of recent GIS report files
3. **Monitor Over Time**: Track when new files appear over several months

---

## Notes

- ERCOT may occasionally publish updates more frequently (e.g., mid-month corrections)
- The monthly schedule is typical but not guaranteed
- Our system handles this gracefully by checking daily and detecting changes

---

## References

- ERCOT Market Information System: https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er
- Research Document: `scanner/phase2/research/ERCOT_EXISTING_DATA_ANALYSIS.md`
- Historical Data: 90 monthly files from 2018-2025

